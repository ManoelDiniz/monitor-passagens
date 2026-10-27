import cron from 'node-cron';
import { config } from '../config';
import { backupService } from '../infra/backup';
import { log } from '../logger';
import { offerRepository } from '../repositories/offer.repository';
import { runRepository } from '../repositories/run.repository';
import { cambioService } from './cambio.service';
import { criptoService } from './cripto.service';
import { monitorService } from './monitor.service';

const pad = (n: number) => String(n).padStart(2, '0');

const zoned = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.schedule.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Data e hora atuais no fuso configurado, nao no fuso do processo. */
function nowInZone(): { date: string; hour: number; minute: number } {
  const parts = Object.fromEntries(
    zoned.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
  };
}

export class SchedulerService {
  private running = false;
  private lastRunAt: string | null = null;

  isRunning(): boolean {
    return this.running;
  }

  getLastRunAt(): string | null {
    return this.lastRunAt;
  }

  /** Impede que o botao "consultar agora" e o cron rodem em paralelo. */
  private async runOnce(trigger: string): Promise<void> {
    if (this.running) {
      log.warn(`consulta ja em andamento, ignorando gatilho "${trigger}"`);
      return;
    }
    this.running = true;
    try {
      await monitorService.checkAllRoutes();
      /* Cambio vai na mesma rodada, depois das passagens: falha numa API de
         cotacao nao pode atrasar nem derrubar a consulta de precos. */
      await cambioService.rodada().catch((err) => log.error('falha na rodada de cambio', err));
      await criptoService.rodada().catch((err) => log.error('falha na rodada de cripto', err));
      this.lastRunAt = new Date().toISOString();
    } catch (err) {
      log.error('erro inesperado durante a consulta', err);
    } finally {
      this.running = false;
    }
  }

  /**
   * Dispara a rodada manual. Retorna false quando ja havia uma em andamento —
   * a interface usa isso para nao prometer o que nao vai acontecer.
   */
  triggerManualRun(): boolean {
    if (this.running) return false;
    void this.runOnce('manual');
    return true;
  }

  nextRunAt(): string | null {
    const now = nowInZone();
    const nowMinutes = now.hour * 60 + now.minute;

    const later = config.schedule.times.find((t) => t.hour * 60 + t.minute > nowMinutes);
    if (later) return `hoje as ${pad(later.hour)}:${pad(later.minute)}`;

    const first = config.schedule.times[0];
    return first ? `amanha as ${pad(first.hour)}:${pad(first.minute)}` : null;
  }

  /**
   * node-cron so dispara com o processo vivo. Se o PC estava desligado as 08:00,
   * aquela consulta simplesmente nao aconteceu — aqui recuperamos na inicializacao.
   * Varios horarios perdidos geram UMA consulta, nao uma por horario.
   */
  private async catchUpMissed(): Promise<void> {
    const now = nowInZone();
    const nowMinutes = now.hour * 60 + now.minute;

    const jaPassaram = config.schedule.times
      .map((t) => ({ ...t, key: `${now.date} ${pad(t.hour)}:${pad(t.minute)}` }))
      .filter((t) => t.hour * 60 + t.minute <= nowMinutes);

    const missed: typeof jaPassaram = [];
    for (const slot of jaPassaram) {
      if (!(await runRepository.hasRun(slot.key))) missed.push(slot);
    }

    if (missed.length === 0) return;

    log.info(
      `recuperando ${missed.length} horario(s) perdido(s) de hoje`,
      missed.map((m) => m.key),
    );
    const stamp = new Date();
    for (const slot of missed) await runRepository.mark(slot.key, stamp);

    await this.runOnce('catch-up');
  }

  /**
   * Faxina diaria: copia primeiro, poda depois. A ordem importa — o backup do
   * dia precisa conter o que a poda vai apagar, senao a unica copia do detalhe
   * some junto.
   */
  private async manutencaoDiaria(motivo: string): Promise<void> {
    await this.backupIfDue(motivo);
    await this.pruneOffers();
  }

  /**
   * Backup do dia. Mesma logica de recuperacao das consultas: se o PC estava
   * desligado no horario, o cron nao disparou e a copia daquele dia nao existe —
   * entao a inicializacao cobre o atraso em vez de esperar mais 24 horas.
   */
  private async backupIfDue(motivo: string): Promise<void> {
    if (!config.backup.enabled) return;

    const ultimo = backupService.ultimo();
    const idadeHoras = ultimo
      ? (Date.now() - new Date(ultimo.criadoEm).getTime()) / 3_600_000
      : Infinity;

    // Ja existe copia recente: nao adianta gerar outra igual.
    if (idadeHoras < 20) return;

    try {
      await backupService.run(motivo);
    } catch (err) {
      // Sem backup o monitor continua util; o que nao pode e morrer por causa disso.
      log.error('falha ao gerar o backup do banco', err);
    }
  }

  /** Poda das ofertas antigas. Roda todo dia, tenha havido backup novo ou nao. */
  private async pruneOffers(): Promise<void> {
    const dias = config.retention.offerDays;
    if (dias <= 0) return;

    try {
      const apagadas = await offerRepository.pruneOld(dias);
      if (apagadas === 0) return;

      await offerRepository.compactarTabela();
      const { linhas, bytes } = await offerRepository.tamanho();
      log.info(
        `limpeza: ${apagadas} oferta(s) de consultas com mais de ${dias} dias removidas; ` +
          `offers agora com ${linhas} linha(s) em ${(bytes / 1024 / 1024).toFixed(1)} MB`,
      );
    } catch (err) {
      log.error('falha na limpeza das ofertas antigas', err);
    }
  }

  async start(): Promise<void> {
    for (const time of config.schedule.times) {
      cron.schedule(
        `${time.minute} ${time.hour} * * *`,
        () => {
          const now = nowInZone();
          void runRepository
            .mark(`${now.date} ${pad(time.hour)}:${pad(time.minute)}`)
            .catch((err) => log.error('falha ao marcar o horario executado', err));
          void this.runOnce(`cron ${pad(time.hour)}:${pad(time.minute)}`);
        },
        { timezone: config.schedule.timezone },
      );
    }

    const horarios = config.schedule.times.map((t) => `${pad(t.hour)}:${pad(t.minute)}`);
    log.info(
      `agendador ativo (${config.schedule.timezone}), ${horarios.length} horario(s) por dia`,
      horarios.join(' '),
    );

    const { hour, minute } = config.backup.time;
    cron.schedule(`${minute} ${hour} * * *`, () => void this.manutencaoDiaria('diario'), {
      timezone: config.schedule.timezone,
    });

    if (config.backup.enabled) {
      log.info(`backup diario as ${pad(hour)}:${pad(minute)}, mantendo ${config.backup.keep} copias`);
    }
    if (config.retention.offerDays > 0) {
      log.info(
        `ofertas de consultas com mais de ${config.retention.offerDays} dias ficam so com a melhor`,
      );
    }

    await this.catchUpMissed();
    await this.manutencaoDiaria('recuperado na inicializacao');
  }
}

export const schedulerService = new SchedulerService();
