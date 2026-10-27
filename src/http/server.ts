import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from '../config';
import { HttpError } from '../domain/errors';
import { log } from '../logger';
import { registerRoutes } from './routes';

/**
 * "Consultar agora" e "Excluir" nao tem corpo. Sem isto o Fastify responde
 * 400 (FST_ERR_CTP_EMPTY_JSON_BODY) quando o content-type e JSON e o corpo vazio.
 */
function acceptEmptyJsonBody(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = String(body).trim();
    if (!raw) return done(null, {});
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      (err as Error & { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });
}

/** Um unico lugar traduz erro em resposta; os controllers so lancam. */
function handleErrors(app: FastifyInstance): void {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.message });
    }

    const status = err.statusCode ?? 500;
    if (status >= 500) log.error(`erro em ${req.method} ${req.url}`, err);

    return reply
      .code(status)
      .send({ error: status >= 500 ? 'erro interno no servidor' : err.message });
  });
}

export async function startServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  acceptEmptyJsonBody(app);
  handleErrors(app);

  await app.register(fastifyStatic, { root: config.paths.public });
  registerRoutes(app);

  await app.listen({ port: config.port, host: '127.0.0.1' });
  log.info(`painel disponivel em http://localhost:${config.port}`);

  return app;
}
