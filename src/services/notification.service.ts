import {
  type NotificationView,
  notificationRepository,
} from '../repositories/notification.repository';

/** Teto de itens devolvidos pela API, para a lista nao crescer sem limite. */
const MAX_LIMIT = 200;

export class NotificationService {
  list(limit = 50): Promise<NotificationView[]> {
    const safe = Math.min(Math.max(1, Math.trunc(limit) || 50), MAX_LIMIT);
    return notificationRepository.findRecent(safe);
  }
}

export const notificationService = new NotificationService();
