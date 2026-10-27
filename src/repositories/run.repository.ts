import { AppDataSource } from '../db/data-source';
import { Run } from '../db/entities/run.entity';

/** Registro dos horarios agendados que ja rodaram, para nao repetir a recuperacao. */
export class RunRepository {
  private get repo() {
    return AppDataSource.getRepository(Run);
  }

  /** orIgnore: dois gatilhos no mesmo minuto nao podem virar erro. */
  async mark(slotKey: string, at = new Date()): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Run)
      .values({ slot_key: slotKey, ran_at: at })
      .orIgnore()
      .execute();
  }

  async hasRun(slotKey: string): Promise<boolean> {
    return (await this.repo.countBy({ slot_key: slotKey })) > 0;
  }
}

export const runRepository = new RunRepository();
