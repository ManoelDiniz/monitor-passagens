import { config } from './config';
import { closeDatabase, initDatabase } from './db/data-source';
import { startServer } from './http/server';
import { log } from './logger';
import { activeProviders } from './providers';
import { cambioService } from './services/cambio.service';
import { criptoService } from './services/cripto.service';
import { schedulerService } from './services/scheduler.service';

async function main() {
  log.info('--- Monitor de Passagens iniciando ---');

  await initDatabase();

  const providers = activeProviders();
  if (providers.length === 0) {
    log.warn(
      'nenhum provedor configurado — o painel abre, mas as consultas vao falhar. ' +
        'Preencha TRAVELPAYOUTS_TOKEN ou AMADEUS_CLIENT_ID/SECRET no arquivo .env',
    );
  } else {
    log.info(`provedores ativos: ${providers.map((p) => p.name).join(', ')}`);
  }

  await startServer();
  await schedulerService.start();

  /* Na primeira vez baixa anos de historico de cambio; nao segura o painel
     esperando por isso. */
  if (config.cambio.enabled) {
    void cambioService.sincronizar().catch((err) => log.error('falha ao sincronizar o cambio', err));
  }
  if (config.cripto.enabled) {
    void criptoService.sincronizar().catch((err) => log.error('falha ao sincronizar a cripto', err));
  }

  log.info(`pronto. Abra http://localhost:${config.port} para gerenciar as rotas.`);
}

function shutdown(signal: string) {
  log.info(`recebido ${signal}, encerrando`);
  void closeDatabase().finally(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Um erro solto nao pode derrubar um processo que precisa ficar semanas no ar.
process.on('unhandledRejection', (reason) => log.error('promise rejeitada sem tratamento', reason));
process.on('uncaughtException', (err) => log.error('excecao nao capturada', err));

main().catch((err) => {
  log.error('falha fatal na inicializacao', err);
  process.exit(1);
});
