import { config } from '../config';
import type { Route } from '../db/entities/route.entity';
import { addDays, nightsBetween, windowDates } from '../domain/date-window';
import { log } from '../logger';
import { type Offer, offerDate, searchAll, searchWithFallback } from '../providers';
import { checkRepository } from '../repositories/check.repository';
import type { NewOffer } from '../repositories/offer.repository';
import { offerRepository } from '../repositories/offer.repository';
import { routeRepository } from '../repositories/route.repository';
import { alertService, brl } from './alert.service';

export interface CheckResult {
  routeId: number;
  status: 'ok' | 'empty' | 'error';
  provider?: string;
  bestPrice?: number;
  /** Dia de ida do melhor preco. Numa rota com janela, o preco sozinho nao diz nada. */
  bestDate?: string | null;
  /** Quantos dias foram consultados nesta rodada. */
  datesSearched?: number;
  previousBest?: number | null;
  allTimeLow?: number | null;
  offersFound?: number;
  offersEligible?: number;
  error?: string;
}

/** Pausa entre rotas para nao estourar o rate limit dos provedores. */
const PAUSE_BETWEEN_ROUTES_MS = 1_500;

/**
 * Uma oferta so entra na comparacao se atender as preferencias da rota.
 * Sem isso, uma tarifa promocional sem bagagem "derruba" o preco e dispara
 * alerta falso contra uma tarifa flex do dia anterior.
 *
 * `dias` so vem preenchido em rota com janela, e nesse caso a data tambem e
 * filtro: uma busca por intervalo pode devolver dia fora do pedido, e um preco
 * de uma viagem que a pessoa nao faria envenenaria o historico da rota.
 */
export function isEligible(offer: Offer, route: Route, dias?: ReadonlySet<string>): boolean {
  const stops = Math.max(offer.stopsOut ?? 0, offer.stopsRet ?? 0);
  if (stops > route.max_stops) return false;
  // checkedBags null = provedor nao informa; nao da para excluir com certeza.
  if (route.require_checked_bag && offer.checkedBags === 0) return false;
  if (dias) {
    const data = offerDate(offer);
    // Sem data nenhuma nao da para excluir com certeza — mesma regra da bagagem.
    if (data !== null && !dias.has(data)) return false;
  }
  return true;
}

/** Provedores entregam data como texto ISO; a coluna e datetime. */
const asDate = (value: string | null) => (value ? new Date(value) : null);

function toRow(
  offer: Offer,
  route: Route,
  dias?: ReadonlySet<string>,
): Omit<NewOffer, 'check_id'> {
  return {
    route_id: route.id,
    price: offer.price,
    currency: offer.currency,
    airline: offer.airline,
    cabin: offer.cabin,
    checked_bags: offer.checkedBags,
    stops_out: offer.stopsOut,
    stops_ret: offer.stopsRet,
    depart_at: asDate(offer.departAt),
    return_at: asDate(offer.returnAt),
    link: offer.link,
    eligible: isEligible(offer, route, dias) ? 1 : 0,
    source: offer.source ?? null,
  };
}

export class MonitorService {
  async checkRoute(route: Route): Promise<CheckResult> {
    const janela = windowDates(route.depart_date, route.depart_window_days, {
      max: config.search.maxDatesPerRoute,
    });
    const dias = janela.dates.length > 1 ? new Set(janela.dates) : undefined;

    const label =
      dias === undefined
        ? `${route.origin}->${route.destination} ${route.depart_date}`
        : `${route.origin}->${route.destination} ${janela.dates[0]}..${janela.dates.at(-1)}`;

    if (janela.passados > 0) {
      log.warn(`${label}: ${janela.passados} dia(s) da janela ja passaram`, 'consultando o resto');
    }
    if (janela.cortados > 0) {
      log.warn(
        `${label}: ${janela.cortados} dia(s) da janela ficaram de fora`,
        `teto de ${config.search.maxDatesPerRoute} datas por rodada (SEARCH_MAX_DATES)`,
      );
    }

    const startedAt = Date.now();

    // Lidos ANTES de gravar a consulta atual, senao o novo preco entra na comparacao.
    const previousBest = await checkRepository.previousBest(route.id);
    const allTimeLow = await offerRepository.allTimeLow(route.id);

    let provider: string;
    let offers: Offer[];

    try {
      const consultar = config.providerMode === 'merge' ? searchAll : searchWithFallback;
      /* A volta acompanha o primeiro dia da janela, nao a ancora: o que a rota
         guarda de verdade e a duracao da viagem, e e ela que desliza junto. */
      const noites = route.return_date
        ? nightsBetween(route.depart_date, route.return_date)
        : null;

      const result = await consultar({
        origin: route.origin,
        destination: route.destination,
        departDate: janela.dates[0],
        departDateEnd: janela.dates.at(-1),
        returnDate: noites === null ? null : addDays(janela.dates[0], noites),
        adults: route.adults,
        maxStops: route.max_stops,
      });
      provider = result.provider;
      offers = result.offers;
    } catch (err) {
      const message = (err as Error).message;
      await checkRepository.insert({
        route_id: route.id,
        checked_at: new Date(),
        provider: null,
        status: 'error',
        duration_ms: Date.now() - startedAt,
        error: message,
      });
      log.error(`consulta falhou ${label}`, message);
      return { routeId: route.id, status: 'error', error: message };
    }

    const eligible = offers.filter((o) => isEligible(o, route, dias));
    const status: 'ok' | 'empty' = eligible.length > 0 ? 'ok' : 'empty';
    const durationMs = Date.now() - startedAt;

    await checkRepository.record(
      {
        route_id: route.id,
        checked_at: new Date(),
        provider,
        status,
        duration_ms: durationMs,
        error: null,
      },
      offers.map((offer) => toRow(offer, route, dias)),
    );

    if (status === 'empty') {
      log.warn(
        `nenhuma oferta elegivel ${label}`,
        `${offers.length} ofertas descartadas pelos filtros`,
      );
      return {
        routeId: route.id,
        status,
        provider,
        datesSearched: janela.dates.length,
        offersFound: offers.length,
        offersEligible: 0,
      };
    }

    const best = eligible.reduce((a, b) => (b.price < a.price ? b : a));
    const bestDate = offerDate(best);
    const quando = dias && bestDate ? ` em ${bestDate}` : '';

    log.info(
      `${label}: ${brl(best.price)}${quando} via ${provider} ` +
        `(${durationMs}ms, ${eligible.length}/${offers.length} ofertas)`,
    );

    await alertService.evaluate({ route, best, previousBest, allTimeLow });

    return {
      routeId: route.id,
      status,
      provider,
      bestPrice: best.price,
      bestDate,
      datesSearched: janela.dates.length,
      previousBest,
      allTimeLow,
      offersFound: offers.length,
      offersEligible: eligible.length,
    };
  }

  async checkAllRoutes(): Promise<CheckResult[]> {
    const routes = await routeRepository.findActive();

    if (routes.length === 0) {
      log.info('nenhuma rota ativa cadastrada');
      return [];
    }

    log.info(`iniciando consulta de ${routes.length} rota(s)`);
    const results: CheckResult[] = [];

    for (const route of routes) {
      results.push(await this.checkRoute(route));
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_ROUTES_MS));
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    log.info(`consulta concluida: ${ok}/${results.length} com resultado`);
    return results;
  }
}

export const monitorService = new MonitorService();
export { brl };
