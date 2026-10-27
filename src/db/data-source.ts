import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../config';
import { log } from '../logger';
import { CambioAlerta } from './entities/cambio-alerta.entity';
import { CambioCotacao } from './entities/cambio-cotacao.entity';
import { CambioOperacao } from './entities/cambio-operacao.entity';
import { CriptoOperacao } from './entities/cripto-operacao.entity';
import { Check } from './entities/check.entity';
import { Notification } from './entities/notification.entity';
import { Offer } from './entities/offer.entity';
import { Route } from './entities/route.entity';
import { Run } from './entities/run.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.name,
  entities: [Route, Check, Offer, Notification, Run, CambioCotacao, CambioOperacao, CambioAlerta, CriptoOperacao],
  synchronize: config.database.synchronize,
  logging: config.database.logging,
  charset: 'utf8mb4',
  /* Instantes viajam em UTC nos dois sentidos: assim a hora gravada nao muda
     de significado se o fuso do Windows mudar. */
  timezone: 'Z',
  extra: {
    /* Colunas DATE voltam como "YYYY-MM-DD" cru. Data de voo e dia de
       calendario — passar por Date so criaria chance de trocar o dia. */
    dateStrings: ['DATE'],
  },
});

const CONNECT_ATTEMPTS = 12;
const CONNECT_WAIT_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tenta de novo antes de desistir: o monitor sobe no logon do Windows e pode
 * chegar antes do servico do MySQL estar aceitando conexao. Morrer nessa hora
 * deixaria o monitor fora do ar ate alguem reparar e reiniciar na mao.
 */
export async function initDatabase(): Promise<void> {
  const alvo = `mysql://${config.database.host}:${config.database.port}/${config.database.name}`;

  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
    try {
      await AppDataSource.initialize();
      log.info(`banco conectado: ${alvo}`);
      return;
    } catch (err) {
      if (attempt === CONNECT_ATTEMPTS) throw err;
      log.warn(
        `banco indisponivel (tentativa ${attempt}/${CONNECT_ATTEMPTS}), nova tentativa em ${CONNECT_WAIT_MS / 1000}s`,
        (err as Error).message,
      );
      await sleep(CONNECT_WAIT_MS);
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
}
