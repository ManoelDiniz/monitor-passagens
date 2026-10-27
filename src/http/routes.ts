import type { FastifyInstance } from 'fastify';
import { type AtivoQuery, cambioController, type IdOperacao } from './controllers/cambio.controller';
import { criptoController, type IdOperacaoCripto, type MoedaQuery } from './controllers/cripto.controller';
import { notificationController } from './controllers/notification.controller';
import { type IdRoute, routeController } from './controllers/route.controller';
import { statusController } from './controllers/status.controller';

/** Mapa completo da API num lugar so: o que existe e quem atende. */
export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/status', statusController.current);
  app.post('/api/check-all', statusController.checkAll);

  app.get('/api/routes', routeController.list);
  app.post('/api/routes', routeController.create);
  app.get<IdRoute>('/api/routes/:id/offers', routeController.offers);
  app.patch<IdRoute>('/api/routes/:id', routeController.update);
  app.delete<IdRoute>('/api/routes/:id', routeController.remove);
  app.post<IdRoute>('/api/routes/:id/check', routeController.check);

  app.get('/api/notifications', notificationController.list);

  app.get('/api/cambio', cambioController.panorama);
  app.post('/api/cambio/atualizar', cambioController.atualizar);
  app.get('/api/cambio/carteira', cambioController.carteira);
  app.get('/api/cambio/alertas', cambioController.alertas);
  app.post('/api/cambio/operacoes', cambioController.registrar);
  app.delete<IdOperacao>('/api/cambio/operacoes/:id', cambioController.remover);
  app.get<AtivoQuery>('/api/cambio/backtest', cambioController.backtest);

  app.get('/api/cripto', criptoController.radar);
  app.post('/api/cripto/atualizar', criptoController.atualizar);
  app.get('/api/cripto/carteira', criptoController.carteira);
  app.post('/api/cripto/operacoes', criptoController.registrar);
  app.delete<IdOperacaoCripto>('/api/cripto/operacoes/:id', criptoController.remover);
  app.get<MoedaQuery>('/api/cripto/estudo', criptoController.estudo);
}
