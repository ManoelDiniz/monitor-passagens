/**
 * Janela de datas de ida.
 *
 * A rota guarda uma data-ancora (`depart_date`) e quantos dias para cada lado
 * ela aceita (`depart_window_days`). Janela 0 e o comportamento de sempre: uma
 * data so.
 *
 * A volta nao tem janela propria — ela desliza junto com a ida mantendo a mesma
 * quantidade de noites que foi cadastrada. E assim que se planeja viagem de
 * verdade ("dez dias, tanto faz a semana"), e evita a explosao combinatoria:
 * uma janela de 7 dias nas duas pontas seriam 49 consultas por rota.
 */

const DIA_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Aritmetica em UTC de proposito: "YYYY-MM-DD" nao carrega hora, e somar dias
 * no fuso local erra por um dia nas viradas de horario de verao.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DIA_MS).toISOString().slice(0, 10);
}

/** Noites entre ida e volta. E o que mantem a duracao da viagem ao deslizar. */
export function nightsBetween(depart: string, ret: string): number {
  return Math.round((Date.parse(`${ret}T00:00:00Z`) - Date.parse(`${depart}T00:00:00Z`)) / DIA_MS);
}

/** Todos os dias entre duas datas, inclusive as pontas. */
export function datesInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/**
 * Hoje no fuso da maquina, nao em UTC. `toISOString()` devolveria amanha a
 * partir das 21h em Sao Paulo, e a janela cortaria um dia que ainda e valido.
 */
export function hojeISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface Janela {
  /** Datas de ida a consultar, em ordem. Nunca vem vazia. */
  dates: string[];
  /** Dias descartados por ja terem passado. */
  passados: number;
  /** Dias descartados pelo teto de consultas por rodada. */
  cortados: number;
}

export interface JanelaOpcoes {
  /** Data de referencia para descartar o passado. */
  hoje?: string;
  /** Teto de datas por rodada — cada data e uma chamada a mais nos provedores. */
  max?: number;
}

/**
 * Expande a ancora na lista de dias a consultar.
 *
 * Duas podas, ambas contadas no retorno para nunca sumirem em silencio: dia que
 * ja passou nao tem voo para comprar, e o teto protege a cota dos provedores.
 * O corte pelo teto tira as pontas primeiro, preservando os dias mais proximos
 * da data que a pessoa realmente escolheu.
 *
 * Se a poda levar tudo — janela inteira no passado — sobra a ancora sozinha,
 * que e exatamente como a rota se comportava antes de existir janela.
 */
export function windowDates(
  anchor: string,
  windowDays: number,
  { hoje = hojeISO(), max = 15 }: JanelaOpcoes = {},
): Janela {
  const raio = Math.max(0, Math.trunc(windowDays));
  if (raio === 0) return { dates: [anchor], passados: 0, cortados: 0 };

  const todos = datesInclusive(addDays(anchor, -raio), addDays(anchor, raio));

  const futuros = todos.filter((date) => date >= hoje);
  if (futuros.length === 0) return { dates: [anchor], passados: todos.length, cortados: 0 };

  const teto = Math.max(1, Math.trunc(max));
  const dates = [...futuros]
    .sort((a, b) => Math.abs(nightsBetween(anchor, a)) - Math.abs(nightsBetween(anchor, b)))
    .slice(0, teto)
    .sort();

  return {
    dates,
    passados: todos.length - futuros.length,
    cortados: futuros.length - dates.length,
  };
}
