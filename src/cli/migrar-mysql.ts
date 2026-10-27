/**
 * Copia o historico do SQLite antigo (data/passagens.db) para o MySQL.
 *
 *   npm run migrar-mysql            aborta se o MySQL ja tiver rotas
 *   npm run migrar-mysql -- --force reexecuta, ignorando o que ja foi copiado
 *
 * Os ids sao preservados: as tabelas se referenciam por id, entao mudar a
 * numeracao quebraria a ligacao entre consulta, oferta e alerta.
 */
import * as fs from 'fs';
import Database from 'better-sqlite3';
import type { EntityTarget, ObjectLiteral } from 'typeorm';
import { config } from '../config';
import { AppDataSource, closeDatabase, initDatabase } from '../db/data-source';
import { Check } from '../db/entities/check.entity';
import { Notification } from '../db/entities/notification.entity';
import { Offer } from '../db/entities/offer.entity';
import { Route } from '../db/entities/route.entity';
import { Run } from '../db/entities/run.entity';

const CHUNK = 50;

/** SQLite guarda instante como texto; "YYYY-MM-DD HH:MM:SS" vem de datetime('now'), que e UTC. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function requireDate(value: string | null, fallback: Date): Date {
  return toDate(value) ?? fallback;
}

async function copy<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  label: string,
  rows: T[],
): Promise<number> {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(14)} nada a copiar`);
    return 0;
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await AppDataSource.createQueryBuilder()
      .insert()
      .into(entity)
      .values(rows.slice(i, i + CHUNK))
      .orIgnore()
      .execute();
  }

  console.log(`  ${label.padEnd(14)} ${rows.length} linha(s)`);
  return rows.length;
}

async function main() {
  const origem = config.paths.db;

  if (!fs.existsSync(origem)) {
    console.error(`Nao achei o banco antigo em ${origem}. Nada para migrar.`);
    process.exit(1);
  }

  const forcar = process.argv.includes('--force');
  const sqlite = new Database(origem, { readonly: true });

  await initDatabase();

  const jaTem = await AppDataSource.getRepository(Route).count();
  if (jaTem > 0 && !forcar) {
    console.error(
      `O MySQL ja tem ${jaTem} rota(s). Rode com --force para copiar mesmo assim ` +
        '(linhas com id repetido sao ignoradas).',
    );
    await closeDatabase();
    process.exit(1);
  }

  const agora = new Date();
  const all = <T>(sql: string): T[] => sqlite.prepare(sql).all() as T[];

  console.log(`\nCopiando ${origem}`);
  console.log(`     para mysql://${config.database.host}:${config.database.port}/${config.database.name}\n`);

  interface RouteRow {
    id: number;
    origin: string;
    destination: string;
    depart_date: string;
    return_date: string | null;
    adults: number;
    price_limit: number | null;
    max_stops: number;
    require_checked_bag: number;
    notes: string | null;
    active: number;
    created_at: string;
  }

  await copy(
    Route,
    'routes',
    all<RouteRow>('SELECT * FROM routes ORDER BY id').map((r) => ({
      ...r,
      created_at: requireDate(r.created_at, agora),
    })) as unknown as Route[],
  );

  interface CheckRow {
    id: number;
    route_id: number;
    checked_at: string;
    provider: string | null;
    status: string;
    duration_ms: number | null;
    error: string | null;
  }

  await copy(
    Check,
    'checks',
    all<CheckRow>('SELECT * FROM checks ORDER BY id').map((c) => ({
      ...c,
      checked_at: requireDate(c.checked_at, agora),
    })) as unknown as Check[],
  );

  interface OfferRow {
    id: number;
    check_id: number;
    route_id: number;
    price: number;
    currency: string;
    airline: string | null;
    cabin: string | null;
    checked_bags: number | null;
    stops_out: number | null;
    stops_ret: number | null;
    depart_at: string | null;
    return_at: string | null;
    link: string | null;
    eligible: number;
    source: string | null;
    /** Existia no SQLite; nao e mais gravado nem copiado — ver offer.entity.ts. */
    raw?: string | null;
  }

  await copy(
    Offer,
    'offers',
    all<OfferRow>('SELECT * FROM offers ORDER BY id').map(({ raw: _raw, ...o }) => ({
      ...o,
      // A moeda e char(3); alguma linha antiga pode ter vindo vazia.
      currency: (o.currency || 'BRL').slice(0, 3),
      depart_at: toDate(o.depart_at),
      return_at: toDate(o.return_at),
    })) as unknown as Offer[],
  );

  interface NotificationRow {
    id: number;
    route_id: number;
    sent_at: string;
    reason: string;
    price: number;
    message: string;
  }

  await copy(
    Notification,
    'notifications',
    all<NotificationRow>('SELECT * FROM notifications ORDER BY id').map((n) => ({
      ...n,
      sent_at: requireDate(n.sent_at, agora),
    })) as unknown as Notification[],
  );

  interface RunRow {
    slot_key: string;
    ran_at: string;
  }

  await copy(
    Run,
    'runs',
    all<RunRow>('SELECT * FROM runs').map((r) => ({
      ...r,
      ran_at: requireDate(r.ran_at, agora),
    })) as unknown as Run[],
  );

  console.log('\nConferindo o que chegou do outro lado:');
  for (const [label, entity] of [
    ['routes', Route],
    ['checks', Check],
    ['offers', Offer],
    ['notifications', Notification],
    ['runs', Run],
  ] as const) {
    const total = await AppDataSource.getRepository(entity).count();
    console.log(`  ${label.padEnd(14)} ${total} linha(s) no MySQL`);
  }

  sqlite.close();
  await closeDatabase();
  console.log('\nPronto. O arquivo SQLite continua intacto, como copia de seguranca.\n');
}

main().catch(async (err) => {
  console.error('\nA migracao falhou:', err);
  await closeDatabase();
  process.exit(1);
});
