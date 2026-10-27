import { ValidationError } from './errors';

const IATA = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Teto da flexibilidade de datas. Cada dia da janela e uma consulta a mais por
 * rodada em cada provedor: 7 ja significa 15 dias, ou seja, 15x o custo de uma
 * rota de data fixa. Acima disso a cota das fontes acaba antes do dia.
 */
export const MAX_WINDOW_DAYS = 7;

/** Campos que o usuario controla numa rota. */
export interface RouteFields {
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  depart_window_days: number;
  adults: number;
  price_limit: number | null;
  max_stops: number;
  require_checked_bag: number;
  notes: string | null;
}

export type RouteCreateInput = RouteFields;
export type RouteUpdateInput = Partial<RouteFields> & { active?: number };

/** Trocar qualquer um destes muda a consulta e pede uma releitura de preco. */
export const SEARCH_FIELDS: ReadonlyArray<keyof RouteFields> = [
  'origin',
  'destination',
  'depart_date',
  'return_date',
  'depart_window_days',
  'adults',
  'max_stops',
  'require_checked_bag',
];

const asRecord = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

const isBlank = (value: unknown): boolean => value === '' || value === null || value === undefined;

const iata = (value: unknown): string => String(value ?? '').trim().toUpperCase();

function optionalNumber(
  value: unknown,
  label: string,
  problems: string[],
  { min, max }: { min?: number; max?: number } = {},
): number | null {
  if (isBlank(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    problems.push(`${label} precisa ser um numero`);
    return null;
  }
  if (min !== undefined && parsed < min) {
    problems.push(`${label} nao pode ser menor que ${min}`);
    return null;
  }
  if (max !== undefined && parsed > max) {
    problems.push(`${label} nao pode ser maior que ${max}`);
    return null;
  }
  return parsed;
}

/** Aplica as regras que valem para o par de campos, ja normalizados. */
function checkConsistency(fields: Partial<RouteFields>, problems: string[]): void {
  const { origin, destination, depart_date: depart, return_date: back } = fields;

  if (origin !== undefined && !IATA.test(origin)) {
    problems.push('origem deve ser um codigo IATA de 3 letras (ex: FOR)');
  }
  if (destination !== undefined && !IATA.test(destination)) {
    problems.push('destino deve ser um codigo IATA de 3 letras (ex: GRU)');
  }
  if (origin !== undefined && destination !== undefined && origin === destination) {
    problems.push('origem e destino nao podem ser iguais');
  }
  if (depart !== undefined && !ISO_DATE.test(depart)) {
    problems.push('data de ida invalida');
  }
  if (back != null && !ISO_DATE.test(back)) {
    problems.push('data de volta invalida');
  }
  if (depart !== undefined && back != null && back < depart) {
    problems.push('a volta nao pode ser antes da ida');
  }
}

export function parseRouteCreate(body: unknown): RouteCreateInput {
  const b = asRecord(body);
  const problems: string[] = [];

  const fields: RouteFields = {
    origin: iata(b.origin),
    destination: iata(b.destination),
    depart_date: String(b.depart_date ?? '').trim(),
    return_date: isBlank(b.return_date) ? null : String(b.return_date).trim(),
    depart_window_days:
      optionalNumber(b.depart_window_days, 'flexibilidade de datas', problems, {
        min: 0,
        max: MAX_WINDOW_DAYS,
      }) ?? 0,
    adults: optionalNumber(b.adults, 'passageiros', problems, { min: 1, max: 9 }) ?? 1,
    price_limit: optionalNumber(b.price_limit, 'limite de preco', problems, { min: 0 }),
    max_stops: optionalNumber(b.max_stops, 'conexoes', problems, { min: 0, max: 3 }) ?? 2,
    require_checked_bag: b.require_checked_bag ? 1 : 0,
    notes: isBlank(b.notes) ? null : String(b.notes).trim(),
  };

  checkConsistency(fields, problems);
  if (problems.length) throw new ValidationError(problems);

  return fields;
}

/**
 * No PATCH so entra o que veio no corpo — mandar a rota inteira de volta
 * apagaria campos que a tela daquele momento nao conhece.
 */
export function parseRouteUpdate(body: unknown, current: RouteFields): RouteUpdateInput {
  const b = asRecord(body);
  const problems: string[] = [];
  const patch: RouteUpdateInput = {};

  if ('origin' in b) patch.origin = iata(b.origin);
  if ('destination' in b) patch.destination = iata(b.destination);
  if ('depart_date' in b) patch.depart_date = String(b.depart_date ?? '').trim();
  if ('return_date' in b) {
    patch.return_date = isBlank(b.return_date) ? null : String(b.return_date).trim();
  }
  if ('depart_window_days' in b) {
    patch.depart_window_days =
      optionalNumber(b.depart_window_days, 'flexibilidade de datas', problems, {
        min: 0,
        max: MAX_WINDOW_DAYS,
      }) ?? 0;
  }
  if ('adults' in b) {
    patch.adults = optionalNumber(b.adults, 'passageiros', problems, { min: 1, max: 9 }) ?? 1;
  }
  if ('price_limit' in b) {
    patch.price_limit = optionalNumber(b.price_limit, 'limite de preco', problems, { min: 0 });
  }
  if ('max_stops' in b) {
    patch.max_stops = optionalNumber(b.max_stops, 'conexoes', problems, { min: 0, max: 3 }) ?? 2;
  }
  if ('require_checked_bag' in b) patch.require_checked_bag = b.require_checked_bag ? 1 : 0;
  if ('notes' in b) patch.notes = isBlank(b.notes) ? null : String(b.notes).trim();
  if ('active' in b) patch.active = b.active ? 1 : 0;

  if (Object.keys(patch).length === 0) {
    throw new ValidationError(['nenhum campo para alterar']);
  }

  // Valida o resultado final, nao so o pedaco enviado: mudar so a volta
  // ainda pode deixa-la antes da ida que ja estava gravada.
  checkConsistency({ ...current, ...patch }, problems);
  if (problems.length) throw new ValidationError(problems);

  return patch;
}

/** Diz se a alteracao pede uma nova consulta aos provedores. */
export function affectsSearch(patch: RouteUpdateInput): boolean {
  return SEARCH_FIELDS.some((field) => field in patch);
}
