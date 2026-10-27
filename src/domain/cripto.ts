/**
 * Regras do radar de cripto: achar quedas que, pelo historico da propria
 * moeda, costumam ser seguidas de alta — e operar em partes, para uma queda
 * que continua nao pegar o dinheiro todo no pior preco.
 *
 * Funcoes puras como em cambio.ts, cujos custos e conversoes elas reaproveitam.
 * Series sempre do dia mais antigo para o mais novo.
 */
import { type Custos, empatePct, type Ponto, quantidadeComprada, reaisRecebidos } from './cambio';

export interface ParametrosGrade {
  /** Dias para tras em que se procura o topo recente. */
  janelaQueda: number;
  /** Queda desde o topo recente que dispara a primeira compra, em %. */
  quedaPct: number;
  /** Lucro liquido de cada parte que dispara a venda dela, em %. */
  alvoPct: number;
  /** Prejuizo liquido de uma parte que manda vende-la, em %. 0 desliga. */
  stopPct: number;
  /** Em quantas partes o capital e dividido. */
  partes: number;
  /** Queda abaixo da ultima parte comprada para comprar a proxima, em %. */
  espacamentoPct: number;
  /** Media movel que define a tendencia de longo prazo, em dias. */
  tendenciaDias: number;
  /** So compra a primeira parte com o preco acima da media longa. */
  filtroTendencia: boolean;
}

const pct = (v: number) => v / 100;

function media(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Queda atual desde o maior preco dos ultimos `janela` dias, em % (positivo = caiu). */
export function quedaDoTopo(serie: number[], i: number, janela: number): number {
  const inicio = Math.max(0, i - janela + 1);
  let topo = serie[inicio];
  for (let k = inicio + 1; k <= i; k++) if (serie[k] > topo) topo = serie[k];
  return (1 - serie[i] / topo) * 100;
}

/** null quando ainda nao ha dias suficientes para a media. */
export function acimaDaMedia(serie: number[], i: number, dias: number): boolean | null {
  if (i + 1 < dias) return null;
  return serie[i] >= media(serie.slice(i + 1 - dias, i + 1));
}

export interface EstatisticaQuedas {
  quedaPct: number;
  janelaQueda: number;
  horizonteDias: number;
  /** Quedas desse tamanho no historico (sem contar a mesma queda duas vezes). */
  ocorrencias: number;
  /** Quantas subiram alem dos custos mais o alvo dentro do horizonte. */
  recuperou: number;
  /** As mesmas contas so com as quedas que aconteceram com tendencia de alta. */
  ocorrenciasEmAlta: number;
  recuperouEmAlta: number;
  /** Mediana de dias ate o alvo, entre as que chegaram. */
  diasMediana: number | null;
  /** Media de quanto ainda caiu depois do gatilho, antes de subir, em %. */
  quedaExtraMediaPct: number;
}

/**
 * "Quando esta moeda caiu X% em N dias, quantas vezes subiu o suficiente para
 * pagar as taxas e dar o alvo?" Cada queda conta uma vez: depois de um
 * gatilho, o proximo so vale passado o horizonte.
 */
export function estatisticaQuedas(
  serie: number[],
  p: Pick<ParametrosGrade, 'janelaQueda' | 'quedaPct' | 'alvoPct' | 'tendenciaDias'>,
  c: Custos,
  horizonteDias = 14,
): EstatisticaQuedas {
  const alvo = 1 + (empatePct(c) + p.alvoPct) / 100;
  let ocorrencias = 0;
  let recuperou = 0;
  let ocorrenciasEmAlta = 0;
  let recuperouEmAlta = 0;
  const dias: number[] = [];
  let quedaExtra = 0;

  for (let i = p.janelaQueda; i < serie.length - horizonteDias; i++) {
    if (quedaDoTopo(serie, i, p.janelaQueda) < p.quedaPct) continue;

    const preco = serie[i];
    let chegou: number | null = null;
    let minimo = preco;
    for (let k = 1; k <= horizonteDias; k++) {
      const v = serie[i + k];
      if (chegou == null) minimo = Math.min(minimo, v);
      if (chegou == null && v >= preco * alvo) chegou = k;
    }

    ocorrencias++;
    quedaExtra += (1 - minimo / preco) * 100;
    if (chegou != null) {
      recuperou++;
      dias.push(chegou);
    }
    if (acimaDaMedia(serie, i, p.tendenciaDias)) {
      ocorrenciasEmAlta++;
      if (chegou != null) recuperouEmAlta++;
    }
    i += horizonteDias - 1;
  }

  dias.sort((a, b) => a - b);
  return {
    quedaPct: p.quedaPct,
    janelaQueda: p.janelaQueda,
    horizonteDias,
    ocorrencias,
    recuperou,
    ocorrenciasEmAlta,
    recuperouEmAlta,
    diasMediana: dias.length ? dias[Math.floor(dias.length / 2)] : null,
    quedaExtraMediaPct: ocorrencias ? quedaExtra / ocorrencias : 0,
  };
}

export interface Lote {
  dia: string;
  preco: number;
  quantidade: number;
  /** Reais que saíram na compra, com as taxas. */
  custo: number;
}

/** Preco em que vender o lote da `resultadoPct` liquido. */
export function precoDoLote(lote: Lote, resultadoPct: number, c: Custos): number {
  const liquido = lote.custo * (1 + resultadoPct / 100);
  const ir = liquido > lote.custo ? pct(c.irGanhoPct) : 0;
  const bruto = (liquido - lote.custo * ir) / (1 - ir);
  return bruto / (lote.quantidade * (1 - pct(c.spreadPct)) * (1 - pct(c.iofVendaPct)));
}

export function resultadoDoLote(lote: Lote, preco: number, c: Custos): number {
  return (reaisRecebidos(lote.quantidade, preco, c, lote.custo) / lote.custo - 1) * 100;
}

export type AcaoGrade =
  | { tipo: 'comprar'; parte: number; motivo: string }
  | { tipo: 'vender'; lote: number; motivo: string }
  | { tipo: 'stop'; lote: number; motivo: string };

const fmt = (v: number) => v.toFixed(1).replace('.', ',');

/**
 * O que fazer hoje, dado o preco, a serie e os lotes abertos. Vendas primeiro:
 * uma parte que bateu o alvo libera dinheiro e vaga para a proxima compra.
 * A compra de uma parte nova so acontece se sobrou vaga e dinheiro.
 */
export function acoesDoDia(
  serie: number[],
  i: number,
  lotes: Lote[],
  p: ParametrosGrade,
  c: Custos,
): AcaoGrade[] {
  const preco = serie[i];
  const acoes: AcaoGrade[] = [];

  lotes.forEach((lote, idx) => {
    const r = resultadoDoLote(lote, preco, c);
    if (r >= p.alvoPct) {
      acoes.push({ tipo: 'vender', lote: idx, motivo: `parte comprada a ${lote.preco} rende ${fmt(r)}% liquido` });
    } else if (p.stopPct > 0 && r <= -p.stopPct) {
      acoes.push({ tipo: 'stop', lote: idx, motivo: `parte comprada a ${lote.preco} perde ${fmt(-r)}%` });
    }
  });

  const restantes = lotes.length - acoes.length;
  if (restantes >= p.partes) return acoes;

  if (restantes === 0) {
    const queda = quedaDoTopo(serie, i, p.janelaQueda);
    if (queda < p.quedaPct) return acoes;
    if (p.filtroTendencia && acimaDaMedia(serie, i, p.tendenciaDias) === false) return acoes;
    acoes.push({
      tipo: 'comprar',
      parte: 1,
      motivo: `caiu ${fmt(queda)}% desde o topo de ${p.janelaQueda} dias`,
    });
  } else {
    const vendidos = new Set(acoes.map((a) => ('lote' in a ? a.lote : -1)));
    const abertos = lotes.filter((_, idx) => !vendidos.has(idx));
    const menor = Math.min(...abertos.map((l) => l.preco));
    if (preco <= menor * (1 - p.espacamentoPct / 100)) {
      acoes.push({
        tipo: 'comprar',
        parte: abertos.length + 1,
        motivo: `caiu ${fmt((1 - preco / menor) * 100)}% abaixo da ultima parte`,
      });
    }
  }

  return acoes;
}

export interface ResultadoGrade {
  inicio: string;
  fim: string;
  capitalInicial: number;
  final: number;
  retornoPct: number;
  cdiFinal: number;
  cdiRetornoPct: number;
  /** Comprar tudo no primeiro dia e segurar ate o fim. */
  segurarFinal: number;
  compras: number;
  vendasNoAlvo: number;
  vendasNoStop: number;
  piorQuedaPct: number;
  /** Retorno de cada mes fechado, em %. */
  meses: Array<{ mes: string; retornoPct: number }>;
  /** Lotes ainda abertos no ultimo dia. */
  lotesAbertos: number;
}

/**
 * A grade no historico, um dia por vez, sem olhar o futuro. O dinheiro fora
 * das partes rende CDI; o que esta em cripto rende so a variacao do preco.
 * Cada parte e um quinhao do patrimonio do dia da compra, para o lucro de um
 * ciclo entrar no tamanho do proximo.
 */
export function backtestGrade(
  pontos: Ponto[],
  cdiDia: Map<string, number>,
  p: ParametrosGrade,
  c: Custos,
  capitalInicial = 100,
): ResultadoGrade | null {
  const inicio = Math.max(p.janelaQueda, p.filtroTendencia ? p.tendenciaDias : 0);
  if (pontos.length <= inicio + 1) return null;

  const serie = pontos.map((pt) => pt.valor);
  let caixa = capitalInicial;
  let cdi = capitalInicial;
  let lotes: Lote[] = [];
  let compras = 0;
  let vendasNoAlvo = 0;
  let vendasNoStop = 0;
  let pico = capitalInicial;
  let piorQueda = 0;

  const meses: Array<{ mes: string; retornoPct: number }> = [];
  let mesAtual = pontos[inicio].dia.slice(0, 7);
  let inicioMes = capitalInicial;

  const patrimonio = (preco: number) =>
    caixa + lotes.reduce((s, l) => s + reaisRecebidos(l.quantidade, preco, c, l.custo), 0);

  for (let i = inicio; i < pontos.length; i++) {
    const { dia, valor } = pontos[i];

    if (i > inicio) {
      /* Cripto negocia todo dia; o CDI so rende em dia util. Dia sem taxa
         (fim de semana, feriado) nao rende — e nao herda a taxa anterior. */
      const taxa = cdiDia.get(pontos[i - 1].dia);
      const fator = 1 + (taxa ?? 0) / 100;
      caixa *= fator;
      cdi *= fator;
    }

    const acoes = acoesDoDia(serie, i, lotes, p, c);

    const saem = new Set<number>();
    for (const acao of acoes) {
      if (acao.tipo === 'comprar') continue;
      const lote = lotes[acao.lote];
      caixa += reaisRecebidos(lote.quantidade, valor, c, lote.custo);
      saem.add(acao.lote);
      if (acao.tipo === 'vender') vendasNoAlvo++;
      else vendasNoStop++;
    }
    lotes = lotes.filter((_, idx) => !saem.has(idx));

    if (acoes.some((a) => a.tipo === 'comprar')) {
      const parte = Math.min(caixa, patrimonio(valor) / p.partes);
      if (parte >= 1) {
        lotes.push({ dia, preco: valor, quantidade: quantidadeComprada(parte, valor, c), custo: parte });
        caixa -= parte;
        compras++;
      }
    }

    const atual = patrimonio(valor);
    pico = Math.max(pico, atual);
    piorQueda = Math.max(piorQueda, (1 - atual / pico) * 100);

    const mes = dia.slice(0, 7);
    if (mes !== mesAtual) {
      const anterior = patrimonio(pontos[i - 1].valor);
      meses.push({ mes: mesAtual, retornoPct: (anterior / inicioMes - 1) * 100 });
      mesAtual = mes;
      inicioMes = anterior;
    }
  }

  const ultimo = pontos[pontos.length - 1];
  const final = patrimonio(ultimo.valor);
  const primeiro = pontos[inicio];

  return {
    inicio: primeiro.dia,
    fim: ultimo.dia,
    capitalInicial,
    final,
    retornoPct: (final / capitalInicial - 1) * 100,
    cdiFinal: cdi,
    cdiRetornoPct: (cdi / capitalInicial - 1) * 100,
    segurarFinal: reaisRecebidos(
      quantidadeComprada(capitalInicial, primeiro.valor, c),
      ultimo.valor,
      c,
      capitalInicial,
    ),
    compras,
    vendasNoAlvo,
    vendasNoStop,
    piorQuedaPct: piorQueda,
    meses,
    lotesAbertos: lotes.length,
  };
}
