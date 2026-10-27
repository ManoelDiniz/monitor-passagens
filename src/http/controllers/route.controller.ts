import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError } from '../../domain/errors';
import { routeService } from '../../services/route.service';

export interface IdRoute {
  Params: { id: string };
}

function routeId(req: FastifyRequest<IdRoute>): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError();
  return id;
}

/**
 * Só traduz HTTP para servico e de volta. Validacao mora no dominio,
 * regra mora no servico, e o erro sobe para o handler central.
 */
export class RouteController {
  list = () => routeService.list();

  offers = (req: FastifyRequest<IdRoute>) => routeService.offers(routeId(req));

  create = (req: FastifyRequest, reply: FastifyReply) =>
    reply.code(201).send(routeService.create(req.body));

  update = (req: FastifyRequest<IdRoute>) => routeService.update(routeId(req), req.body);

  remove = (req: FastifyRequest<IdRoute>) => {
    routeService.remove(routeId(req));
    return { ok: true };
  };

  check = (req: FastifyRequest<IdRoute>) => routeService.checkNow(routeId(req));
}

export const routeController = new RouteController();
