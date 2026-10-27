import type { FastifyRequest } from 'fastify';
import { notificationService } from '../../services/notification.service';

interface ListQuery {
  Querystring: { limit?: string };
}

export class NotificationController {
  list = (req: FastifyRequest<ListQuery>) =>
    notificationService.list(Number(req.query.limit) || 50);
}

export const notificationController = new NotificationController();
