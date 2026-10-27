import { useCallback, useEffect, useState } from 'react';
import CambioChart from '../components/CambioChart';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  inputClass,
  Modal,
  Skeleton,
  StatTile,
} from '../components/ui';
import { api, type OperacaoCriptoPayload } from '../lib/api';
import { desde, dia } from '../lib/format';
import { useMonitor } from '../lib/store';
import type {
  CarteiraCripto,
  EstudoCripto,
  LoteCripto,
  OperacaoCripto,
  RadarCripto,
  RadarMoeda,
  ResultadoGrade,
  SinalCripto,
} from '../types';

const reais = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

/** BTC de seis dígitos sem centavo; moeda de R$ 2 com quatro casas. */
const casasDe = (v: number) => (v >= 1000 ? 0 : v >= 10 ? 2 : 4);
const preco = (v: number | null | undefined) =>
  v == null
    ? '—'
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casasDe(v), maximumFractionDigits: casasDe(v) })}`;

const pct = (v: number | null | undefined, casas = 1) =>
  v == null
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

const tomVar = (v: number | null) => (v == null ? 'text-faint' : v >= 0 ? 'text-mint' : 'text-rose');

const SINAIS: Record<SinalCripto, { rotulo: string; tom: 'mint' | 'amber' | 'rose' | 'muted' | 'ink' }> = {
  queda_boa: { rotulo: 'queda boa', tom: 'mint' },
  comprar_mais: { rotulo: 'comprar mais', tom: 'mint' },
  vender: { rotulo: 'vender', tom: 'mint' },
  stop: { rotulo: 'stop', tom: 'rose' },
  segurar: { rotulo: 'segurar', tom: 'ink' },
  queda_arriscada: { rotulo: 'queda arriscada', tom: 'amber' },
  queda_em_baixa: { rotulo: 'em baixa', tom: 'rose' },
  sem_queda: { rotulo: 'sem queda', tom: 'muted' },
};

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Aceita "1.234,56" e "1234.56": quem copia do app traz o formato dele. */
const num = (v: string) => {
  const t = v.trim();
  if (!t) return 0;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};

interface Lancamento {
  moeda: string;
  tipo: 'compra' | 'venda';
  lote?: LoteCripto;
}

function FormCripto({
  radar,
  inicial,
  onSalvar,
  onCancel,
}: {
  radar: RadarCripto;
  inicial: Lancamento;
  onSalvar: (op: OperacaoCriptoPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    moeda: inicial.moeda,
    dia: hojeLocal(),
    valor: '',
    precoPago: '',
    quantidade: '',
    plataforma: 'BTG',
  });
  const [ocupado, setOcupado] = useState(false);
  const set = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  const compra = inicial.tipo === 'compra';
  const m = radar.moedas.find((x) => x.moeda === form.moeda);
  const valor = num(form.valor);
  const precoPago = num(form.precoPago);
  const qtdInf = num(form.quantidade);
  const spread = radar.custos.spreadPct / 100;

  const qtd = compra
    ? qtdInf > 0
      ? qtdInf
      : precoPago > 0
        ? valor / precoPago
        : m?.preco && valor > 0
          ? valor / (m.preco * (1 + spread))
          : 0
    : (inicial.lote?.quantidade ?? 0);
  const recebidoEstimado = !compra && m?.preco ? qtd * m.preco * (1 - spread) : null;

  async function salvar() {
    setOcupado(true);
    try {
      await onSalvar({
        moeda: form.moeda,
        tipo: inicial.tipo,
        dia: form.dia,
        valor_brl: valor > 0 ? valor : null,
        quantidade: compra && qtdInf > 0 ? qtdInf : null,
        preco_pago: compra && precoPago > 0 ? precoPago : null,
        lote_id: inicial.lote?.id ?? null,
        plataforma: form.plataforma || null,
        notas: null,
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      title={compra ? `Registrar compra de ${form.moeda}` : `Registrar venda de ${form.moeda}`}
      onClose={ocupado ? () => {} : onCancel}
      width="max-w-[520px]"
    >
      <p className="mb-4 text-[12.5px] leading-snug text-muted">
        {compra
          ? 'Cada compra vira uma parte com alvo e stop próprios. Só o valor e o dia são obrigatórios.'
          : `Fecha a parte comprada a ${preco(inicial.lote?.preco)} em ${dia(inicial.lote?.dia)}. ` +
            'Sem o valor recebido, o painel estima pela cotação do dia e pelas taxas.'}
      </p>
      <div className="grid grid-cols-2 gap-3.5">
        {compra && (
          <Field label="Moeda" htmlFor="cr-moeda">
            <select id="cr-moeda" className={inputClass} value={form.moeda} onChange={set('moeda')}>
              {radar.moedas.map((x) => (
                <option key={x.moeda} value={x.moeda}>
                  {x.moeda}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Dia" htmlFor="cr-dia">
          <input id="cr-dia" type="date" className={inputClass} value={form.dia} onChange={set('dia')} />
        </Field>
        <Field
          label={compra ? 'Reais investidos' : 'Reais recebidos (opcional)'}
          htmlFor="cr-valor"
          hint="o total, com a taxa"
        >
          <input id="cr-valor" inputMode="decimal" className={inputClass} value={form.valor} onChange={set('valor')} placeholder="25,00" />
        </Field>
        {compra && (
          <>
            <Field label="Preço pago (opcional)" htmlFor="cr-preco" hint="por moeda, como o app mostrou">
              <input
                id="cr-preco"
                inputMode="decimal"
                className={inputClass}
                value={form.precoPago}
                onChange={set('precoPago')}
                placeholder={m?.preco ? preco(m.preco).replace('R$ ', '') : ''}
              />
            </Field>
            <Field label={`Quantidade de ${form.moeda} (opcional)`} htmlFor="cr-qtd" hint="o mais exato, se souber">
              <input id="cr-qtd" inputMode="decimal" className={inputClass} value={form.quantidade} onChange={set('quantidade')} />
            </Field>
          </>
        )}
        <Field label="Plataforma" htmlFor="cr-plat">
          <input id="cr-plat" className={inputClass} value={form.plataforma} onChange={set('plataforma')} />
        </Field>
      </div>

      <p className="mt-4 font-mono text-[11.5px] text-muted">
        {compra
          ? qtd > 0 && `≈ ${qtd.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} ${form.moeda}`
          : recebidoEstimado != null && !(valor > 0) && `≈ ${reais(recebidoEstimado)} pela cotação de agora`}
      </p>

      <div className="mt-4 flex gap-2.5">
        <Button variant="solid" onClick={() => void salvar()} disabled={ocupado || (compra && !(valor > 0))}>
          {ocupado ? 'salvando…' : 'salvar'}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={ocupado}>
          cancelar
        </Button>
      </div>
    </Modal>
  );
}

function LinhaMoeda({
  m,
  selecionada,
  onSelect,
  onComprar,
}: {
  m: RadarMoeda;
  selecionada: boolean;
  onSelect: () => void;
  onComprar: () => void;
}) {
  const s = SINAIS[m.sinal];
  const e = m.estatistica;
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-t border-rule transition-colors ${selecionada ? 'bg-panel-2' : 'hover:bg-panel-2/50'}`}
    >
      <td className="py-2.5 pl-4 font-mono text-[13px] text-ink sm:pl-5">{m.moeda}</td>
      <td className="py-2.5 text-right">{preco(m.preco)}</td>
      <td className={`py-2.5 text-right ${tomVar(m.variacao.d1)}`}>{pct(m.variacao.d1)}</td>
      <td className={`hidden py-2.5 text-right md:table-cell ${tomVar(m.variacao.d7)}`}>{pct(m.variacao.d7)}</td>
      <td className={`hidden py-2.5 text-right md:table-cell ${tomVar(m.variacao.d30)}`}>{pct(m.variacao.d30)}</td>
      <td className="py-2.5 text-right">{m.quedaDoTopoPct == null ? '—' : `−${m.quedaDoTopoPct.toFixed(1).replace('.', ',')}%`}</td>
      <td className="hidden py-2.5 text-right lg:table-cell">
        {e && e.ocorrencias > 0 ? `${e.recuperou}/${e.ocorrencias}` : '—'}
      </td>
      <td className="py-2.5 pl-3">
        <Badge tone={s.tom}>{s.rotulo}</Badge>
        {m.lotes.length > 0 && <span className="ml-1.5 font-mono text-[10.5px] text-faint">{m.lotes.length}p</span>}
      </td>
      <td className="py-2.5 pr-4 text-right sm:pr-5">
        <Button
          size="sm"
          variant={m.sinal === 'queda_boa' || m.sinal === 'comprar_mais' ? 'solid' : 'quiet'}
          onClick={(ev) => {
            ev.stopPropagation();
            onComprar();
          }}
        >
          comprei
        </Button>
      </td>
    </tr>
  );
}

function DetalheMoeda({
  m,
  radar,
  onVender,
}: {
  m: RadarMoeda;
  radar: RadarCripto;
  onVender: (lote: LoteCripto) => void;
}) {
  const e = m.estatistica;
  const g = radar.grade;
  return (
    <Card title={`${m.moeda} — últimos ${m.grafico.length} dias`} className="mb-5">
      <p className="mb-3 text-[13px] text-muted">{m.motivo}</p>
      <CambioChart
        serie={m.grafico}
        janelaLonga={30}
        zonaCompra={0.2}
        zonaVenda={0.8}
        casas={m.preco ? casasDe(m.preco) : 2}
        rotuloJanela="d"
      />

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[11.5px] sm:grid-cols-4">
        <div>
          <dt className="text-faint">volatilidade anual</dt>
          <dd className="text-ink">{m.volatilidadeAnualPct == null ? '—' : `${Math.round(m.volatilidadeAnualPct)}%`}</dd>
        </div>
        <div>
          <dt className="text-faint">tendência {g.tendenciaDias}d</dt>
          <dd className={m.tendenciaAlta ? 'text-mint' : 'text-rose'}>{m.tendenciaAlta == null ? '—' : m.tendenciaAlta ? 'alta' : 'baixa'}</dd>
        </div>
        <div>
          <dt className="text-faint">quedas de {g.quedaPct}%+ que voltaram</dt>
          <dd className="text-ink">
            {e && e.ocorrencias ? `${e.recuperou} de ${e.ocorrencias} (${Math.round((e.recuperou / e.ocorrencias) * 100)}%)` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-faint">dias até o alvo (mediana)</dt>
          <dd className="text-ink">{e?.diasMediana ?? '—'}</dd>
        </div>
      </dl>

      {m.lotes.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="eyebrow text-left">
                <th className="pb-2 font-normal">Parte</th>
                <th className="pb-2 text-right font-normal">Pagou</th>
                <th className="pb-2 text-right font-normal">Vale hoje</th>
                <th className="pb-2 text-right font-normal">Vender a</th>
                <th className="pb-2 text-right font-normal">Stop</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="tabular">
              {m.lotes.map((l) => (
                <tr key={l.id} className="border-t border-rule">
                  <td className="py-2 font-mono text-[12px]">
                    {dia(l.dia)} · {preco(l.preco)}
                  </td>
                  <td className="py-2 text-right">{reais(l.custo)}</td>
                  <td className={`py-2 text-right ${l.resultadoPct >= 0 ? 'text-mint' : 'text-rose'}`}>
                    {reais(l.valorHoje)} ({pct(l.resultadoPct)})
                  </td>
                  <td className="py-2 text-right text-mint">{preco(l.precoAlvo)}</td>
                  <td className="py-2 text-right text-rose">{preco(l.precoStop)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant={l.resultadoPct >= g.alvoPct || (g.stopPct > 0 && l.resultadoPct <= -g.stopPct) ? 'solid' : 'outline'}
                      onClick={() => onVender(l)}
                    >
                      vendi
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Carteira({ carteira, onMudou }: { carteira: CarteiraCripto; onMudou: () => Promise<void> }) {
  const { toast } = useMonitor();
  const [removendo, setRemovendo] = useState<OperacaoCripto | null>(null);
  const vsCdi = carteira.patrimonioCdi != null ? carteira.patrimonio - carteira.patrimonioCdi : null;

  async function remover() {
    if (!removendo) return;
    try {
      await api.criptoRemover(removendo.id);
      toast('Operação removida.', 'ok');
      setRemovendo(null);
      await onMudou();
    } catch (err) {
      toast(`Não removi: ${(err as Error).message}`, 'bad');
    }
  }

  if (carteira.operacoes.length === 0) {
    return (
      <Card title="Sua carteira de cripto" className="mb-5">
        <p className="text-muted">
          Nenhuma compra ainda. Quando comprar, clique em "comprei" na moeda: cada compra vira uma parte, e o radar passa a
          avisar quando ela bater o alvo ou o stop.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Sua carteira de cripto" className="mb-5">
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Investido" value={reais(carteira.investido)} />
        <StatTile
          label="Patrimônio hoje"
          value={reais(carteira.patrimonio)}
          tone={carteira.patrimonio >= carteira.investido ? 'mint' : 'rose'}
          note={`realizado ${reais(carteira.realizado)}`}
        />
        <StatTile label="No CDI seria" value={reais(carteira.patrimonioCdi)} />
        <StatTile
          label="Contra o CDI"
          value={vsCdi == null ? '—' : `${vsCdi >= 0 ? '+' : ''}${reais(vsCdi)}`}
          tone={vsCdi == null ? 'ink' : vsCdi >= 0 ? 'mint' : 'rose'}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <tbody className="tabular">
            {carteira.operacoes.map((op) => (
              <tr key={op.id} className="border-t border-rule">
                <td className="py-2 font-mono text-[12px]">{dia(op.dia)}</td>
                <td className="py-2">
                  <Badge tone={op.tipo === 'compra' ? 'mint' : 'amber'}>{op.tipo}</Badge>{' '}
                  <span className="font-mono">{op.moeda}</span>
                  {op.plataforma && <span className="text-faint"> · {op.plataforma}</span>}
                </td>
                <td className="py-2 text-right">{reais(op.valor_brl)}</td>
                <td className="py-2 text-right">{preco(op.valor_brl / op.quantidade)}</td>
                <td className="py-2 text-right">
                  <Button variant="danger" size="sm" onClick={() => setRemovendo(op)}>
                    remover
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removendo && (
        <ConfirmDialog title="Remover operação" confirmLabel="remover" onConfirm={remover} onCancel={() => setRemovendo(null)}>
          Remover a {removendo.tipo} de {reais(removendo.valor_brl)} em {removendo.moeda}?
          {removendo.tipo === 'compra' && ' Se essa parte já foi vendida, a venda sai junto.'}
        </ConfirmDialog>
      )}
    </Card>
  );
}

function LinhaResultado({ nome, r, destaque }: { nome: string; r: ResultadoGrade | null; destaque?: boolean }) {
  if (!r) return null;
  const ganhou = r.final > r.cdiFinal;
  return (
    <tr className="border-t border-rule">
      <td className={`py-2 ${destaque ? 'text-ink' : 'text-muted'}`}>{nome}</td>
      <td className={`py-2 text-right ${ganhou ? 'text-mint' : 'text-rose'}`}>{reais(r.final)}</td>
      <td className="py-2 text-right">{reais(r.cdiFinal)}</td>
      <td className="py-2 text-right text-amber">{pct(-r.piorQuedaPct)}</td>
      <td className="hidden py-2 text-right sm:table-cell">{r.compras}</td>
    </tr>
  );
}

function Estudo({ moedas, inicial }: { moedas: string[]; inicial: string }) {
  const [moeda, setMoeda] = useState(inicial);
  const [estudo, setEstudo] = useState<EstudoCripto | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState('');

  async function rodar() {
    setRodando(true);
    setErro('');
    try {
      setEstudo(await api.criptoEstudo(moeda));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setRodando(false);
    }
  }

  const e = estudo;
  const melhor = e?.melhores[0];
  return (
    <Card title="Histórico de quedas e o que teria acontecido">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Moeda" htmlFor="es-moeda">
          <select id="es-moeda" className={inputClass} value={moeda} onChange={(ev) => setMoeda(ev.target.value)}>
            {moedas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Button onClick={() => void rodar()} disabled={rodando}>
          {rodando ? 'calculando…' : 'estudar com R$ 100'}
        </Button>
      </div>
      {erro && <p className="mt-3 text-rose">{erro}</p>}

      {e && (
        <>
          <p className="mt-4 text-[12.5px] text-muted">
            {e.moeda} de {dia(e.inicio)} a {dia(e.fim)}. "Voltou" = subiu o bastante para pagar as taxas e o alvo em até{' '}
            {e.quedas[0]?.horizonteDias} dias.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="pb-2 font-normal">Queda em {e.quedas[0]?.janelaQueda} dias</th>
                  <th className="pb-2 text-right font-normal">Vezes</th>
                  <th className="pb-2 text-right font-normal">Voltou</th>
                  <th className="pb-2 text-right font-normal">Caiu mais antes (média)</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {e.quedas.map((q) => (
                  <tr key={q.quedaPct} className="border-t border-rule">
                    <td className="py-2">{q.quedaPct}% ou mais</td>
                    <td className="py-2 text-right">{q.ocorrencias}</td>
                    <td className="py-2 text-right">
                      {q.ocorrencias ? `${Math.round((q.recuperou / q.ocorrencias) * 100)}%` : '—'}
                    </td>
                    <td className="py-2 text-right text-amber">−{q.quedaExtraMediaPct.toFixed(1).replace('.', ',')}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="pb-2 font-normal">R$ 100 operando assim</th>
                  <th className="pb-2 text-right font-normal">Final</th>
                  <th className="pb-2 text-right font-normal">CDI</th>
                  <th className="pb-2 text-right font-normal">Pior queda</th>
                  <th className="hidden pb-2 text-right font-normal sm:table-cell">Compras</th>
                </tr>
              </thead>
              <tbody className="tabular">
                <LinhaResultado nome="Regra do radar" r={e.configurada} destaque />
                <LinhaResultado nome="Todo dia (cai 1%, vende +1%)" r={e.diario} />
                {melhor && (
                  <LinhaResultado
                    nome={`Melhor olhando p/ trás (queda ${melhor.parametros.quedaPct}%, alvo ${melhor.parametros.alvoPct}%)`}
                    r={melhor.resultado}
                  />
                )}
              </tbody>
            </table>
          </div>
          {e.configurada && (
            <p className="mt-3 text-[12.5px] text-muted">
              Comprar no primeiro dia e segurar até hoje: {reais(e.configurada.segurarFinal)}. "Melhor olhando para trás" é
              a melhor de {e.combinacoesTestadas} combinações escolhida já sabendo o resultado — no teste honesto (escolha com
              dados até jul/2024, medida depois), a regra do radar ficou perto do CDI.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Carregando() {
  return (
    <>
      <Skeleton className="mb-5 h-[420px] rounded-md" />
      <Skeleton className="h-[260px] rounded-md" />
    </>
  );
}

export default function Cripto() {
  const { toast } = useMonitor();
  const [radar, setRadar] = useState<RadarCripto | null>(null);
  const [carteira, setCarteira] = useState<CarteiraCripto | null>(null);
  const [erro, setErro] = useState('');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([api.cripto(), api.criptoCarteira()]);
      setRadar(r);
      setCarteira(c);
      setErro('');
    } catch (err) {
      setErro((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // Mesmo caso do store: o setState acontece na volta da rede, não no efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const timer = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(timer);
  }, [carregar]);

  async function atualizar() {
    setAtualizando(true);
    try {
      setRadar(await api.criptoAtualizar());
      setCarteira(await api.criptoCarteira());
      toast('Cotações atualizadas.', 'ok');
    } catch (err) {
      toast(`Falha ao atualizar: ${(err as Error).message}`, 'bad');
    } finally {
      setAtualizando(false);
    }
  }

  async function salvar(op: OperacaoCriptoPayload) {
    try {
      await api.criptoRegistrar(op);
      toast(op.tipo === 'compra' ? 'Compra registrada. O radar passa a acompanhar essa parte.' : 'Venda registrada.', 'ok');
      setLancamento(null);
      await carregar();
    } catch (err) {
      toast(`Não salvei: ${(err as Error).message}`, 'bad');
    }
  }

  if (erro && !radar) return <EmptyState title="Sem contato com o servidor">{erro}</EmptyState>;
  if (!radar || !carteira) return <Carregando />;
  if (radar.moedas.length === 0) {
    return <EmptyState title="Radar vazio">Configure CRIPTO_MOEDAS no .env (ex.: BTC,ETH,SOL) e reinicie o monitor.</EmptyState>;
  }

  const g = radar.grade;
  const atual = radar.moedas.find((m) => m.moeda === selecionada) ?? radar.moedas[0];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11.5px] text-muted">
          cotações {desde(radar.atualizadoEm)} · taxa {pct(radar.custos.spreadPct)} por perna (empate {pct(radar.empatePct)}) · compra
          em queda de {g.quedaPct}% em {g.janelaQueda}d · {g.partes} partes · vende com {pct(g.alvoPct)} líquido · stop{' '}
          {pct(-g.stopPct)}
        </p>
        <Button size="sm" onClick={() => void atualizar()} disabled={atualizando}>
          {atualizando ? 'buscando…' : 'atualizar cotações'}
        </Button>
      </div>

      <Card title="Radar de quedas" bodyClass="" className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="eyebrow text-left">
                <th className="py-2.5 pl-4 font-normal sm:pl-5">Moeda</th>
                <th className="py-2.5 text-right font-normal">Preço</th>
                <th className="py-2.5 text-right font-normal">24h</th>
                <th className="hidden py-2.5 text-right font-normal md:table-cell">7d</th>
                <th className="hidden py-2.5 text-right font-normal md:table-cell">30d</th>
                <th className="py-2.5 text-right font-normal">Do topo</th>
                <th className="hidden py-2.5 text-right font-normal lg:table-cell">Voltou</th>
                <th className="py-2.5 pl-3 font-normal">Sinal</th>
                <th className="py-2.5 pr-4 sm:pr-5" />
              </tr>
            </thead>
            <tbody className="tabular">
              {radar.moedas.map((m) => (
                <LinhaMoeda
                  key={m.moeda}
                  m={m}
                  selecionada={m.moeda === atual.moeda}
                  onSelect={() => setSelecionada(m.moeda)}
                  onComprar={() => setLancamento({ moeda: m.moeda, tipo: 'compra' })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DetalheMoeda m={atual} radar={radar} onVender={(lote) => setLancamento({ moeda: atual.moeda, tipo: 'venda', lote })} />

      <Carteira carteira={carteira} onMudou={carregar} />

      <Estudo moedas={radar.moedas.map((m) => m.moeda)} inicial={atual.moeda} />

      <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
        Cripto pode cair 50% ou mais e levar anos para voltar — ou não voltar. Os sinais são estatística sobre o passado, não
        recomendação de investimento. Até R$ 35 mil de vendas por mês o ganho é isento de IR; confira as regras vigentes.
      </p>

      {lancamento && (
        <FormCripto radar={radar} inicial={lancamento} onSalvar={salvar} onCancel={() => setLancamento(null)} />
      )}
    </>
  );
}
