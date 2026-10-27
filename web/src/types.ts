export interface HistoryPoint {
  at: string;
  price: number;
}

export interface Offer {
  price: number;
  currency?: string;
  airline: string | null;
  cabin: string | null;
  checked_bags: number | null;
  stops_out: number | null;
  stops_ret: number | null;
  depart_at: string | null;
  return_at: string | null;
  link: string | null;
  source: string | null;
}

export interface LastCheck {
  checked_at: string;
  status: 'ok' | 'empty' | 'error';
  provider: string | null;
  error: string | null;
}

/** Menor preço de um dia de ida dentro da janela da rota. */
export interface DayPrice {
  date: string;
  price: number;
}

export interface Route {
  id: number;
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  /** Dias para cada lado da ida que também são consultados. 0 = data fixa. */
  depart_window_days: number;
  adults: number;
  price_limit: number | null;
  max_stops: number;
  require_checked_bag: number;
  notes: string | null;
  active: number;
  created_at: string;

  current: number | null;
  previous: number | null;
  variation: number | null;
  variationPct: number | null;
  lowest: number | null;
  highest: number | null;
  average: number | null;
  checks: number;

  bestOffer: Offer | null;
  lastCheck: LastCheck | null;
  history: HistoryPoint[];
  /* Opcional: monitor antigo, ainda sem reiniciar, não manda. */
  byDate?: DayPrice[];
}

/** Um alerta já disparado, com o contexto da rota que o gerou. */
export interface AlertEntry {
  id: number;
  route_id: number;
  sent_at: string;
  reason: string;
  price: number;
  message: string;
  origin: string;
  destination: string;
  depart_date: string;
}

export interface SourceHealth {
  name: string;
  state: 'ok' | 'instavel' | 'fora';
  attempts: number;
  failures: number;
  consecutiveFailures: number;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  pausedUntil: string | null;
}

export interface Status {
  providers: string[];
  /* Opcional: monitor antigo, ainda sem reiniciar, não manda. */
  sources?: SourceHealth[];
  scheduleTimes: string[];
  timezone: string;
  nextRun: string | null;
  lastRun: string | null;
  running: boolean;
  mode: 'merge' | 'failover';
  telegram: boolean;
  channels?: Record<'desktop' | 'telegram', { ok: boolean | null; at: string | null; error: string | null }>;
  dropAlertPct: number;
  cooldownHours: number;
  /* Opcional porque um monitor ainda não reiniciado não manda este campo. */
  backup?: {
    enabled: boolean;
    at: string | null;
    bytes: number | null;
    keep: number;
    time: string;
  };
}

export interface CheckResult {
  routeId: number;
  status: 'ok' | 'empty' | 'error';
  provider?: string;
  bestPrice?: number;
  bestDate?: string | null;
  datesSearched?: number;
  error?: string;
}

/* --- Câmbio ---------------------------------------------------------------- */

export type Ativo = 'USD' | 'EUR' | 'DOLA11';

export type TipoSinal =
  | 'compra'
  | 'aguardar_virada'
  | 'neutro'
  | 'caro'
  | 'venda'
  | 'stop'
  | 'segurar';

export interface PontoCambio {
  dia: string;
  valor: number;
}

export interface CustosCambio {
  iofCompraPct: number;
  iofVendaPct: number;
  spreadPct: number;
  irGanhoPct: number;
}

export interface PosicaoCambio {
  ativo: Ativo;
  quantidade: number;
  custo: number;
  liquidacao: number;
  resultado: number;
  resultadoPct: number;
  realizado: number;
  precoMedio: number | null;
  precoAlvo: number | null;
  precoStop: number | null;
}

export interface PainelAtivo {
  ativo: Ativo;
  nome: string;
  unidade: string;
  referencia: 'USD' | 'EUR';
  preco: number | null;
  precoDia: string | null;
  referenciaAtual: number | null;
  indicadores: {
    atual: number;
    minLongo: number;
    maxLongo: number;
    mediaLongo: number;
    posicaoFaixa: number;
    zScore: number;
    variacaoCurtaPct: number;
    virouParaCima: boolean;
    volatilidadeAnualPct: number;
    movimentoTipico30dPct: number;
  } | null;
  sinal: { tipo: TipoSinal; motivo: string } | null;
  historico: { ocorrencias: number; acertos: number; horizonteDias: number } | null;
  custos: CustosCambio;
  empatePct: number;
  posicao: PosicaoCambio | null;
  grafico: PontoCambio[];
}

export interface PanoramaCambio {
  atualizadoEm: string | null;
  parametros: {
    janelaCurta: number;
    janelaLonga: number;
    zonaCompra: number;
    zonaVenda: number;
    alvoLucroPct: number;
    stopPct: number;
  };
  ativos: PainelAtivo[];
}

export interface OperacaoCambio {
  id: number;
  ativo: Ativo;
  tipo: 'compra' | 'venda';
  dia: string;
  valor_brl: number;
  quantidade: number;
  plataforma: string | null;
  notas: string | null;
}

export interface CarteiraCambio {
  investido: number;
  patrimonio: number;
  patrimonioCdi: number | null;
  posicoes: PosicaoCambio[];
  operacoes: OperacaoCambio[];
}

export interface BacktestCambio {
  inicio: string;
  fim: string;
  capitalInicial: number;
  final: number;
  retornoPct: number;
  cdiFinal: number;
  cdiRetornoPct: number;
  segurarFinal: number;
  piorQuedaPct: number;
  operacoes: Array<{ tipo: 'compra' | 'venda'; dia: string; taxa: number; brl: number; motivo: string }>;
}

/* --- Cripto ---------------------------------------------------------------- */

export type SinalCripto =
  | 'queda_boa'
  | 'comprar_mais'
  | 'vender'
  | 'stop'
  | 'segurar'
  | 'queda_arriscada'
  | 'queda_em_baixa'
  | 'sem_queda';

export interface ParametrosGrade {
  janelaQueda: number;
  quedaPct: number;
  alvoPct: number;
  stopPct: number;
  partes: number;
  espacamentoPct: number;
  tendenciaDias: number;
  filtroTendencia: boolean;
}

export interface EstatisticaQuedas {
  quedaPct: number;
  janelaQueda: number;
  horizonteDias: number;
  ocorrencias: number;
  recuperou: number;
  ocorrenciasEmAlta: number;
  recuperouEmAlta: number;
  diasMediana: number | null;
  quedaExtraMediaPct: number;
}

export interface LoteCripto {
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
  taxaRecuperacao: number | null;
  sinal: SinalCripto;
  motivo: string;
  lotes: LoteCripto[];
  grafico: PontoCambio[];
}

export interface RadarCripto {
  atualizadoEm: string | null;
  grade: ParametrosGrade;
  empatePct: number;
  custos: CustosCambio;
  taxaMinima: number;
  moedas: RadarMoeda[];
}

export interface OperacaoCripto {
  id: number;
  moeda: string;
  tipo: 'compra' | 'venda';
  dia: string;
  valor_brl: number;
  quantidade: number;
  lote_id: number | null;
  plataforma: string | null;
  notas: string | null;
}

export interface CarteiraCripto {
  investido: number;
  patrimonio: number;
  patrimonioCdi: number | null;
  realizado: number;
  operacoes: OperacaoCripto[];
}

export interface ResultadoGrade {
  inicio: string;
  fim: string;
  capitalInicial: number;
  final: number;
  retornoPct: number;
  cdiFinal: number;
  cdiRetornoPct: number;
  segurarFinal: number;
  compras: number;
  vendasNoAlvo: number;
  vendasNoStop: number;
  piorQuedaPct: number;
  meses: Array<{ mes: string; retornoPct: number }>;
  lotesAbertos: number;
}

export interface EstudoCripto {
  moeda: string;
  inicio: string;
  fim: string;
  quedas: EstatisticaQuedas[];
  configurada: ResultadoGrade | null;
  diario: ResultadoGrade | null;
  melhores: Array<{ parametros: ParametrosGrade; resultado: ResultadoGrade }>;
  combinacoesTestadas: number;
}
