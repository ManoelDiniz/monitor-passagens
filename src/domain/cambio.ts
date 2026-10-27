/**
 * Regras do modulo de cambio, sem banco e sem rede: entra serie de cotacoes,
 * sai numero. Tudo aqui e funcao pura para poder ser testado e reusado igual
 * pelo painel, pelo alerta e pelo backtest.
 *
 * Series sempre do dia mais antigo para o mais novo.
 */

/** Moeda de referencia: a serie longa que decide quando o preco esta barato. */
export type Moeda = 'USD' | 'EUR';

/**
 * O que se compra de fato. Dolar e euro em conta global pagam IOF; o DOLA11 e
 * um ETF da B3 que acompanha o dolar sem IOF, e paga IR sobre o ganho.
 */
export type Ativo = 'USD' | 'EUR' | 'DOLA11';

export const ATIVOS: Ativo[] = ['USD', 'EUR', 'DOLA11'];

export interface DescricaoAtivo {
  nome: string;
  /** Serie que alimenta o sinal. O DOLA11 tem pouco historico; o dolar tem decadas. */
  referencia: Moeda;
  perfil: 'conta' | 'etf';
  /** Unidade de quantidade, para o painel escrever "20,08 USD" ou "9 cotas". */
  unidade: string;
}

export const DESCRICAO: Record<Ativo, DescricaoAtivo> = {
  DOLA11: { nome: 'ETF de dólar DOLA11 (B3)', referencia: 'USD', perfil: 'etf', unidade: 'cotas' },
  USD: { nome: 'Dólar em conta global', referencia: 'USD', perfil: 'conta', unidade: 'USD' },
  EUR: { nome: 'Euro em conta global', referencia: 'EUR', perfil: 'conta', unidade: 'EUR' },
};

export interface Ponto {
  dia: string;
  valor: number;
}

/** Custos em porcentagem (3.5 = 3,5%). */
export interface Custos {
  iofCompraPct: number;
  iofVendaPct: number;
  /** Diferenca entre a cotacao de referencia e o que a plataforma cobra, em cada perna. */
  spreadPct: number;
  /** Imposto sobre o lucro na venda. Zero quando o ganho fica isento ou e declarado a parte. */
  irGanhoPct: number;
}

export interface ParametrosSinal {
  /** Janela da tendencia curta, em pregoes. */
  janelaCurta: number;
  /** Janela que define "barato" e "caro", em pregoes. */
  janelaLonga: number;
  /** Ate onde, na faixa da janela longa, o preco conta como barato (0..1). */
  zonaCompra: number;
  zonaVenda: number;
  /** Lucro liquido, alem do custo de ida e volta, que justifica vender. */
  alvoLucroPct: number;
  /** Prejuizo liquido que manda sair, para a perda nao crescer sem limite. */
  stopPct: number;
}

const pct = (v: number) => v / 100;

/** Quanto do ativo se compra com `brl` reais quando ele esta cotado a `preco`. */
export function quantidadeComprada(brl: number, preco: number, c: Custos): number {
  return brl / (1 + pct(c.iofCompraPct)) / (preco * (1 + pct(c.spreadPct)));
}

/**
 * Quantos reais voltam ao vender `quantidade` a `preco`. Com `custoBase` (os
 * reais que a posicao custou), desconta tambem o IR sobre o lucro.
 */
export function reaisRecebidos(
  quantidade: number,
  preco: number,
  c: Custos,
  custoBase?: number,
): number {
  const bruto = quantidade * preco * (1 - pct(c.spreadPct)) * (1 - pct(c.iofVendaPct));
  if (custoBase == null || c.irGanhoPct <= 0) return bruto;
  return bruto - Math.max(0, bruto - custoBase) * pct(c.irGanhoPct);
}

/**
 * O preco em que vender `quantidade` devolve `custoBase` com `resultadoPct` de
 * resultado liquido. E o inverso de `reaisRecebidos`: transforma "alvo de +3%"
 * e "stop de -8%" em precos que da para comparar com a cotacao na tela.
 */
export function precoParaResultado(
  quantidade: number,
  custoBase: number,
  resultadoPct: number,
  c: Custos,
): number {
  const liquido = custoBase * (1 + resultadoPct / 100);
  /* No lucro o IR morde a parte acima do custo: L = B - (B - custo) * ir. */
  const ir = liquido > custoBase ? pct(c.irGanhoPct) : 0;
  const bruto = (liquido - custoBase * ir) / (1 - ir);
  return bruto / (quantidade * (1 - pct(c.spreadPct)) * (1 - pct(c.iofVendaPct)));
}

/**
 * Quanto a cotacao precisa subir, em %, para a ida e volta empatar.
 * E o numero que mais importa: abaixo dele, acertar a direcao ainda da prejuizo.
 * O IR nao entra: ele so morde lucro, e no empate nao ha lucro.
 */
export function empatePct(c: Custos): number {
  const ida = (1 + pct(c.iofCompraPct)) * (1 + pct(c.spreadPct));
  const volta = (1 - pct(c.spreadPct)) * (1 - pct(c.iofVendaPct));
  return (ida / volta - 1) * 100;
}

function media(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function desvio(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  return Math.sqrt(valores.reduce((a, v) => a + (v - m) ** 2, 0) / (valores.length - 1));
}

export interface Indicadores {
  atual: number;
  minLongo: number;
  maxLongo: number;
  mediaLongo: number;
  /** 0 = na minima da janela longa, 1 = na maxima. */
  posicaoFaixa: number;
  /** Quantos desvios-padrao o preco esta da media da janela longa. */
  zScore: number;
  variacaoCurtaPct: number;
  /** O preco parou de cair: o ultimo valor ja esta acima da minima da janela curta. */
  virouParaCima: boolean;
  /** Volatilidade dos retornos diarios dos ultimos 30 pregoes, anualizada, em %. */
  volatilidadeAnualPct: number;
  /** Movimento tipico em 30 dias corridos (~21 pregoes), em %, para um desvio. */
  movimentoTipico30dPct: number;
}

/** null quando a serie ainda nao cobre a janela longa. */
export function indicadores(serie: number[], p: ParametrosSinal): Indicadores | null {
  if (serie.length < Math.max(p.janelaLonga, p.janelaCurta + 1, 31)) return null;

  const atual = serie[serie.length - 1];
  const longo = serie.slice(-p.janelaLonga);
  const curto = serie.slice(-p.janelaCurta);
  const minLongo = Math.min(...longo);
  const maxLongo = Math.max(...longo);
  const mediaLongo = media(longo);
  const dp = desvio(longo);

  const base = serie[serie.length - 1 - p.janelaCurta];
  const retornos = serie
    .slice(-31)
    .slice(1)
    .map((v, i) => Math.log(v / serie[serie.length - 31 + i]));
  const volDiaria = desvio(retornos);

  return {
    atual,
    minLongo,
    maxLongo,
    mediaLongo,
    posicaoFaixa: maxLongo === minLongo ? 0.5 : (atual - minLongo) / (maxLongo - minLongo),
    zScore: dp === 0 ? 0 : (atual - mediaLongo) / dp,
    variacaoCurtaPct: (atual / base - 1) * 100,
    virouParaCima: atual > Math.min(...curto),
    volatilidadeAnualPct: volDiaria * Math.sqrt(252) * 100,
    movimentoTipico30dPct: volDiaria * Math.sqrt(21) * 100,
  };
}

export type TipoSinal =
  | 'compra'
  | 'aguardar_virada'
  | 'neutro'
  | 'caro'
  | 'venda'
  | 'stop'
  | 'segurar';

export interface Sinal {
  tipo: TipoSinal;
  /** Frase curta para o painel e para o alerta. */
  motivo: string;
}

/** Posicao aberta reduzida ao que o sinal precisa: o resultado liquido se vender agora. */
export interface PosicaoAberta {
  resultadoLiquidoPct: number;
}

const fmt = (v: number, casas = 1) => v.toFixed(casas).replace('.', ',');

export function sinal(
  ind: Indicadores,
  p: ParametrosSinal,
  posicao: PosicaoAberta | null,
  c: Custos,
): Sinal {
  const faixa = Math.round(ind.posicaoFaixa * 100);

  if (posicao) {
    const r = posicao.resultadoLiquidoPct;
    if (r <= -p.stopPct) {
      return { tipo: 'stop', motivo: `prejuizo liquido de ${fmt(-r)}% passou do stop de ${fmt(p.stopPct)}%` };
    }
    if (r >= p.alvoLucroPct) {
      return { tipo: 'venda', motivo: `lucro liquido de ${fmt(r)}% bateu o alvo de ${fmt(p.alvoLucroPct)}%` };
    }
    if (r > 0 && ind.posicaoFaixa >= p.zonaVenda) {
      return {
        tipo: 'venda',
        motivo: `preco no topo da faixa (${faixa}%) com lucro liquido de ${fmt(r)}%`,
      };
    }
    return { tipo: 'segurar', motivo: `resultado liquido ${r >= 0 ? '+' : ''}${fmt(r)}% — ainda longe do alvo` };
  }

  if (ind.posicaoFaixa <= p.zonaCompra) {
    if (!ind.virouParaCima) {
      return {
        tipo: 'aguardar_virada',
        motivo: `preco barato (${faixa}% da faixa) mas ainda caindo — espere parar de cair`,
      };
    }
    return {
      tipo: 'compra',
      motivo:
        `preco em ${faixa}% da faixa de ${p.janelaLonga} pregoes e voltando a subir; ` +
        `precisa subir ${fmt(empatePct(c))}% para empatar`,
    };
  }

  if (ind.posicaoFaixa >= p.zonaVenda) {
    return { tipo: 'caro', motivo: `preco no topo da faixa (${faixa}%) — mau momento para comprar` };
  }

  return { tipo: 'neutro', motivo: `preco no meio da faixa (${faixa}%) — nada a fazer` };
}

export interface Historico {
  /** Quantas vezes, no passado, o preco esteve na zona de compra. */
  ocorrencias: number;
  /** Dessas, quantas subiram alem do empate dentro do horizonte. */
  acertos: number;
  horizonteDias: number;
}

/**
 * "Das vezes que o preco esteve barato assim, quantas pagaram os custos?"
 * Conta dias espacados pelo horizonte, para uma mesma queda longa nao virar
 * dezenas de ocorrencias que dizem a mesma coisa.
 */
export function historicoDaZona(
  serie: number[],
  p: ParametrosSinal,
  c: Custos,
  horizonteDias = 63,
): Historico {
  const alvo = 1 + empatePct(c) / 100;
  let ocorrencias = 0;
  let acertos = 0;

  for (let i = p.janelaLonga - 1; i < serie.length - horizonteDias; i++) {
    const janela = serie.slice(i + 1 - p.janelaLonga, i + 1);
    const lo = Math.min(...janela);
    const hi = Math.max(...janela);
    const posicao = hi === lo ? 0.5 : (serie[i] - lo) / (hi - lo);
    if (posicao > p.zonaCompra) continue;

    ocorrencias++;
    const futuro = Math.max(...serie.slice(i + 1, i + 1 + horizonteDias));
    if (futuro >= serie[i] * alvo) acertos++;
    i += horizonteDias - 1;
  }

  return { ocorrencias, acertos, horizonteDias };
}

export interface OperacaoBacktest {
  tipo: 'compra' | 'venda';
  dia: string;
  taxa: number;
  brl: number;
  motivo: string;
}

export interface ResultadoBacktest {
  inicio: string;
  fim: string;
  capitalInicial: number;
  final: number;
  retornoPct: number;
  /** Os mesmos reais parados no CDI o periodo todo. */
  cdiFinal: number;
  cdiRetornoPct: number;
  /** Comprar no primeiro dia e vender no ultimo. */
  segurarFinal: number;
  operacoes: OperacaoBacktest[];
  /** Pior queda do patrimonio a partir de um pico, em %. */
  piorQuedaPct: number;
}

/**
 * Roda a estrategia no historico, dia a dia, sem olhar o futuro. Enquanto esta
 * em reais o dinheiro rende CDI; enquanto esta em moeda, rende so o cambio.
 *
 * `cdiDia` e a taxa diaria do CDI em % (0.05 = 0,05% ao dia) por data.
 */
export function backtest(
  pontos: Ponto[],
  cdiDia: Map<string, number>,
  p: ParametrosSinal,
  c: Custos,
  capitalInicial = 100,
): ResultadoBacktest | null {
  if (pontos.length <= p.janelaLonga) return null;

  const serie = pontos.map((pt) => pt.valor);
  const inicio = p.janelaLonga - 1;
  const operacoes: OperacaoBacktest[] = [];

  let reais = capitalInicial;
  let moeda = 0;
  let custoPosicao = 0;
  let cdi = capitalInicial;
  let pico = capitalInicial;
  let piorQueda = 0;
  let ultimaTaxaCdi = 0;

  for (let i = inicio; i < pontos.length; i++) {
    const { dia, valor } = pontos[i];

    if (i > inicio) {
      const taxa = cdiDia.get(pontos[i - 1].dia) ?? ultimaTaxaCdi;
      ultimaTaxaCdi = taxa;
      /* Um pregao de cambio pode cobrir varios dias uteis de CDI (feriado so
         de um lado); a diferenca e pequena e fica de fora de proposito. */
      cdi *= 1 + taxa / 100;
      reais *= 1 + taxa / 100;
    }

    const ind = indicadores(serie.slice(0, i + 1), p);
    if (!ind) continue;

    const posicao =
      moeda > 0
        ? { resultadoLiquidoPct: (reaisRecebidos(moeda, valor, c, custoPosicao) / custoPosicao - 1) * 100 }
        : null;
    const s = sinal(ind, p, posicao, c);

    if (!posicao && s.tipo === 'compra') {
      operacoes.push({ tipo: 'compra', dia, taxa: valor, brl: reais, motivo: s.motivo });
      moeda = quantidadeComprada(reais, valor, c);
      custoPosicao = reais;
      reais = 0;
    } else if (posicao && (s.tipo === 'venda' || s.tipo === 'stop')) {
      reais = reaisRecebidos(moeda, valor, c, custoPosicao);
      operacoes.push({ tipo: 'venda', dia, taxa: valor, brl: reais, motivo: s.motivo });
      moeda = 0;
      custoPosicao = 0;
    }

    const patrimonio = reais + (moeda > 0 ? reaisRecebidos(moeda, valor, c, custoPosicao) : 0);
    pico = Math.max(pico, patrimonio);
    piorQueda = Math.max(piorQueda, (1 - patrimonio / pico) * 100);
  }

  const ultimo = pontos[pontos.length - 1];
  const final = reais + (moeda > 0 ? reaisRecebidos(moeda, ultimo.valor, c, custoPosicao) : 0);
  const primeiro = pontos[inicio];
  const segurar = reaisRecebidos(
    quantidadeComprada(capitalInicial, primeiro.valor, c),
    ultimo.valor,
    c,
    capitalInicial,
  );

  return {
    inicio: primeiro.dia,
    fim: ultimo.dia,
    capitalInicial,
    final,
    retornoPct: (final / capitalInicial - 1) * 100,
    cdiFinal: cdi,
    cdiRetornoPct: (cdi / capitalInicial - 1) * 100,
    segurarFinal: segurar,
    operacoes,
    piorQuedaPct: piorQueda,
  };
}
