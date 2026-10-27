import { config } from '../config';
import type { Route } from '../db/entities/route.entity';
import { type Alert, deliver } from '../infra/notifier';
import { log } from '../logger';
import { type Offer, offerDate } from '../providers';
import { notificationRepository } from '../repositories/notification.repository';

export const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-09-12" -> "12 set". Escrito na mao para nao depender do locale do host. */
const diaCurto = (iso: string) => `${iso.slice(8, 10)} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

export interface AlertContext {
  route: Route;
  best: Offer;
  previousBest: number | null;
  allTimeLow: number | null;
}

interface Motive {
  reason: string;
  line: string;
}

/**
 * As tres razoes para acordar alguem por causa de um preco. Ficam juntas e puras
 * para que a decisao de alertar seja legivel de cima a baixo.
 */
function motives({ route, best, previousBest, allTimeLow }: AlertContext): Motive[] {
  const found: Motive[] = [];

  if (allTimeLow !== null && best.price < allTimeLow) {
    found.push({
      reason: 'menor_preco_historico',
      line: `Menor preço já registrado (anterior: ${brl(allTimeLow)})`,
    });
  }

  if (route.price_limit !== null && best.price <= route.price_limit) {
    found.push({
      reason: 'abaixo_do_limite',
      line: `Abaixo do seu limite de ${brl(route.price_limit)}`,
    });
  }

  if (previousBest !== null && previousBest > 0) {
    const dropPct = ((previousBest - best.price) / previousBest) * 100;
    if (dropPct >= config.alerts.dropPct) {
      found.push({
        reason: 'queda',
        line:
          `Caiu ${dropPct.toFixed(1)}% desde a última consulta ` +
          `(${brl(previousBest)} -> ${brl(best.price)}, economia de ${brl(previousBest - best.price)})`,
      });
    }
  }

  return found;
}

export class AlertService {
  /**
   * Evita repetir o mesmo alerta a cada consulta enquanto o preco oscila em
   * torno do limite. Minimo historico sempre passa: aquele nao se repete.
   */
  private async inCooldown(routeId: number, bypass: boolean): Promise<boolean> {
    if (bypass || config.alerts.cooldownHours <= 0) return false;

    const lastAt = await notificationRepository.lastSentAt(routeId);
    if (!lastAt) return false;

    const elapsedHours = (Date.now() - new Date(lastAt).getTime()) / 3_600_000;
    return elapsedHours < config.alerts.cooldownHours;
  }

  private async send(alert: Alert): Promise<void> {
    await notificationRepository.insert({
      route_id: alert.routeId,
      sent_at: new Date(),
      reason: alert.reason,
      price: alert.price,
      message: alert.message,
    });
    log.info(`alerta enviado (rota ${alert.routeId}): ${alert.reason}`, alert.message);

    await deliver(alert);
  }

  /** Decide se este preco merece um alerta e, se merecer, dispara. */
  async evaluate(context: AlertContext): Promise<void> {
    const found = motives(context);
    if (found.length === 0) return;

    const { route, best } = context;
    const isNewLow = found.some((m) => m.reason === 'menor_preco_historico');

    /* Numa rota com janela o preco sem a data nao serve para nada: quem recebe
       o alerta precisa saber qual dos dias ficou barato. Sem janela a data ja
       esta no cadastro, e repetir so encheria a mensagem. */
    const dataDoMelhor = route.depart_window_days > 0 ? offerDate(best) : null;
    const quando = dataDoMelhor ? ` em ${diaCurto(dataDoMelhor)}` : '';

    if (await this.inCooldown(route.id, isNewLow)) {
      log.info(
        `alerta suprimido por cooldown (rota ${route.id})`,
        found.map((m) => m.reason).join(','),
      );
      return;
    }

    await this.send({
      routeId: route.id,
      reason: found.map((m) => m.reason).join(','),
      price: best.price,
      link: best.link,
      title: `${route.origin} → ${route.destination} por ${brl(best.price)}${quando}`,
      message: found.map((m) => m.line).join('\n'),
    });
  }
}

export const alertService = new AlertService();
