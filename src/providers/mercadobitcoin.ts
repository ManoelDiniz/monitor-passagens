import type { Ponto } from '../domain/cambio';
import { fetchJson } from './types';

/**
 * Mercado Bitcoin — API publica v4, sem chave. Historico em reais desde 2013
 * para o BTC; as demais moedas desde que foram listadas.
 *
 * O candle do dia corrente vem aberto, com o preco do momento no fechamento:
 * gravado de hora em hora, ele serve de cotacao ao vivo sem outra fonte.
 */

const ENDPOINT = 'https://api.mercadobitcoin.net/api/v4/candles';

/** Fechamentos diarios de `de` (AAAA-MM-DD) ate agora. */
export async function candlesDiarios(moeda: string, de: string): Promise<Ponto[]> {
  const from = Math.floor(new Date(`${de}T00:00:00Z`).getTime() / 1000);
  const to = Math.floor(Date.now() / 1000);
  const data = await fetchJson(`${ENDPOINT}?symbol=${moeda}-BRL&resolution=1d&from=${from}&to=${to}`);

  const t: number[] = data?.t ?? [];
  const c: string[] = data?.c ?? [];
  return t
    .map((ts, i) => ({ dia: new Date(ts * 1000).toISOString().slice(0, 10), valor: Number(c[i]) }))
    .filter((p) => Number.isFinite(p.valor) && p.valor > 0);
}
