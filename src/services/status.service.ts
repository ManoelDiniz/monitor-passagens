import { config } from '../config';
import { backupService } from '../infra/backup';
import { estadoDosCanais, type EstadoCanal } from '../infra/notifier';
import { activeProviders } from '../providers';
import { providerHealth, type SourceHealth } from '../providers/health';
import { schedulerService } from './scheduler.service';

export interface AppStatus {
  providers: string[];
  /** Uma linha por fonte: respondendo, instavel ou suspensa. */
  sources: SourceHealth[];
  scheduleTimes: string[];
  timezone: string;
  nextRun: string | null;
  lastRun: string | null;
  running: boolean;
  mode: 'merge' | 'failover';
  telegram: boolean;
  /** Como foi a ultima entrega de cada canal de aviso. */
  channels: Record<'desktop' | 'telegram', EstadoCanal>;
  dropAlertPct: number;
  cooldownHours: number;
  backup: {
    enabled: boolean;
    at: string | null;
    bytes: number | null;
    keep: number;
    time: string;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export class StatusService {
  current(): AppStatus {
    const ultimoBackup = config.backup.enabled ? backupService.ultimo() : null;
    const nomes = activeProviders().map((p) => p.name);

    return {
      providers: nomes,
      sources: providerHealth.snapshot(nomes),
      scheduleTimes: config.schedule.times.map((t) => `${pad(t.hour)}:${pad(t.minute)}`),
      timezone: config.schedule.timezone,
      nextRun: schedulerService.nextRunAt(),
      lastRun: schedulerService.getLastRunAt(),
      running: schedulerService.isRunning(),
      mode: config.providerMode,
      telegram: Boolean(config.telegram.botToken && config.telegram.chatId),
      channels: estadoDosCanais(),
      dropAlertPct: config.alerts.dropPct,
      cooldownHours: config.alerts.cooldownHours,
      backup: {
        enabled: config.backup.enabled,
        at: ultimoBackup?.criadoEm ?? null,
        bytes: ultimoBackup?.bytes ?? null,
        keep: config.backup.keep,
        time: `${pad(config.backup.time.hour)}:${pad(config.backup.time.minute)}`,
      },
    };
  }
}

export const statusService = new StatusService();
