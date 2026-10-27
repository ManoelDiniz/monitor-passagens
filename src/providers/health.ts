import { config } from '../config';
import { log } from '../logger';

/**
 * Saude de cada fonte de preco.
 *
 * No modo "merge" uma fonte pode morrer sem que nada apareca: a consulta ainda
 * volta "ok" porque a outra respondeu, e o painel mostra um preco normal — so
 * que calculado sobre metade das ofertas. Foi assim que o monitor rodou 11
 * consultas so com a Kiwi sem nada registrar. Este modulo existe para essa
 * queda ficar visivel.
 *
 * O segundo trabalho e nao insistir: passadas N falhas seguidas, a fonte fica
 * de castigo por alguns minutos. Bater de hora em hora numa API que ja recusou
 * tres vezes e o caminho mais curto para trocar um erro temporario por um
 * bloqueio permanente.
 *
 * O estado vive em memoria e zera quando o processo reinicia — de proposito.
 * E um retrato do "esta funcionando agora?", nao um historico; o historico de
 * longo prazo esta na tabela checks e no log.
 */

export type SourceState = 'ok' | 'instavel' | 'fora';

export interface SourceHealth {
  name: string;
  state: SourceState;
  attempts: number;
  failures: number;
  consecutiveFailures: number;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  /** Quando volta a ser consultada, se estiver de castigo. */
  pausedUntil: string | null;
}

interface Registro {
  attempts: number;
  failures: number;
  consecutiveFailures: number;
  lastOkAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  pausedUntil: Date | null;
}

const novo = (): Registro => ({
  attempts: 0,
  failures: 0,
  consecutiveFailures: 0,
  lastOkAt: null,
  lastErrorAt: null,
  lastError: null,
  pausedUntil: null,
});

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export class ProviderHealth {
  private readonly registros = new Map<string, Registro>();

  private get(name: string): Registro {
    let r = this.registros.get(name);
    if (!r) {
      r = novo();
      this.registros.set(name, r);
    }
    return r;
  }

  registerSuccess(name: string): void {
    const r = this.get(name);
    const estavaFora = r.pausedUntil !== null || r.consecutiveFailures > 0;

    r.attempts++;
    r.consecutiveFailures = 0;
    r.lastOkAt = new Date();
    r.pausedUntil = null;

    if (estavaFora) log.info(`fonte ${name} voltou a responder`);
  }

  registerFailure(name: string, motivo: string): void {
    const r = this.get(name);
    r.attempts++;
    r.failures++;
    r.consecutiveFailures++;
    r.lastErrorAt = new Date();
    r.lastError = motivo;

    const { breakerFailures, breakerMinutes } = config.providers;
    if (r.consecutiveFailures >= breakerFailures) {
      r.pausedUntil = new Date(Date.now() + breakerMinutes * 60_000);
      log.warn(
        `fonte ${name} suspensa por ${breakerMinutes} min apos ${r.consecutiveFailures} falhas seguidas`,
        motivo,
      );
    }
  }

  /** Em castigo? A pausa expira sozinha e a proxima consulta vira a sondagem. */
  isPaused(name: string): boolean {
    const r = this.registros.get(name);
    if (!r?.pausedUntil) return false;

    if (r.pausedUntil.getTime() <= Date.now()) {
      r.pausedUntil = null;
      return false;
    }
    return true;
  }

  private state(r: Registro, name: string): SourceState {
    if (this.isPaused(name)) return 'fora';
    return r.consecutiveFailures > 0 ? 'instavel' : 'ok';
  }

  /** Retrato para o /api/status. Fonte nunca consultada nao aparece como falha. */
  snapshot(nomes: string[]): SourceHealth[] {
    return nomes.map((name) => {
      const r = this.registros.get(name) ?? novo();
      return {
        name,
        state: this.state(r, name),
        attempts: r.attempts,
        failures: r.failures,
        consecutiveFailures: r.consecutiveFailures,
        lastOkAt: iso(r.lastOkAt),
        lastErrorAt: iso(r.lastErrorAt),
        lastError: r.lastError,
        pausedUntil: iso(r.pausedUntil),
      };
    });
  }
}

export const providerHealth = new ProviderHealth();
