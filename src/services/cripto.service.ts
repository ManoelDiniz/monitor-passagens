import { config } from '../config';
import type { CriptoOperacao } from '../db/entities/cripto-operacao.entity';
import { empatePct, type Ponto, quantidadeComprada, reaisRecebidos } from '../domain/cambio';
import {
  acimaDaMedia,
  acoesDoDia,
  backtestGrade,
  type EstatisticaQuedas,
  estatisticaQuedas,
  type Lote,
  type ParametrosGrade,
  precoDoLote,
  quedaDoTopo,
  resultadoDoLote,
  type ResultadoGrade,
} from '../domain/cripto';
import { NotFoundError, ValidationError } from '../domain/errors';
import { deliver } from '../infra/notifier';
import { log } from '../logger';
import { candlesDiarios } from '../providers/mercadobitcoin';
import { cambioRepository } from '../repositories/cambio.repository';
import { criptoRepository } from '../repositories/cripto.repository';
import { cambioService } from './cambio.service';

const hojeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.schedule.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hoje = () => hojeFmt.format(new Date());

function somaDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const custos = () => config.cripto.custos;

/** Dias mostrados no grafico do radar. */
const DIAS_GRAFICO = 120;

export type SinalCripto =
  | 'queda_boa'
  | 'comprar_mais'
  | 'vender'
  | 'stop'
  | 'segurar'
  | 'queda_arriscada'
  | 'queda_em_baixa'
  | 'sem_queda';

export interface LoteAberto {
  id: number;
  dia: string;
  preco: number;
  quantidade: number;
  custo: number;
  valorHoje: number;
  resultadoPct: number;
  precoAlvo: number;
  precoStop: number | null;
}

export interface RadarMoeda {
  moeda: string;
  preco: number | null;
  dia: string | null;
  variacao: { d1: number | null; d7: number | null; d30: number | null };
  quedaDoTopoPct: number | null;
  tendenciaAlta: boolean | null;
  volatilidadeAnualPct: number | null;
  estatistica: EstatisticaQuedas | null;
  /** Taxa de recuperacao que vale para o sinal (so as quedas em alta, com o filtro ligado). */
  taxaRecuperacao: number | null;
  sinal: SinalCripto;
  motivo: string;
  lotes: LoteAberto[];
  grafico: Ponto[];
}

export interface Radar {
  atualizadoEm: string | null;
  grade: ParametrosGrade;
  empatePct: number;
  custos: ReturnType<typeof custos>;
  taxaMinima: number;
  moedas: RadarMoeda[];
}

export interface CarteiraCripto {
  investido: number;
  patrimonio: number;
  patrimonioCdi: number | null;
  realizado: number;
  operacoes: CriptoOperacao[];
}

export interface Estudo {
  moeda: string;
  inicio: string;
  fim: string;
  /** Quedas de varios tamanhos e quantas se recuperaram. */
  quedas: EstatisticaQuedas[];
  /** A grade configurada no painel. */
  configurada: ResultadoGrade | null;
  /** O "compra na queda de 1%, vende na alta de 1%, todo dia". */
  diario: ResultadoGrade | null;
  /** As melhores combinacoes testadas, da melhor para a pior. */
  melhores: Array<{ parametros: ParametrosGrade; resultado: ResultadoGrade }>;
  combinacoesTestadas: number;
}

function volatilidadeAnual(serie: number[]): number | null {
  if (serie.length < 31) return null;
  const r = serie.slice(-31).slice(1).map((v, i) => Math.log(v / serie[serie.length - 31 + i]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const dp = Math.sqrt(r.reduce((a, v) => a + (v - m) ** 2, 0) / (r.length - 1));
  /* Cripto negocia todo dia: o ano tem 365 pregoes, nao 252. */
  return dp * Math.sqrt(365) * 100;
}

const variacao = (serie: number[], dias: number) =>
  serie.length > dias ? (serie[serie.length - 1] / serie[serie.length - 1 - dias] - 1) * 100 : null;

/** Compras que ainda nao tem venda apontando para elas. */
function lotesAbertos(ops: CriptoOperacao[]): CriptoOperacao[] {
  const fechados = new Set(ops.filter((o) => o.tipo === 'venda').map((o) => o.lote_id));
  return ops.filter((o) => o.tipo === 'compra' && !fechados.has(o.id));
}

const paraLote = (op: CriptoOperacao): Lote => ({
  dia: op.dia,
  preco: op.valor_brl / op.quantidade,
  quantidade: op.quantidade,
  custo: op.valor_brl,
});

export class CriptoService {
  private atualizadoEm: string | null = null;

  private get moedas(): string[] {
    return config.cripto.moedas;
  }

  /** Completa o historico e regrava os ultimos dias — o de hoje e o preco de agora. */
  async sincronizar(): Promise<void> {
    for (const moeda of this.moedas) {
      try {
        const ultimo = await cambioRepository.ultimoDia(moeda);
        const de = ultimo ? somaDias(ultimo, -2) : config.cripto.historicoDesde;
        const pontos = await candlesDiarios(moeda, de);
        await cambioRepository.salvar(moeda, pontos, 'mb');
        if (!ultimo) log.info(`cripto: historico de ${moeda} carregado (${pontos.length} dias)`);
      } catch (err) {
        log.warn(`cripto: falha ao buscar ${moeda} no Mercado Bitcoin`, err);
      }
    }
    this.atualizadoEm = new Date().toISOString();
  }

  private analisar(moeda: string, pontos: Ponto[], ops: CriptoOperacao[]): RadarMoeda {
    const p = config.cripto.grade;
    const c = custos();
    const serie = pontos.map((pt) => pt.valor);
    const i = serie.length - 1;
    const preco = serie[i] ?? null;

    const abertos = lotesAbertos(ops);
    const lotes = abertos.map(paraLote);

    const lotesView: LoteAberto[] =
      preco == null
        ? []
        : abertos.map((op, k) => ({
            id: op.id,
            dia: op.dia,
            preco: lotes[k].preco,
            quantidade: op.quantidade,
            custo: op.valor_brl,
            valorHoje: reaisRecebidos(op.quantidade, preco, c, op.valor_brl),
            resultadoPct: resultadoDoLote(lotes[k], preco, c),
            precoAlvo: precoDoLote(lotes[k], p.alvoPct, c),
            precoStop: p.stopPct > 0 ? precoDoLote(lotes[k], -p.stopPct, c) : null,
          }));

    const base = {
      moeda,
      preco,
      dia: pontos[i]?.dia ?? null,
      variacao: { d1: variacao(serie, 1), d7: variacao(serie, 7), d30: variacao(serie, 30) },
      lotes: lotesView,
      grafico: pontos.slice(-DIAS_GRAFICO),
    };

    if (serie.length <= Math.max(p.janelaQueda, p.tendenciaDias)) {
      return {
        ...base,
        quedaDoTopoPct: null,
        tendenciaAlta: null,
        volatilidadeAnualPct: volatilidadeAnual(serie),
        estatistica: null,
        taxaRecuperacao: null,
        sinal: 'sem_queda',
        motivo: 'historico curto demais para avaliar',
      };
    }

    const queda = quedaDoTopo(serie, i, p.janelaQueda);
    const alta = acimaDaMedia(serie, i, p.tendenciaDias);
    const est = estatisticaQuedas(serie, p, c, config.cripto.horizonteDias);
    const [oc, rec] = p.filtroTendencia
      ? [est.ocorrenciasEmAlta, est.recuperouEmAlta]
      : [est.ocorrencias, est.recuperou];
    const taxa = oc > 0 ? rec / oc : null;
    const confiavel = taxa != null && oc >= 5 && taxa >= config.cripto.taxaMinima;
    const historico = taxa == null ? 'sem historico' : `recuperou em ${rec} de ${oc} quedas parecidas`;

    const acoes = acoesDoDia(serie, i, lotes, p, c);
    const venda = acoes.find((a) => a.tipo === 'vender');
    const stop = acoes.find((a) => a.tipo === 'stop');
    const compra = acoes.find((a) => a.tipo === 'comprar');

    let sinal: SinalCripto;
    let motivo: string;
    if (venda) {
      sinal = 'vender';
      motivo = venda.motivo;
    } else if (stop) {
      sinal = 'stop';
      motivo = stop.motivo;
    } else if (compra && lotes.length > 0) {
      sinal = 'comprar_mais';
      motivo = `${compra.motivo} — comprar a parte ${compra.parte} de ${p.partes}`;
    } else if (compra) {
      sinal = confiavel ? 'queda_boa' : 'queda_arriscada';
      motivo = `${compra.motivo}; ${historico}`;
    } else if (lotes.length > 0) {
      sinal = 'segurar';
      motivo = `${lotes.length} parte(s) aberta(s), nenhuma no alvo nem no stop`;
    } else if (queda >= p.quedaPct) {
      sinal = 'queda_em_baixa';
      motivo = `caiu ${queda.toFixed(1).replace('.', ',')}%, mas a tendencia de ${p.tendenciaDias} dias e de baixa`;
    } else {
      sinal = 'sem_queda';
      motivo = `${queda.toFixed(1).replace('.', ',')}% abaixo do topo de ${p.janelaQueda} dias; gatilho em ${p.quedaPct}%`;
    }

    return {
      ...base,
      quedaDoTopoPct: queda,
      tendenciaAlta: alta,
      volatilidadeAnualPct: volatilidadeAnual(serie),
      estatistica: est,
      taxaRecuperacao: taxa,
      sinal,
      motivo,
    };
  }

  async radar(): Promise<Radar> {
    const ops = await criptoRepository.listar();
    const moedas: RadarMoeda[] = [];

    /* Historico inteiro: a taxa de recuperacao so diz algo com anos de quedas. */
    for (const moeda of this.moedas) {
      const pontos = await cambioRepository.serie(moeda);
      moedas.push(this.analisar(moeda, pontos, ops.filter((o) => o.moeda === moeda)));
    }

    const ORDEM: SinalCripto[] = ['vender', 'stop', 'queda_boa', 'comprar_mais', 'segurar', 'queda_arriscada', 'queda_em_baixa', 'sem_queda'];
    moedas.sort((a, b) => ORDEM.indexOf(a.sinal) - ORDEM.indexOf(b.sinal) || (b.quedaDoTopoPct ?? 0) - (a.quedaDoTopoPct ?? 0));

    return {
      atualizadoEm: this.atualizadoEm,
      grade: config.cripto.grade,
      empatePct: empatePct(custos()),
      custos: custos(),
      taxaMinima: config.cripto.taxaMinima,
      moedas,
    };
  }

  async carteira(): Promise<CarteiraCripto> {
    const operacoes = await criptoRepository.listar();
    const compras = operacoes.filter((o) => o.tipo === 'compra');
    const vendas = operacoes.filter((o) => o.tipo === 'venda');
    const porId = new Map(compras.map((o) => [o.id, o]));

    let abertoHoje = 0;
    for (const op of lotesAbertos(operacoes)) {
      const preco = await cambioRepository.precoEm(op.moeda, hoje());
      if (preco != null) abertoHoje += reaisRecebidos(op.quantidade, preco, custos(), op.valor_brl);
    }

    const realizado = vendas.reduce((s, v) => s + v.valor_brl - (porId.get(v.lote_id ?? -1)?.valor_brl ?? 0), 0);
    const investido = compras.reduce((s, o) => s + o.valor_brl, 0);
    let patrimonio = abertoHoje + vendas.reduce((s, o) => s + o.valor_brl, 0);
    let patrimonioCdi: number | null = null;

    if (compras.length > 0) {
      try {
        const taxas = await cambioService.cdiDesde(compras[0].dia);
        const fator = (de: string) => {
          let f = 1;
          for (const [dia, t] of taxas) if (dia >= de) f *= 1 + t / 100;
          return f;
        };
        patrimonioCdi = compras.reduce((s, o) => s + o.valor_brl * fator(o.dia), 0);
        patrimonio = abertoHoje + vendas.reduce((s, o) => s + o.valor_brl * fator(o.dia), 0);
      } catch (err) {
        log.warn('cripto: CDI indisponivel para a comparacao', err);
      }
    }

    return { investido, patrimonio, patrimonioCdi, realizado, operacoes: [...operacoes].reverse() };
  }

  /**
   * Compra: so o valor e o dia sao obrigatorios; a quantidade sai do preco pago
   * ou da cotacao do dia com as taxas. Venda: fecha uma parte inteira — a
   * indicada ou, sem indicacao, a de menor preco (a que bate o alvo primeiro).
   */
  async registrar(body: unknown): Promise<CriptoOperacao> {
    const b = (body ?? {}) as Record<string, unknown>;
    const problemas: string[] = [];

    const moeda = String(b.moeda ?? '').toUpperCase();
    if (!this.moedas.includes(moeda)) problemas.push(`moeda fora do radar: use ${this.moedas.join(', ')}`);
    const tipo = b.tipo;
    if (tipo !== 'compra' && tipo !== 'venda') problemas.push('tipo deve ser "compra" ou "venda"');
    const dia = String(b.dia ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) problemas.push('dia deve estar no formato AAAA-MM-DD');
    else if (dia > hoje()) problemas.push('dia no futuro');

    const opcional = (v: unknown, nome: string) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) problemas.push(`${nome} deve ser maior que zero`);
      return n;
    };
    const valor = opcional(b.valor_brl, 'valor em reais');
    const quantidadeInf = opcional(b.quantidade, 'quantidade');
    const precoPago = opcional(b.preco_pago, 'preco pago');
    const loteInf = opcional(b.lote_id, 'parte');
    if (tipo === 'compra' && valor == null) problemas.push('informe quantos reais investiu');
    if (problemas.length) throw new ValidationError(problemas);

    const texto = (v: unknown, max: number) => {
      const s = typeof v === 'string' ? v.trim() : '';
      return s ? s.slice(0, max) : null;
    };
    const precoDia = await cambioRepository.precoEm(moeda, dia);
    const notas: Array<string | null> = [texto(b.notas, 200)];

    if (tipo === 'compra') {
      let quantidade = quantidadeInf;
      if (quantidade == null && precoPago != null) {
        quantidade = valor! / precoPago;
        notas.push(`quantidade pelo preco pago ${precoPago}`);
      }
      if (quantidade == null) {
        if (precoDia == null) throw new ValidationError([`sem cotacao de ${moeda} em ${dia}; informe a quantidade`]);
        quantidade = quantidadeComprada(valor!, precoDia, custos());
        notas.push(`quantidade estimada pela cotacao ${precoDia} e taxas`);
      }
      return criptoRepository.inserir({
        moeda,
        tipo: 'compra',
        dia,
        valor_brl: Math.round(valor! * 100) / 100,
        quantidade: Math.round(quantidade * 1e10) / 1e10,
        lote_id: null,
        plataforma: texto(b.plataforma, 40),
        notas: notas.filter(Boolean).join(' · ').slice(0, 255) || null,
      });
    }

    const abertos = lotesAbertos((await criptoRepository.listar()).filter((o) => o.moeda === moeda));
    const lote =
      loteInf != null
        ? abertos.find((o) => o.id === loteInf)
        : [...abertos].sort((x, y) => x.valor_brl / x.quantidade - y.valor_brl / y.quantidade)[0];
    if (!lote) {
      throw new ValidationError([loteInf != null ? 'essa parte nao esta aberta' : `nenhuma parte aberta de ${moeda}`]);
    }

    let recebido = valor;
    if (recebido == null) {
      if (precoDia == null) throw new ValidationError([`sem cotacao de ${moeda} em ${dia}; informe o valor recebido`]);
      recebido = reaisRecebidos(lote.quantidade, precoDia, custos(), lote.valor_brl);
      notas.push(`valor estimado pela cotacao ${precoDia} e taxas`);
    }

    return criptoRepository.inserir({
      moeda,
      tipo: 'venda',
      dia,
      valor_brl: Math.round(recebido * 100) / 100,
      quantidade: lote.quantidade,
      lote_id: lote.id,
      plataforma: texto(b.plataforma, 40),
      notas: notas.filter(Boolean).join(' · ').slice(0, 255) || null,
    });
  }

  async remover(id: number): Promise<void> {
    if (!(await criptoRepository.remover(id))) throw new NotFoundError('operacao nao encontrada');
  }

  /** Avisa os sinais que pedem acao. O mesmo sinal da mesma moeda respeita o cooldown. */
  private async avisar(m: RadarMoeda): Promise<void> {
    if (!['queda_boa', 'comprar_mais', 'vender', 'stop'].includes(m.sinal) || m.preco == null) return;

    const ultimo = await cambioRepository.ultimoAlerta(m.moeda);
    const cooldownMs = config.cripto.alertaCooldownHoras * 3_600_000;
    if (ultimo && ultimo.sinal === m.sinal && Date.now() - ultimo.enviado_em.getTime() < cooldownMs) return;

    const titulo = {
      queda_boa: 'queda boa para comprar',
      comprar_mais: 'comprar mais uma parte',
      vender: 'hora de vender uma parte',
      stop: 'stop: vender uma parte',
    }[m.sinal as 'queda_boa' | 'comprar_mais' | 'vender' | 'stop'];
    const preco = m.preco.toLocaleString('pt-BR', { maximumFractionDigits: m.preco < 10 ? 4 : 2 });

    await deliver({
      title: `${m.moeda}: ${titulo}`,
      message: `${m.moeda} a R$ ${preco}. ${m.motivo}.`,
      link: `http://localhost:${config.port}/#/cripto`,
    });
    await cambioRepository.registrarAlerta({
      ativo: m.moeda,
      sinal: m.sinal,
      cotacao: m.preco,
      motivo: m.motivo.slice(0, 255),
      enviado_em: new Date(),
    });
    log.info(`cripto: alerta ${m.sinal} de ${m.moeda}`, m.motivo);
  }

  async rodada(): Promise<void> {
    if (!config.cripto.enabled || this.moedas.length === 0) return;
    await this.sincronizar();
    const { moedas } = await this.radar();
    for (const m of moedas) {
      try {
        await this.avisar(m);
      } catch (err) {
        log.error(`cripto: falha ao avisar ${m.moeda}`, err);
      }
    }
  }

  /**
   * O historico da moeda contado de varios jeitos: quedas de cada tamanho e
   * quantas voltaram, a grade configurada, a ideia de operar todo dia e as
   * melhores combinacoes de uma varredura. As melhores sao o passado ajustado
   * a ele mesmo — servem de norte, nao de promessa.
   */
  async estudo(moedaRaw: string, capital = 100): Promise<Estudo> {
    const moeda = moedaRaw.toUpperCase();
    const pontos = await cambioRepository.serie(moeda);
    if (pontos.length < 200) throw new NotFoundError(`historico de ${moeda} curto ou ausente`);

    const c = custos();
    const g = config.cripto.grade;
    const serie = pontos.map((pt) => pt.valor);
    const taxas = await cambioService.cdiDesde(pontos[0].dia);

    const quedas = [5, 10, 15, 20, 30].map((quedaPct) =>
      estatisticaQuedas(serie, { ...g, quedaPct }, c, config.cripto.horizonteDias),
    );

    const diarioParams: ParametrosGrade = {
      ...g,
      janelaQueda: 2,
      quedaPct: 1,
      alvoPct: 1,
      stopPct: 0,
      partes: 1,
      filtroTendencia: false,
    };

    const melhores: Estudo['melhores'] = [];
    let combinacoes = 0;
    for (const quedaPct of [5, 10, 15, 20])
      for (const alvoPct of [3, 5, 10, 20])
        for (const partes of [1, 2, 4])
          for (const filtroTendencia of [true, false]) {
            const parametros = { ...g, quedaPct, alvoPct, partes, filtroTendencia, espacamentoPct: quedaPct };
            const resultado = backtestGrade(pontos, taxas, parametros, c, capital);
            combinacoes++;
            if (resultado) melhores.push({ parametros, resultado });
          }
    melhores.sort((a, b) => b.resultado.final - a.resultado.final);

    return {
      moeda,
      inicio: pontos[0].dia,
      fim: pontos[pontos.length - 1].dia,
      quedas,
      configurada: backtestGrade(pontos, taxas, g, c, capital),
      diario: backtestGrade(pontos, taxas, diarioParams, c, capital),
      melhores: melhores.slice(0, 5),
      combinacoesTestadas: combinacoes,
    };
  }
}

export interface Validacao {
  corte: string;
  combinacoesTestadas: number;
  /** A combinacao que, olhando so o treino, ganhou do CDI na media das moedas. */
  escolhida: ParametrosGrade | null;
  /** Como ela se saiu depois do corte, moeda por moeda, contra o CDI do mesmo periodo. */
  teste: Array<{ moeda: string; final: number; cdiFinal: number; segurarFinal: number; piorQuedaPct: number }>;
}

/**
 * Teste fora da amostra: escolhe a combinacao so com os dados ate `corte` e
 * mede depois dele. A varredura do `estudo` mostra o melhor olhando para tras
 * — sempre parece otimo; aqui aparece o que sobra quando o futuro e de verdade.
 * A escolha e uma so para todas as moedas, para nao sobreajustar cada uma.
 */
export async function validarGrade(moedas: string[], corte: string, capital = 100): Promise<Validacao> {
  const c = custos();
  const g = config.cripto.grade;
  const series = new Map<string, Ponto[]>();
  for (const m of moedas) {
    const pontos = await cambioRepository.serie(m);
    if (pontos.length > 400 && pontos[0].dia < corte) series.set(m, pontos);
  }
  if (series.size === 0) return { corte, combinacoesTestadas: 0, escolhida: null, teste: [] };

  const primeiro = [...series.values()].map((s) => s[0].dia).sort()[0];
  const taxas = await cambioService.cdiDesde(primeiro);

  /* O teste comeca com o historico anterior disponivel para as medias e o topo,
     mas so opera a partir do corte. */
  const aquecimento = Math.max(g.tendenciaDias, g.janelaQueda);
  const recorte = (pontos: Ponto[], depois: boolean) => {
    const k = pontos.findIndex((p) => p.dia >= corte);
    return depois ? pontos.slice(Math.max(0, k - aquecimento)) : pontos.slice(0, k);
  };

  let melhor: { p: ParametrosGrade; nota: number } | null = null;
  let testadas = 0;
  for (const quedaPct of [5, 10, 15, 20])
    for (const alvoPct of [3, 5, 10, 20])
      for (const partes of [1, 2, 4])
        for (const filtroTendencia of [true, false]) {
          const p = { ...g, quedaPct, alvoPct, partes, filtroTendencia, espacamentoPct: quedaPct };
          testadas++;
          const excessos: number[] = [];
          for (const pontos of series.values()) {
            const r = backtestGrade(recorte(pontos, false), taxas, p, c, capital);
            if (r) excessos.push(Math.log(r.final / r.cdiFinal));
          }
          if (excessos.length === 0) continue;
          /* Media do log: perder 90% numa moeda pesa mais que ganhar 90% noutra. */
          const nota = excessos.reduce((a, b) => a + b, 0) / excessos.length;
          if (!melhor || nota > melhor.nota) melhor = { p, nota };
        }

  const teste: Validacao['teste'] = [];
  if (melhor) {
    for (const [moeda, pontos] of series) {
      const r = backtestGrade(recorte(pontos, true), taxas, melhor.p, c, capital);
      if (r) teste.push({ moeda, final: r.final, cdiFinal: r.cdiFinal, segurarFinal: r.segurarFinal, piorQuedaPct: r.piorQuedaPct });
    }
  }

  return { corte, combinacoesTestadas: testadas, escolhida: melhor?.p ?? null, teste };
}

export const criptoService = new CriptoService();
