import * as path from 'path';
import * as dotenv from 'dotenv';
import { ATIVOS, type Ativo } from './domain/cambio';

dotenv.config();

const root = path.resolve(__dirname, '..');

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** De N em N horas, a partir da meia-noite: 1 -> 00:00, 01:00, ... 23:00. */
function everyHours(interval: number): Array<{ hour: number; minute: number }> {
  const step = Math.min(24, Math.max(1, Math.trunc(interval)));
  const times: Array<{ hour: number; minute: number }> = [];
  for (let hour = 0; hour < 24; hour += step) times.push({ hour, minute: 0 });
  return times;
}

/** "08:00,12:00" -> [{ hour: 8, minute: 0 }, { hour: 12, minute: 0 }] */
function parseTimes(raw: string): Array<{ hour: number; minute: number }> {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t);
      if (!m) throw new Error(`SCHEDULE_TIMES: horario invalido "${t}" (use HH:MM)`);
      const hour = Number(m[1]);
      const minute = Number(m[2]);
      if (hour > 23 || minute > 59) throw new Error(`SCHEDULE_TIMES: horario fora do intervalo "${t}"`);
      return { hour, minute };
    })
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

export const config = {
  paths: {
    root,
    data: path.join(root, 'data'),
    db: path.join(root, 'data', 'passagens.db'),
    logs: path.join(root, 'data', 'app.log'),
    public: path.join(root, 'public'),
  },
  providerOrder: (process.env.PROVIDER_ORDER || 'kiwi,maxmilhas,google')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean),
  /**
   * "merge"    consulta todos os provedores e junta as ofertas (padrao);
   * "failover" usa o primeiro que responder e ignora os demais.
   */
  providerMode: (process.env.PROVIDER_MODE || 'merge').toLowerCase() === 'failover'
    ? ('failover' as const)
    : ('merge' as const),
  travelpayouts: {
    token: process.env.TRAVELPAYOUTS_TOKEN || '',
  },
  amadeus: {
    clientId: process.env.AMADEUS_CLIENT_ID || '',
    clientSecret: process.env.AMADEUS_CLIENT_SECRET || '',
    baseUrl:
      (process.env.AMADEUS_ENV || 'test') === 'production'
        ? 'https://api.amadeus.com'
        : 'https://test.api.amadeus.com',
  },
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: num('DB_PORT', 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME || 'monitor',
    /** O TypeORM cria e ajusta as tabelas sozinho. Desligue para usar migrations. */
    synchronize: (process.env.DB_SYNCHRONIZE || 'true').toLowerCase() !== 'false',
    logging: (process.env.DB_LOGGING || '').toLowerCase() === 'true',
  },
  /**
   * SCHEDULE_TIMES manda quando existe (horarios exatos). Sem ele, a agenda e
   * de N em N horas — que e o modo normal de uso.
   */
  schedule: {
    times: process.env.SCHEDULE_TIMES
      ? parseTimes(process.env.SCHEDULE_TIMES)
      : everyHours(num('SCHEDULE_EVERY_HOURS', 1)),
    timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
  },
  alerts: {
    dropPct: num('DROP_ALERT_PCT', 10),
    cooldownHours: num('NOTIFY_COOLDOWN_HOURS', 6),
  },
  /**
   * Copia diaria do banco. O horario padrao e de madrugada porque o dump
   * concorre com as consultas, e as 04:00 nao tem ninguem olhando o painel.
   */
  backup: {
    enabled: (process.env.BACKUP_ENABLED || 'true').toLowerCase() !== 'false',
    dir: process.env.BACKUP_DIR || path.join(root, 'data', 'backups'),
    keep: Math.max(1, num('BACKUP_KEEP', 7)),
    time: parseTimes(process.env.BACKUP_TIME || '04:00')[0] ?? { hour: 4, minute: 0 },
    /** Vazio = procura na instalacao padrao do MySQL e depois no PATH. */
    mysqldump: process.env.MYSQLDUMP_PATH || '',
  },
  /**
   * Depois de N dias, cada consulta guarda so a melhor oferta. O historico de
   * precos nao muda com isso — ele e o menor preco de cada consulta. 0 desliga.
   */
  retention: {
    offerDays: Math.max(0, num('OFFERS_RETENTION_DAYS', 30)),
  },
  /**
   * Teto de datas consultadas por rota em cada rodada, quando a rota tem janela.
   * Cada data e uma chamada a mais em cada provedor — e este e o unico botao
   * para segurar o custo de uma janela larga sem mexer nas rotas uma a uma.
   * 15 e o maximo que a validacao permite cadastrar (janela de 7 dias).
   */
  search: {
    maxDatesPerRoute: Math.max(1, num('SEARCH_MAX_DATES', 15)),
  },
  /**
   * Depois de tantas falhas seguidas, a fonte fica de castigo. Insistir de hora
   * em hora numa API que ja recusou tres vezes troca erro temporario por
   * bloqueio permanente.
   */
  providers: {
    breakerFailures: Math.max(1, num('PROVIDER_BREAKER_FAILURES', 3)),
    breakerMinutes: Math.max(1, num('PROVIDER_BREAKER_MINUTES', 15)),
    retries: Math.max(1, num('PROVIDER_RETRIES', 3)),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  /**
   * Cambio. Os custos sao os da plataforma onde a compra acontece de verdade:
   * errar aqui faz o painel mandar comprar operacoes que nascem no prejuizo.
   */
  cambio: {
    enabled: (process.env.CAMBIO_ENABLED || 'true').toLowerCase() !== 'false',
    ativos: (process.env.CAMBIO_ATIVOS || 'DOLA11,USD,EUR')
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter((m): m is Ativo => (ATIVOS as string[]).includes(m)),
    historicoAnos: Math.max(1, num('CAMBIO_HISTORICO_ANOS', 5)),
    /**
     * Conta global (Wise, Nomad, Inter, C6): IOF de 3,5% na remessa para conta
     * propria (Decreto 12.499/2025) e 0,38% na volta para reais.
     * ETF na B3: sem IOF; o custo e o spread do book mais emolumentos, e o
     * ganho paga 15% de IR na venda.
     */
    custos: {
      conta: {
        iofCompraPct: num('CAMBIO_CONTA_IOF_COMPRA_PCT', 3.5),
        iofVendaPct: num('CAMBIO_CONTA_IOF_VENDA_PCT', 0.38),
        spreadPct: num('CAMBIO_CONTA_SPREAD_PCT', 1),
        irGanhoPct: num('CAMBIO_CONTA_IR_PCT', 0),
      },
      etf: {
        iofCompraPct: 0,
        iofVendaPct: 0,
        spreadPct: num('CAMBIO_ETF_SPREAD_PCT', 0.2),
        irGanhoPct: num('CAMBIO_ETF_IR_PCT', 15),
      },
    },
    sinal: {
      janelaCurta: Math.max(2, num('CAMBIO_JANELA_CURTA', 4)),
      janelaLonga: Math.max(20, num('CAMBIO_JANELA_LONGA', 90)),
      zonaCompra: num('CAMBIO_ZONA_COMPRA', 0.2),
      zonaVenda: num('CAMBIO_ZONA_VENDA', 0.8),
      alvoLucroPct: num('CAMBIO_ALVO_LUCRO_PCT', 3),
      stopPct: num('CAMBIO_STOP_PCT', 8),
    },
    /** Um sinal igual ao ultimo avisado so repete depois deste intervalo. */
    alertaCooldownHoras: num('CAMBIO_ALERTA_COOLDOWN_HORAS', 24),
  },
  /**
   * Radar de cripto. Custos padrao sao os do BTG: ate 1% por ordem, em cada
   * perna, mais um spread embutido na cotacao que nao da para medir de fora —
   * por isso o padrao e conservador. Ate R$ 35 mil de venda por mes o ganho e
   * isento de IR.
   */
  cripto: {
    enabled: (process.env.CRIPTO_ENABLED || 'true').toLowerCase() !== 'false',
    moedas: (process.env.CRIPTO_MOEDAS || 'BTC,ETH,SOL,XRP,ADA,LINK,DOT,AVAX,LTC,UNI,AAVE')
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter((m) => /^[A-Z0-9]{2,10}$/.test(m)),
    /** Desde quando baixar o historico na primeira vez. */
    historicoDesde: process.env.CRIPTO_HISTORICO_DESDE || '2018-01-01',
    custos: {
      iofCompraPct: 0,
      iofVendaPct: 0,
      /* Taxa e spread entram juntos: os dois encarecem cada perna do mesmo jeito. */
      spreadPct: num('CRIPTO_TAXA_PCT', 1) + num('CRIPTO_SPREAD_PCT', 0.5),
      irGanhoPct: num('CRIPTO_IR_PCT', 0),
    },
    /* Padrao escolhido no teste fora da amostra (npm run estudo-cripto): o que
       se sustentou depois de 2024-07 foi queda grande, alvo curto e 4 partes. */
    grade: {
      janelaQueda: Math.max(2, num('CRIPTO_JANELA_QUEDA', 7)),
      quedaPct: num('CRIPTO_QUEDA_PCT', 20),
      alvoPct: num('CRIPTO_ALVO_PCT', 3),
      stopPct: num('CRIPTO_STOP_PCT', 25),
      partes: Math.max(1, Math.trunc(num('CRIPTO_PARTES', 4))),
      espacamentoPct: num('CRIPTO_ESPACAMENTO_PCT', 20),
      tendenciaDias: Math.max(20, num('CRIPTO_TENDENCIA_DIAS', 100)),
      filtroTendencia: (process.env.CRIPTO_FILTRO_TENDENCIA || 'false').toLowerCase() === 'true',
    },
    /** Dias que a recuperacao tem para acontecer na estatistica do radar. */
    horizonteDias: Math.max(3, num('CRIPTO_HORIZONTE_DIAS', 14)),
    /** Taxa historica de recuperacao abaixo da qual a queda nao vira aviso. */
    taxaMinima: num('CRIPTO_TAXA_MINIMA', 0.6),
    alertaCooldownHoras: num('CRIPTO_ALERTA_COOLDOWN_HORAS', 24),
  },
  port: num('PORT', 3777),
};

export type Config = typeof config;
