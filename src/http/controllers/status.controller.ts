import { schedulerService } from '../../services/scheduler.service';
import { statusService } from '../../services/status.service';

export class StatusController {
  current = () => statusService.current();

  /**
   * Dispara a rodada completa e responde na hora. O front acompanha o fim pelo
   * campo "running" do status, entao aqui nao ha espera nem promessa falsa.
   */
  checkAll = () => {
    const started = schedulerService.triggerManualRun();
    return { started, running: schedulerService.isRunning() };
  };
}

export const statusController = new StatusController();
