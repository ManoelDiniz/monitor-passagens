import type { Ponto } from '../domain/cambio';
import { fetchJson } from './types';

/**
 * Yahoo Finance — cotacao de ativos da B3 (aqui, o ETF DOLA11).
 *
 * E a API do grafico que o proprio site usa, nao uma API publicada: sem chave,
 * mas pode mudar sem aviso. Todo o acoplamento fica neste arquivo.
 */

const ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface Grafico {
  /** Fechamentos diarios, do mais antigo para o mais novo. */
  pontos: Ponto[];
  /** Ultimo preco negociado, no pregao corrente quando ele esta aberto. */
  atual: number | null;
}

/** `ticker` sem o sufixo: "DOLA11" vira "DOLA11.SA". */
/** `range` no formato do Yahoo: "1mo", "1y", "5y". */
export async function graficoB3(ticker: string, range: string): Promise<Grafico> {
  const url = `${ENDPOINT}/${ticker}.SA?range=${range}&interval=1d`;
  const data = await fetchJson(url, { headers: { 'User-Agent': UA } });

  const r = data?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo sem dados para ${ticker}: ${JSON.stringify(data?.chart?.error ?? null)}`);

  /* O timestamp e o inicio do pregao em UTC; somar o offset da bolsa da o dia
     de calendario de Sao Paulo sem depender do fuso desta maquina. */
  const offset = Number(r.meta?.gmtoffset ?? -10800);
  const closes: Array<number | null> = r.indicators?.quote?.[0]?.close ?? [];

  const pontos: Ponto[] = (r.timestamp ?? [])
    .map((ts: number, i: number) => ({
      dia: new Date((ts + offset) * 1000).toISOString().slice(0, 10),
      valor: Number(closes[i]),
    }))
    .filter((p: Ponto) => Number.isFinite(p.valor) && p.valor > 0);

  const atual = Number(r.meta?.regularMarketPrice);
  return { pontos, atual: Number.isFinite(atual) && atual > 0 ? atual : null };
}
