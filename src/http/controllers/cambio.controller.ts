import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError } from '../../domain/errors';
import { cambioService } from '../../services/cambio.service';

export interface IdOperacao {
  Params: { id: string };
}

export interface AtivoQuery {
  Querystring: { ativo?: string; capital?: string };
}

export class CambioController {
  panorama = () => cambioService.panorama();

  carteira = () => cambioService.carteira();

  alertas = () => cambioService.alertas();

  registrar = async (req: FastifyRequest, reply: FastifyReply) =>
    reply.code(201).send(await cambioService.registrarOperacao(req.body));

  remover = async (req: FastifyRequest<IdOperacao>) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('operacao nao encontrada');
    await cambioService.removerOperacao(id);
    return { ok: true };
  };

  /** Busca as cotacoes agora e devolve o painel ja com elas. */
  atualizar = async () => {
    await cambioService.sincronizar();
    return cambioService.panorama();
  };

  backtest = (req: FastifyRequest<AtivoQuery>) => {
    const capital = Number(req.query.capital ?? 100);
    return cambioService.backtest(req.query.ativo ?? 'DOLA11', capital > 0 ? capital : 100);
  };
}

export const cambioController = new CambioController();
