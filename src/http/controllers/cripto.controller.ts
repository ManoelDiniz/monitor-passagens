import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError } from '../../domain/errors';
import { criptoService } from '../../services/cripto.service';

export interface IdOperacaoCripto {
  Params: { id: string };
}

export interface MoedaQuery {
  Querystring: { moeda?: string; capital?: string };
}

export class CriptoController {
  radar = () => criptoService.radar();

  carteira = () => criptoService.carteira();

  atualizar = async () => {
    await criptoService.sincronizar();
    return criptoService.radar();
  };

  registrar = async (req: FastifyRequest, reply: FastifyReply) =>
    reply.code(201).send(await criptoService.registrar(req.body));

  remover = async (req: FastifyRequest<IdOperacaoCripto>) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('operacao nao encontrada');
    await criptoService.remover(id);
    return { ok: true };
  };

  estudo = (req: FastifyRequest<MoedaQuery>) => {
    const capital = Number(req.query.capital ?? 100);
    return criptoService.estudo(req.query.moeda ?? 'BTC', capital > 0 ? capital : 100);
  };
}

export const criptoController = new CriptoController();
