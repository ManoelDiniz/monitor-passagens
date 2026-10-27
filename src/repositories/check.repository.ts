import { AppDataSource } from '../db/data-source';
import { Check, type CheckStatus } from '../db/entities/check.entity';
import { Offer } from '../db/entities/offer.entity';
import type { NewOffer } from './offer.repository';

export interface NewCheck {
  route_id: number;
  checked_at: Date;
  provider: string | null;
  status: CheckStatus;
  duration_ms: number | null;
  error: string | null;
}

/** Instantes saem como ISO para a API, nao como Date, para o contrato ser explicito. */
export interface LastCheck {
  checked_at: string;
  status: CheckStatus;
  provider: string | null;
  error: string | null;
}

export interface HistoryPoint {
  at: string;
  price: number;
}

/** Ofertas grandes em lote: o payload bruto de cada uma nao e pequeno. */
const INSERT_CHUNK = 100;

export class CheckRepository {
  private get repo() {
    return AppDataSource.getRepository(Check);
  }

  async insert(check: NewCheck): Promise<number> {
    const saved = await this.repo.save(this.repo.create(check));
    return saved.id;
  }

  /**
   * Consulta e ofertas entram juntas ou nao entram: um preco pendurado numa
   * consulta que nao existe mentiria no historico.
   */
  async record(check: NewCheck, offers: Array<Omit<NewOffer, 'check_id'>>): Promise<number> {
    return AppDataSource.transaction(async (manager) => {
      const checkRepo = manager.getRepository(Check);
      const saved = await checkRepo.save(checkRepo.create(check));

      if (offers.length > 0) {
        const offerRepo = manager.getRepository(Offer);
        const rows = offers.map((offer) => offerRepo.create({ ...offer, check_id: saved.id }));
        await offerRepo.save(rows, { chunk: INSERT_CHUNK });
      }

      return saved.id;
    });
  }

  async findLast(routeId: number): Promise<LastCheck | null> {
    const check = await this.repo.findOne({
      where: { route_id: routeId },
      order: { checked_at: 'DESC' },
    });
    if (!check) return null;

    return {
      checked_at: check.checked_at.toISOString(),
      status: check.status,
      provider: check.provider,
      error: check.error,
    };
  }

  /** Id da ultima consulta que realmente trouxe oferta elegivel. */
  async lastOkId(routeId: number): Promise<number | null> {
    const check = await this.repo.findOne({
      where: { route_id: routeId, status: 'ok' },
      order: { checked_at: 'DESC' },
      select: { id: true },
    });
    return check?.id ?? null;
  }

  /** Serie de menor preco por consulta, do mais antigo para o mais novo. */
  async priceHistory(routeId: number): Promise<HistoryPoint[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.checked_at', 'at')
      .addSelect('MIN(o.price)', 'price')
      .innerJoin(Offer, 'o', 'o.check_id = c.id AND o.eligible = 1')
      .where('c.route_id = :routeId', { routeId })
      .groupBy('c.id')
      .orderBy('c.checked_at', 'ASC')
      .getRawMany<{ at: Date | string; price: string }>();

    return rows.map((row) => ({
      at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
      price: Number(row.price),
    }));
  }

  /** Menor preco da ultima consulta bem-sucedida — a base da comparacao de queda. */
  async previousBest(routeId: number): Promise<number | null> {
    const row = await this.repo
      .createQueryBuilder('c')
      .select('MIN(o.price)', 'price')
      .innerJoin(Offer, 'o', 'o.check_id = c.id AND o.eligible = 1')
      .where('c.route_id = :routeId AND c.status = :status', { routeId, status: 'ok' })
      .groupBy('c.id')
      .orderBy('c.checked_at', 'DESC')
      .limit(1)
      .getRawOne<{ price: string }>();

    return row?.price == null ? null : Number(row.price);
  }
}

export const checkRepository = new CheckRepository();
