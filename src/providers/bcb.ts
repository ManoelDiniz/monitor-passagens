import type { Moeda, Ponto } from '../domain/cambio';
import { fetchJson, fetchText } from './types';

/**
 * Banco Central do Brasil — dados abertos, sem chave e sem cadastro.
 *
 * PTAX: a taxa oficial de cambio, com boletins de abertura, intermediarios e
 * fechamento. So o fechamento entra no historico; e ele que o mercado usa
 * como "o dolar do dia".
 *
 * CDI (serie 12 do SGS): taxa diaria em %, a regua contra a qual o modulo de
 * cambio se mede. Se nao ganhar dela, nao vale o risco.
 */

const PTAX =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/' +
  'CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)';

const SGS_CDI = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados';

/** A PTAX pede MM-DD-AAAA; o SGS, DD/MM/AAAA. Aqui dentro tudo e AAAA-MM-DD. */
const paraPtax = (dia: string) => `${dia.slice(5, 7)}-${dia.slice(8, 10)}-${dia.slice(0, 4)}`;
const paraSgs = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
const deSgs = (data: string) => `${data.slice(6, 10)}-${data.slice(3, 5)}-${data.slice(0, 2)}`;

function somaDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Pedidos de ate um ano: a PTAX responde periodos longos, mas devolve todos
 * os boletins intermediarios junto — cinco anos de uma vez e um payload pesado
 * que a API as vezes corta no meio.
 */
const BLOCO_DIAS = 365;

async function ptaxBloco(moeda: Moeda, de: string, ate: string): Promise<Ponto[]> {
  const url =
    `${PTAX}?@moeda='${moeda}'&@dataInicial='${paraPtax(de)}'` +
    `&@dataFinalCotacao='${paraPtax(ate)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao,tipoBoletim`;
  const data = await fetchJson(url, { timeoutMs: 60_000 });

  return (data?.value ?? [])
    .filter((b: any) => b.tipoBoletim === 'Fechamento' && Number(b.cotacaoVenda) > 0)
    .map((b: any) => ({ dia: String(b.dataHoraCotacao).slice(0, 10), valor: Number(b.cotacaoVenda) }));
}

/** Fechamentos PTAX de `de` ate `ate`, inclusive, do mais antigo para o mais novo. */
export async function ptaxFechamentos(moeda: Moeda, de: string, ate: string): Promise<Ponto[]> {
  const pontos: Ponto[] = [];
  for (let inicio = de; inicio <= ate; inicio = somaDias(inicio, BLOCO_DIAS)) {
    const fim = somaDias(inicio, BLOCO_DIAS - 1);
    pontos.push(...(await ptaxBloco(moeda, inicio, fim < ate ? fim : ate)));
  }
  return pontos;
}

/**
 * O SGS as vezes responde 200 com uma pagina XML no lugar do JSON — instabilidade
 * do lado do BC, que some na tentativa seguinte. Sem isto o erro chegava como
 * "Unexpected token <" e a comparacao com o CDI sumia da tela.
 */
async function sgsJson(url: string, tentativas = 3): Promise<any[]> {
  for (let i = 1; ; i++) {
    const texto = (await fetchText(url, { timeoutMs: 60_000, headers: { Accept: 'application/json' } })).trim();
    if (texto.startsWith('[')) return JSON.parse(texto);
    // Periodo sem taxa publicada ainda (uma compra feita hoje): nao e erro, e zero dias.
    if (texto.includes('Value(s) not found')) return [];
    if (i >= tentativas) throw new Error(`SGS respondeu sem JSON: ${texto.slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 1_500 * i));
  }
}

/**
 * CDI diario em % por dia util. O SGS limita consultas diarias a 10 anos por
 * pedido, entao periodos maiores vao em blocos.
 */
export async function cdiDiario(de: string, ate: string): Promise<Map<string, number>> {
  const taxas = new Map<string, number>();
  for (let inicio = de; inicio <= ate; inicio = somaDias(inicio, 3650)) {
    const fim = somaDias(inicio, 3649);
    const url = `${SGS_CDI}?formato=json&dataInicial=${paraSgs(inicio)}&dataFinal=${paraSgs(fim < ate ? fim : ate)}`;
    for (const row of await sgsJson(url)) taxas.set(deSgs(String(row.data)), Number(row.valor));
  }
  return taxas;
}
