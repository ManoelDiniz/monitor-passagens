import { config } from '../config';
import type { CambioOperacao } from '../db/entities/cambio-operacao.entity';
import {
  type Ativo,
  backtest,
  type Custos,
  DESCRICAO,
  empatePct,
  type Historico,
  historicoDaZona,
  type Indicadores,
  indicadores,
  type Moeda,
  type Ponto,
  precoParaResultado,
  quantidadeComprada,
  type ResultadoBacktest,
  reaisRecebidos,
  type Sinal,
  sinal,
} from '../domain/cambio';
import { NotFoundError, ValidationError } from '../domain/errors';
import { deliver } from '../infra/notifier';
import { log } from '../logger';
import { cotacoesAoVivo } from '../providers/awesome';
import { cdiDiario, ptaxFechamentos } from '../providers/bcb';
import { graficoB3 } from '../providers/yahoo';
import { cambioRepository, type NovaOperacao } from '../repositories/cambio.repository';

const hojeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.schedule.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia de calendario em Sao Paulo, nao no fuso do processo. */
const hoje = () => hojeFmt.format(new Date());

function somaDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const custosDe = (ativo: Ativo): Custos => config.cambio.custos[DESCRICAO[ativo].perfil];

/** Pregoes mostrados no grafico do painel: a janela longa e mais um tanto de contexto. */
const PREGOES_GRAFICO = 180;

export interface Posicao {
  ativo: Ativo;
  quantidade: number;
  /** Reais que a parte ainda aberta custou (custo medio). */
  custo: number;
  /** Quanto voltaria vendendo tudo agora, com todos os custos e o IR. */
  liquidacao: number;
  resultado: number;
  resultadoPct: number;
  /** Lucro ou prejuizo ja embolsado em vendas anteriores. */
  realizado: number;
  /** Preco medio pago por unidade, com os custos de compra embutidos. */
  precoMedio: number | null;
  /** Preco do ativo em que a venda bate o alvo de lucro liquido. */
  precoAlvo: number | null;
  /** Preco do ativo em que o prejuizo liquido chega ao stop. */
  precoStop: number | null;
}

export interface PainelAtivo {
  ativo: Ativo;
  nome: string;
  unidade: string;
  referencia: Moeda;
  preco: number | null;
  precoDia: string | null;
  referenciaAtual: number | null;
  indicadores: Indicadores | null;
  sinal: Sinal | null;
  historico: Historico | null;
  custos: Custos;
  empatePct: number;
  posicao: Posicao | null;
  grafico: Ponto[];
}

export interface Panorama {
  atualizadoEm: string | null;
  parametros: typeof config.cambio.sinal;
  ativos: PainelAtivo[];
}

export interface Carteira {
  investido: number;
  patrimonio: number;
  /** Os mesmos reais, nas mesmas datas, aplicados no CDI. */
  patrimonioCdi: number | null;
  posicoes: Posicao[];
  operacoes: CambioOperacao[];
}

/**
 * Custo medio: cada venda tira da posicao a fracao proporcional do custo. E a
 * regra que a Receita usa para o ganho de capital, entao o "realizado" daqui
 * bate com o que vai para a declaracao.
 */
function montarPosicao(ativo: Ativo, ops: CambioOperacao[], preco: number | null): Posicao | null {
  let quantidade = 0;
  let custo = 0;
  let realizado = 0;

  for (const op of ops) {
    if (op.tipo === 'compra') {
      quantidade += op.quantidade;
      custo += op.valor_brl;
    } else if (quantidade > 0) {
      const fracao = Math.min(1, op.quantidade / quantidade);
      const custoSaida = custo * fracao;
      realizado += op.valor_brl - custoSaida;
      quantidade -= Math.min(op.quantidade, quantidade);
      custo -= custoSaida;
    }
  }

  if (ops.length === 0) return null;

  // Resto de arredondamento de uma venda total nao e posicao.
  if (quantidade < 1e-6) {
    quantidade = 0;
    custo = 0;
  }

  const c = custosDe(ativo);
  const { alvoLucroPct, stopPct } = config.cambio.sinal;
  const aberta = quantidade > 0;
  const liquidacao = aberta && preco != null ? reaisRecebidos(quantidade, preco, c, custo) : 0;
  const resultado = liquidacao - custo;

  return {
    ativo,
    quantidade,
    custo,
    liquidacao,
    resultado,
    resultadoPct: custo > 0 ? (resultado / custo) * 100 : 0,
    realizado,
    precoMedio: aberta ? custo / quantidade : null,
    precoAlvo: aberta ? precoParaResultado(quantidade, custo, alvoLucroPct, c) : null,
    precoStop: aberta ? precoParaResultado(quantidade, custo, -stopPct, c) : null,
  };
}

interface OperacaoRecebida {
  op: Omit<NovaOperacao, 'quantidade'>;
  quantidade: number | null;
  /** Preco por unidade que a plataforma mostrou, ja com o spread dela. */
  precoPago: number | null;
}

/**
 * Quem lanca nao precisa saber a quantidade. Com o preco pago, ela e a divisao
 * direta. Sem ele, sai da cotacao do dia mais os custos configurados. Na venda
 * sem quantidade, assume-se que saiu tudo — com R$ 100 ninguem vende meia posicao.
 */
function estimarQuantidade(
  r: OperacaoRecebida,
  precoDoDia: number | null,
  posicaoAberta: number,
): number | null {
  if (r.quantidade != null) return r.quantidade;
  if (r.op.tipo === 'venda') return posicaoAberta > 0 ? posicaoAberta : null;
  if (r.precoPago != null) return r.op.valor_brl / r.precoPago;
  if (precoDoDia == null) return null;
  return quantidadeComprada(r.op.valor_brl, precoDoDia, custosDe(r.op.ativo as Ativo));
}

function validarOperacao(body: unknown): OperacaoRecebida {
  const b = (body ?? {}) as Record<string, unknown>;
  const problemas: string[] = [];

  const ativo = String(b.ativo ?? '').toUpperCase();
  if (!(ativo in DESCRICAO)) problemas.push(`ativo invalido: use ${Object.keys(DESCRICAO).join(', ')}`);

  const tipo = b.tipo;
  if (tipo !== 'compra' && tipo !== 'venda') problemas.push('tipo deve ser "compra" ou "venda"');

  const dia = String(b.dia ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) problemas.push('dia deve estar no formato AAAA-MM-DD');
  else if (dia > hoje()) problemas.push('dia no futuro');

  const valor = Number(b.valor_brl);
  if (!Number.isFinite(valor) || valor <= 0) problemas.push('valor em reais deve ser maior que zero');

  /** Opcional: vazio vira null; preenchido precisa ser positivo. */
  const opcional = (v: unknown, nome: string): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) problemas.push(`${nome} deve ser maior que zero`);
    return n;
  };
  const quantidade = opcional(b.quantidade, 'quantidade');
  const precoPago = opcional(b.preco_pago, 'preco pago');

  if (problemas.length) throw new ValidationError(problemas);

  const texto = (v: unknown, max: number) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s.slice(0, max) : null;
  };

  return {
    op: {
      ativo,
      tipo: tipo as 'compra' | 'venda',
      dia,
      valor_brl: Math.round(valor * 100) / 100,
      plataforma: texto(b.plataforma, 40),
      notas: texto(b.notas, 255),
    },
    quantidade,
    precoPago,
  };
}

export class CambioService {
  private atualizadoEm: string | null = null;
  private cdiCache: { de: string; em: number; taxas: Map<string, number> } | null = null;

  private get ativos(): Ativo[] {
    return config.cambio.ativos;
  }

  /** Moedas cuja serie precisa existir: as negociadas e as que servem de referencia. */
  private get moedas(): Moeda[] {
    const set = new Set<Moeda>();
    for (const a of this.ativos) set.add(DESCRICAO[a].referencia);
    return [...set];
  }

  /**
   * Completa o historico que falta e grava o preco de agora. Na primeira vez
   * baixa anos de PTAX; depois, so os dias desde o ultimo fechamento.
   */
  async sincronizar(): Promise<void> {
    const dia = hoje();
    const inicioPadrao = somaDias(dia, -365 * config.cambio.historicoAnos);

    for (const moeda of this.moedas) {
      try {
        const ultimo = await cambioRepository.ultimoDia(moeda, 'ptax');
        const de = ultimo ? somaDias(ultimo, 1) : inicioPadrao;
        if (de <= dia) {
          const pontos = await ptaxFechamentos(moeda, de, dia);
          await cambioRepository.salvar(moeda, pontos, 'ptax');
          if (!ultimo) log.info(`cambio: historico PTAX de ${moeda} carregado (${pontos.length} dias)`);
        }
      } catch (err) {
        log.warn(`cambio: falha ao buscar a PTAX de ${moeda}`, err);
      }
    }

    try {
      for (const q of await cotacoesAoVivo(this.moedas)) {
        await cambioRepository.salvarAoVivo(q.moeda, { dia: q.em.slice(0, 10), valor: q.valor });
      }
    } catch (err) {
      log.warn('cambio: falha na cotacao ao vivo', err);
    }

    for (const ativo of this.ativos.filter((a) => DESCRICAO[a].perfil === 'etf')) {
      try {
        const ultimo = await cambioRepository.ultimoDia(ativo);
        const { pontos } = await graficoB3(ativo, ultimo ? '1mo' : `${config.cambio.historicoAnos}y`);
        await cambioRepository.salvar(ativo, pontos, 'b3');
      } catch (err) {
        log.warn(`cambio: falha ao buscar ${ativo} na B3`, err);
      }
    }

    this.atualizadoEm = new Date().toISOString();
  }

  private async painelDe(ativo: Ativo, ops: CambioOperacao[]): Promise<PainelAtivo> {
    const d = DESCRICAO[ativo];
    const custos = custosDe(ativo);
    const p = config.cambio.sinal;

    const referencia = await cambioRepository.serie(d.referencia);
    const proprio = ativo === d.referencia ? referencia : await cambioRepository.serie(ativo);
    const valores = referencia.map((pt) => pt.valor);
    const ultimo = proprio[proprio.length - 1] ?? null;

    const posicao = montarPosicao(ativo, ops, ultimo?.valor ?? null);
    const ind = indicadores(valores, p);
    const aberta = posicao && posicao.quantidade > 0 ? { resultadoLiquidoPct: posicao.resultadoPct } : null;

    return {
      ativo,
      nome: d.nome,
      unidade: d.unidade,
      referencia: d.referencia,
      preco: ultimo?.valor ?? null,
      precoDia: ultimo?.dia ?? null,
      referenciaAtual: valores[valores.length - 1] ?? null,
      indicadores: ind,
      sinal: ind ? sinal(ind, p, aberta, custos) : null,
      historico: valores.length > p.janelaLonga ? historicoDaZona(valores, p, custos) : null,
      custos,
      empatePct: empatePct(custos),
      posicao,
      grafico: referencia.slice(-PREGOES_GRAFICO),
    };
  }

  async panorama(): Promise<Panorama> {
    const ops = await cambioRepository.listarOperacoes();
    const ativos = await Promise.all(
      this.ativos.map((a) => this.painelDe(a, ops.filter((o) => o.ativo === a))),
    );
    return { atualizadoEm: this.atualizadoEm, parametros: config.cambio.sinal, ativos };
  }

  /** CDI desde `de`. Guardado por algumas horas: a taxa muda uma vez por dia. */
  async cdiDesde(de: string): Promise<Map<string, number>> {
    const c = this.cdiCache;
    if (c && c.de <= de && Date.now() - c.em < 6 * 3_600_000) return c.taxas;
    try {
      const taxas = await cdiDiario(de, hoje());
      this.cdiCache = { de, em: Date.now(), taxas };
      return taxas;
    } catch (err) {
      // CDI de algumas horas atras ainda serve para comparar; tela vazia nao serve.
      if (c && c.de <= de) return c.taxas;
      throw err;
    }
  }

  /** Fator de correcao do CDI de `de` (inclusive) ate hoje (exclusive). */
  private fatorCdi(taxas: Map<string, number>, de: string): number {
    let fator = 1;
    for (const [dia, taxa] of taxas) if (dia >= de) fator *= 1 + taxa / 100;
    return fator;
  }

  async carteira(): Promise<Carteira> {
    const operacoes = await cambioRepository.listarOperacoes();
    const posicoes: Posicao[] = [];

    for (const ativo of [...new Set(operacoes.map((o) => o.ativo as Ativo))]) {
      const serie = await cambioRepository.serie(ativo, somaDias(hoje(), -15));
      const preco = serie[serie.length - 1]?.valor ?? null;
      const pos = montarPosicao(ativo, operacoes.filter((o) => o.ativo === ativo), preco);
      if (pos) posicoes.push(pos);
    }

    const compras = operacoes.filter((o) => o.tipo === 'compra');
    const vendas = operacoes.filter((o) => o.tipo === 'venda');
    const investido = compras.reduce((s, o) => s + o.valor_brl, 0);

    /* A comparacao justa: o que a venda devolveu tambem passa a render CDI dali
       em diante, dos dois lados. So muda o que ficou exposto a moeda. */
    let patrimonioCdi: number | null = null;
    let patrimonio = posicoes.reduce((s, p) => s + p.liquidacao, 0) + vendas.reduce((s, o) => s + o.valor_brl, 0);

    if (compras.length > 0) {
      try {
        const taxas = await this.cdiDesde(compras[0].dia);
        patrimonioCdi = compras.reduce((s, o) => s + o.valor_brl * this.fatorCdi(taxas, o.dia), 0);
        patrimonio =
          posicoes.reduce((s, p) => s + p.liquidacao, 0) +
          vendas.reduce((s, o) => s + o.valor_brl * this.fatorCdi(taxas, o.dia), 0);
      } catch (err) {
        log.warn('cambio: CDI indisponivel para a comparacao', err);
      }
    }

    return { investido, patrimonio, patrimonioCdi, posicoes, operacoes: [...operacoes].reverse() };
  }

  async registrarOperacao(body: unknown): Promise<CambioOperacao> {
    const recebida = validarOperacao(body);
    const { op } = recebida;

    const ops = (await cambioRepository.listarOperacoes()).filter((o) => o.ativo === op.ativo);
    const aberta = montarPosicao(op.ativo as Ativo, ops, null)?.quantidade ?? 0;
    const precoDoDia = await cambioRepository.precoEm(op.ativo, op.dia);

    const estimada = estimarQuantidade(recebida, precoDoDia, aberta);
    if (estimada == null) {
      throw new ValidationError([
        op.tipo === 'venda'
          ? `nao ha posicao aberta em ${op.ativo} para vender`
          : `sem cotacao de ${op.ativo} em ${op.dia}; informe a quantidade ou o preco pago`,
      ]);
    }

    const quantidade = Math.round(estimada * 10_000) / 10_000;
    if (op.tipo === 'venda' && aberta + 1e-6 < quantidade) {
      throw new ValidationError([`venda de ${quantidade} maior que a posicao aberta (${aberta})`]);
    }

    /* Fica registrado de onde veio o numero, para ninguem tomar estimativa por extrato. */
    const origem =
      recebida.quantidade != null
        ? null
        : op.tipo === 'venda'
          ? 'venda total'
          : recebida.precoPago != null
            ? `quantidade pelo preco pago ${recebida.precoPago}`
            : `quantidade estimada pela cotacao ${precoDoDia} e custos`;
    const notas = [op.notas, origem].filter(Boolean).join(' · ').slice(0, 255) || null;

    return cambioRepository.inserirOperacao({ ...op, quantidade, notas });
  }

  async removerOperacao(id: number): Promise<void> {
    if (!(await cambioRepository.removerOperacao(id))) throw new NotFoundError('operacao nao encontrada');
  }

  /**
   * Avisa quando o sinal pede acao: comprar, vender ou sair no stop. O mesmo
   * sinal nao repete dentro do cooldown — o preco fica dias na zona de compra,
   * e um aviso por hora so ensinaria a ignorar o aviso.
   */
  private async avisar(painel: PainelAtivo): Promise<void> {
    const s = painel.sinal;
    if (!s || !['compra', 'venda', 'stop'].includes(s.tipo) || painel.preco == null) return;

    const ultimo = await cambioRepository.ultimoAlerta(painel.ativo);
    const cooldownMs = config.cambio.alertaCooldownHoras * 3_600_000;
    if (ultimo && ultimo.sinal === s.tipo && Date.now() - ultimo.enviado_em.getTime() < cooldownMs) return;

    const acao = { compra: 'momento de compra', venda: 'momento de venda', stop: 'stop atingido' }[
      s.tipo as 'compra' | 'venda' | 'stop'
    ];
    const preco = painel.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    await deliver({
      title: `${painel.ativo}: ${acao}`,
      message: `${painel.nome} a R$ ${preco}. ${s.motivo}.`,
      link: `http://localhost:${config.port}/#/cambio`,
    });
    await cambioRepository.registrarAlerta({
      ativo: painel.ativo,
      sinal: s.tipo,
      cotacao: painel.preco,
      motivo: s.motivo.slice(0, 255),
      enviado_em: new Date(),
    });
    log.info(`cambio: alerta ${s.tipo} de ${painel.ativo}`, s.motivo);
  }

  /** A rodada do agendador: atualiza as cotacoes e avisa o que precisar. */
  async rodada(): Promise<void> {
    if (!config.cambio.enabled || this.ativos.length === 0) return;

    await this.sincronizar();
    const { ativos } = await this.panorama();
    for (const painel of ativos) {
      try {
        await this.avisar(painel);
      } catch (err) {
        log.error(`cambio: falha ao avisar ${painel.ativo}`, err);
      }
    }
  }

  /**
   * Estrategia no historico da moeda de referencia, com os custos do ativo.
   * Para o ETF e uma aproximacao: ele segue o dolar futuro, nao a PTAX.
   */
  async backtest(ativoRaw: string, capital = 100): Promise<ResultadoBacktest> {
    const ativo = ativoRaw.toUpperCase() as Ativo;
    if (!(ativo in DESCRICAO)) throw new NotFoundError('ativo desconhecido');

    const pontos = await cambioRepository.serie(DESCRICAO[ativo].referencia);
    if (pontos.length === 0) throw new NotFoundError('sem historico ainda — rode a sincronizacao');

    const taxas = await this.cdiDesde(pontos[0].dia);
    const r = backtest(pontos, taxas, config.cambio.sinal, custosDe(ativo), capital);
    if (!r) throw new ValidationError(['historico curto demais para a janela longa']);
    return r;
  }

  alertas(limite = 30) {
    return cambioRepository.alertasRecentes(Math.min(Math.max(1, limite), 200));
  }
}

export const cambioService = new CambioService();
