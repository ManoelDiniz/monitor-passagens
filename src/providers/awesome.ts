import type { Moeda } from '../domain/cambio';
import { fetchJson } from './types';

/**
 * AwesomeAPI — cotacao comercial quase em tempo real, sem chave.
 *
 * Cobre o que a PTAX nao cobre: o preco de agora, no meio do dia. Usa o "ask"
 * (o preco de quem compra a moeda), que e o lado em que o usuario entra.
 */

const ENDPOINT = 'https://economia.awesomeapi.com.br/json/last';

export interface CotacaoAoVivo {
  moeda: Moeda;
  valor: number;
  /** Instante da cotacao no horario de Brasilia, "AAAA-MM-DD HH:MM:SS". */
  em: string;
}

export async function cotacoesAoVivo(moedas: Moeda[]): Promise<CotacaoAoVivo[]> {
  if (moedas.length === 0) return [];

  const data = await fetchJson(`${ENDPOINT}/${moedas.map((m) => `${m}-BRL`).join(',')}`);

  return moedas
    .map((moeda) => data?.[`${moeda}BRL`])
    .filter((q: any) => q && Number(q.ask) > 0)
    .map((q: any) => ({ moeda: q.code as Moeda, valor: Number(q.ask), em: String(q.create_date) }));
}
