import type { Route } from '../db/entities/route.entity';
import { NotFoundError } from '../domain/errors';
import {
  affectsSearch,
  parseRouteCreate,
  parseRouteUpdate,
  type RouteFields,
} from '../domain/route-input';
import { log } from '../logger';
import {
  type HistoryPoint,
  type LastCheck,
  checkRepository,
} from '../repositories/check.repository';
import { type DayPrice, type OfferView, offerRepository } from '../repositories/offer.repository';
import { routeRepository } from '../repositories/route.repository';
import { type CheckResult, monitorService } from './monitor.service';

/** A rota do jeito que a interface precisa: cadastro + leitura de preco. */
export interface RouteSummary extends Route {
  current: number | null;
  previous: number | null;
  variation: number | null;
  variationPct: number | null;
  lowest: number | null;
  highest: number | null;
  average: number | null;
  checks: number;
  bestOffer: OfferView | null;
  lastCheck: LastCheck | null;
  history: HistoryPoint[];
  /** Menor preco de cada dia da janela. Vazio em rota de data fixa. */
  byDate: DayPrice[];
}

/** Quantos pontos da serie vao para a tela. O grafico nao le mais que isso. */
const HISTORY_WINDOW = 60;

export class RouteService {
  private async summarize(route: Route): Promise<RouteSummary> {
    const [history, bestOffer, lastCheck, byDate] = await Promise.all([
      checkRepository.priceHistory(route.id),
      offerRepository.findBest(route.id),
      checkRepository.findLast(route.id),
      /* So quem tem janela precisa da quebra por dia. Numa rota de data fixa
         seria sempre uma linha so — e uma consulta a mais na listagem inteira. */
      route.depart_window_days > 0 ? offerRepository.bestByDate(route.id) : [],
    ]);

    const prices = history.map((h) => h.price);
    const current = prices.length ? prices[prices.length - 1] : null;
    const previous = prices.length > 1 ? prices[prices.length - 2] : null;

    return {
      ...route,
      current,
      previous,
      variation: current !== null && previous !== null ? current - previous : null,
      variationPct: current !== null && previous ? ((current - previous) / previous) * 100 : null,
      lowest: prices.length ? Math.min(...prices) : null,
      highest: prices.length ? Math.max(...prices) : null,
      average: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      checks: prices.length,
      bestOffer,
      lastCheck,
      history: history.slice(-HISTORY_WINDOW),
      byDate,
    };
  }

  private async require(id: number): Promise<Route> {
    const route = await routeRepository.findById(id);
    if (!route) throw new NotFoundError();
    return route;
  }

  async list(): Promise<RouteSummary[]> {
    const routes = await routeRepository.findAll();
    return Promise.all(routes.map((route) => this.summarize(route)));
  }

  async get(id: number): Promise<RouteSummary> {
    return this.summarize(await this.require(id));
  }

  async offers(id: number): Promise<OfferView[]> {
    await this.require(id);
    return offerRepository.findTop(id);
  }

  async create(body: unknown): Promise<RouteSummary> {
    const input = parseRouteCreate(body);
    const id = await routeRepository.insert(input);
    const route = await this.require(id);

    log.info(`rota cadastrada: ${route.origin}->${route.destination} ${route.depart_date}`);

    // Primeira consulta imediata para a rota ja nascer com um preco.
    void monitorService
      .checkRoute(route)
      .catch((err) => log.error('falha na consulta inicial', err));

    return this.summarize(route);
  }

  async update(id: number, body: unknown): Promise<RouteSummary> {
    const current = await this.require(id);
    const patch = parseRouteUpdate(body, current as unknown as RouteFields);

    await routeRepository.update(id, patch);
    const updated = await this.require(id);

    log.info(`rota ${id} alterada`, Object.keys(patch).join(', '));

    // Mudou o que se consulta: o preco em tela virou de outra viagem.
    if (affectsSearch(patch) && updated.active) {
      void monitorService
        .checkRoute(updated)
        .catch((err) => log.error('falha na reconsulta apos edicao', err));
    }

    return this.summarize(updated);
  }

  /** Consulta sob demanda de uma rota so, disparada pela interface. */
  async checkNow(id: number): Promise<CheckResult> {
    return monitorService.checkRoute(await this.require(id));
  }

  async remove(id: number): Promise<void> {
    await this.require(id);
    await routeRepository.remove(id);
    log.info(`rota ${id} removida`);
  }
}

export const routeService = new RouteService();
