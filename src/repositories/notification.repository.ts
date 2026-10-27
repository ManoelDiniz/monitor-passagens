import { AppDataSource } from '../db/data-source';
import { Notification } from '../db/entities/notification.entity';
import { Route } from '../db/entities/route.entity';

export interface NewNotification {
  route_id: number;
  sent_at: Date;
  reason: string;
  price: number;
  message: string;
}

/** Alerta com o contexto da rota: quem le a lista precisa saber de qual voo se trata. */
export interface NotificationView {
  id: number;
  route_id: number;
  sent_at: string;
  reason: string;
  price: number;
  message: string;
  origin: string;
  destination: string;
  depart_date: string;
}

interface RawRow {
  id: number;
  route_id: number;
  sent_at: Date | string;
  reason: string;
  price: string;
  message: string;
  origin: string;
  destination: string;
  depart_date: Date | string;
}

export class NotificationRepository {
  private get repo() {
    return AppDataSource.getRepository(Notification);
  }

  async insert(entry: NewNotification): Promise<void> {
    await this.repo.save(this.repo.create(entry));
  }

  async findRecent(limit = 50): Promise<NotificationView[]> {
    const rows = await this.repo
      .createQueryBuilder('n')
      .select([
        'n.id AS id',
        'n.route_id AS route_id',
        'n.sent_at AS sent_at',
        'n.reason AS reason',
        'n.price AS price',
        'n.message AS message',
        'r.origin AS origin',
        'r.destination AS destination',
        'r.depart_date AS depart_date',
      ])
      .innerJoin(Route, 'r', 'r.id = n.route_id')
      .orderBy('n.sent_at', 'DESC')
      .limit(limit)
      .getRawMany<RawRow>();

    return rows.map((row) => ({
      ...row,
      sent_at: row.sent_at instanceof Date ? row.sent_at.toISOString() : String(row.sent_at),
      price: Number(row.price),
      depart_date: String(row.depart_date).slice(0, 10),
    }));
  }

  async lastSentAt(routeId: number): Promise<string | null> {
    const last = await this.repo.findOne({
      where: { route_id: routeId },
      order: { sent_at: 'DESC' },
      select: { sent_at: true },
    });
    return last ? last.sent_at.toISOString() : null;
  }
}

export const notificationRepository = new NotificationRepository();
