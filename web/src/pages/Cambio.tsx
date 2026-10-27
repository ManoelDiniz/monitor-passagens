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
import { api, type OperacaoPayload } from '../lib/api';
import { desde, dia } from '../lib/format';
import { useMonitor } from '../lib/store';
import type {
  Ativo,
  BacktestCambio,
  CarteiraCambio,
  OperacaoCambio,
  PainelAtivo,
  PanoramaCambio,
  TipoSinal,
} from '../types';

const reais = (v: number | null | undefined) =>
  v == null
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const cotacao = (v: number | null | undefined, casas = 4) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: casas });

const pct = (v: number, casas = 1) =>
  `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

const SINAIS: Record<TipoSinal, { rotulo: string; tom: 'mint' | 'amber' | 'rose' | 'muted' | 'ink' }> = {
  compra: { rotulo: 'compra', tom: 'mint' },
  aguardar_virada: { rotulo: 'aguardar virada', tom: 'amber' },
  neutro: { rotulo: 'neutro', tom: 'muted' },
  caro: { rotulo: 'caro', tom: 'rose' },
  venda: { rotulo: 'venda', tom: 'mint' },
  stop: { rotulo: 'stop', tom: 'rose' },
  segurar: { rotulo: 'segurar', tom: 'ink' },
};

/** A régua da janela longa: onde o preço de hoje está entre a mínima e a máxima. */
function Faixa({ painel, zonaCompra, zonaVenda }: { painel: PainelAtivo; zonaCompra: number; zonaVenda: number }) {
  const ind = painel.indicadores;
  if (!ind) return null;

  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-rule">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-mint/40" style={{ width: `${zonaCompra * 100}%` }} />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-amber/40"
          style={{ width: `${(1 - zonaVenda) * 100}%` }}
        />
        <span
          className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${Math.min(1, Math.max(0, ind.posicaoFaixa)) * 100}%` }}
        />
      </div>
      <div className="tabular mt-1.5 flex justify-between font-mono text-[10.5px] text-faint">
        <span>{cotacao(ind.minLongo)}</span>
        <span>{Math.round(ind.posicaoFaixa * 100)}% da faixa</span>
        <span>{cotacao(ind.maxLongo)}</span>
      </div>
    </div>
  );
}

function CartaoAtivo({
  painel,
  parametros,
  ativo,
  onSelect,
  onLancar,
}: {
  painel: PainelAtivo;
  parametros: PanoramaCambio['parametros'];
  ativo: boolean;
  onSelect: () => void;
  onLancar: (tipo: 'compra' | 'venda') => void;
}) {
  const s = painel.sinal ? SINAIS[painel.sinal.tipo] : null;
  const ind = painel.indicadores;
  const h = painel.historico;
  const pos = painel.posicao;
  const aberta = pos != null && pos.quantidade > 0;

  /* Div e não button: o cartão tem botões dentro, e botão dentro de botão
     não é HTML válido — o navegador desmonta a estrutura. */
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onSelect();
      }}
      className={`flex cursor-pointer flex-col rounded-md border bg-panel px-4 py-4 text-left transition-colors
                  ${ativo ? 'border-mint' : 'border-rule hover:border-rule-2'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow block">{painel.ativo}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">{painel.nome}</span>
        </div>
        {s && <Badge tone={s.tom}>{s.rotulo}</Badge>}
      </div>

      <div className="display-tight tabular mt-2.5 text-[27px] leading-none">
        <span className="mr-1 text-[15px] text-muted">R$</span>
        {cotacao(painel.preco)}
      </div>
      <p className="mt-1 font-mono text-[11px] text-faint">
        {painel.precoDia ? dia(painel.precoDia) : 'sem cotação ainda'}
        {ind && ` · ${pct(ind.variacaoCurtaPct)} em ${parametros.janelaCurta}d`}
      </p>

      {painel.sinal && <p className="mt-2.5 text-[12.5px] leading-snug text-muted">{painel.sinal.motivo}</p>}

      <Faixa painel={painel} zonaCompra={parametros.zonaCompra} zonaVenda={parametros.zonaVenda} />

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
        <dt className="text-faint">empate</dt>
        <dd className="tabular text-right text-ink">{pct(painel.empatePct, 2)}</dd>
        {ind && (
          <>
            <dt className="text-faint">movimento típico 30d</dt>
            <dd className="tabular text-right text-ink">±{ind.movimentoTipico30dPct.toFixed(1).replace('.', ',')}%</dd>
          </>
        )}
        {h && h.ocorrencias > 0 && (
          <>
            <dt className="text-faint">zona de compra pagou</dt>
            <dd className="tabular text-right text-ink">
              {h.acertos}/{h.ocorrencias} vezes
            </dd>
          </>
        )}
      </dl>

      {aberta && <Recomendacao painel={painel} />}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button
          size="sm"
          variant={painel.sinal?.tipo === 'compra' ? 'solid' : 'outline'}
          onClick={(e) => {
            e.stopPropagation();
            onLancar('compra');
          }}
        >
          investi aqui
        </Button>
        {aberta && (
          <Button
            size="sm"
            variant={painel.sinal?.tipo === 'venda' || painel.sinal?.tipo === 'stop' ? 'solid' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              onLancar('venda');
            }}
          >
            registrar venda
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A posição aberta traduzida em decisão: quanto vale agora e em que preço
 * vender — no alvo, ou no stop para a perda não crescer.
 */
function Recomendacao({ painel }: { painel: PainelAtivo }) {
  const pos = painel.posicao!;
  const tipo = painel.sinal?.tipo;
  const casas = painel.ativo === 'DOLA11' ? 2 : 4;

  const titulo =
    tipo === 'venda'
      ? 'Recomendação: vender agora'
      : tipo === 'stop'
        ? 'Recomendação: sair agora (stop)'
        : 'Recomendação: segurar';
  const tom = tipo === 'venda' ? 'border-mint text-mint' : tipo === 'stop' ? 'border-rose text-rose' : 'border-rule-2 text-ink';

  return (
    <div className={`mt-3 rounded-sm border px-3 py-2.5 ${tom}`}>
      <strong className="block text-[13px]">{titulo}</strong>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
        <dt>você tem</dt>
        <dd className="tabular text-right text-ink">
          {cotacao(pos.quantidade, 4)} {painel.unidade}
        </dd>
        <dt>pagou (médio)</dt>
        <dd className="tabular text-right text-ink">R$ {cotacao(pos.precoMedio, casas)}</dd>
        <dt>vale hoje (líquido)</dt>
        <dd className={`tabular text-right ${pos.resultado >= 0 ? 'text-mint' : 'text-rose'}`}>
          {reais(pos.liquidacao)} ({pct(pos.resultadoPct)})
        </dd>
        <dt>vender no alvo a</dt>
        <dd className="tabular text-right text-mint">R$ {cotacao(pos.precoAlvo, casas)}</dd>
        <dt>stop se cair a</dt>
        <dd className="tabular text-right text-rose">R$ {cotacao(pos.precoStop, casas)}</dd>
      </dl>
    </div>
  );
}

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface Lancamento {
  ativo: Ativo;
  tipo: 'compra' | 'venda';
}

function FormOperacao({
  ativos,
  inicial,
  onSalvar,
  onCancel,
}: {
  ativos: PainelAtivo[];
  inicial: Lancamento;
  onSalvar: (op: OperacaoPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ativo: inicial.ativo as string,
    tipo: inicial.tipo,
    dia: hojeLocal(),
    valor_brl: '',
    preco_pago: '',
    quantidade: '',
    plataforma: '',
    notas: '',
  });
  const [ocupado, setOcupado] = useState(false);

  const set = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  /* Aceita "1.234,56" e "1234.56": quem copia da corretora traz o formato dela. */
  const num = (v: string) => {
    const t = v.trim();
    if (!t) return 0;
    return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  };
  const valor = num(form.valor_brl);
  const precoPago = num(form.preco_pago);
  const qtdInformada = num(form.quantidade);
  const painel = ativos.find((a) => a.ativo === form.ativo);
  const posicaoAberta = painel?.posicao?.quantidade ?? 0;

  /* A mesma regra do servidor, só para mostrar antes de salvar o que vai ser gravado. */
  const qtd =
    qtdInformada > 0
      ? qtdInformada
      : form.tipo === 'venda'
        ? posicaoAberta
        : precoPago > 0
          ? valor / precoPago
          : painel?.preco && valor > 0
            ? valor / (1 + painel.custos.iofCompraPct / 100) / (painel.preco * (1 + painel.custos.spreadPct / 100))
            : 0;
  const origemQtd =
    qtdInformada > 0
      ? null
      : form.tipo === 'venda'
        ? 'a posição inteira'
        : precoPago > 0
          ? 'pelo preço pago'
          : 'estimada pela cotação e pelos custos';
  const efetiva = valor > 0 && qtd > 0 ? valor / qtd : null;
  /* Quanto a plataforma cobrou de verdade acima da cotação de referência:
     é o número que diz se os custos do .env batem com a vida real. */
  const custoImplicito =
    efetiva && painel?.preco
      ? form.tipo === 'compra'
        ? (efetiva / painel.preco - 1) * 100
        : (1 - efetiva / painel.preco) * 100
      : null;

  async function salvar() {
    setOcupado(true);
    try {
      await onSalvar({
        ativo: form.ativo as Ativo,
        tipo: form.tipo,
        dia: form.dia,
        valor_brl: valor,
        quantidade: qtdInformada > 0 ? qtdInformada : null,
        preco_pago: precoPago > 0 ? precoPago : null,
        plataforma: form.plataforma || null,
        notas: form.notas || null,
      });
    } finally {
      setOcupado(false);
    }
  }

  const unidade = painel?.unidade ?? '';

  return (
    <Modal
      title={form.tipo === 'compra' ? 'Registrar investimento' : 'Registrar venda'}
      onClose={ocupado ? () => {} : onCancel}
      width="max-w-[560px]"
    >
      <p className="mb-4 text-[12.5px] leading-snug text-muted">
        {form.tipo === 'compra'
          ? 'Informe quanto investiu e quando. A partir daí o painel acompanha a posição e avisa a hora de vender.'
          : 'Informe quanto recebeu. Sem quantidade, considera a venda da posição inteira.'}
      </p>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Ativo" htmlFor="op-ativo">
          <select id="op-ativo" className={inputClass} value={form.ativo} onChange={set('ativo')}>
            {ativos.map((a) => (
              <option key={a.ativo} value={a.ativo}>
                {a.ativo} — {a.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo" htmlFor="op-tipo">
          <select id="op-tipo" className={inputClass} value={form.tipo} onChange={set('tipo')}>
            <option value="compra">compra</option>
            <option value="venda">venda</option>
          </select>
        </Field>
        <Field label="Dia" htmlFor="op-dia">
          <input id="op-dia" type="date" className={inputClass} value={form.dia} onChange={set('dia')} />
        </Field>
        <Field label="Plataforma" htmlFor="op-plat" hint="corretora, Wise, Nomad…">
          <input id="op-plat" className={inputClass} value={form.plataforma} onChange={set('plataforma')} />
        </Field>
        <Field
          label={form.tipo === 'compra' ? 'Reais que saíram' : 'Reais que entraram'}
          htmlFor="op-valor"
          hint="o total da operação, com taxas"
        >
          <input
            id="op-valor"
            inputMode="decimal"
            className={inputClass}
            value={form.valor_brl}
            onChange={set('valor_brl')}
            placeholder="100,00"
          />
        </Field>
        <Field
          label="Preço por unidade (opcional)"
          htmlFor="op-preco"
          hint={unidade === 'cotas' ? 'preço da cota na execução' : 'o VET que a plataforma mostrou'}
        >
          <input
            id="op-preco"
            inputMode="decimal"
            className={inputClass}
            value={form.preco_pago}
            onChange={set('preco_pago')}
            placeholder={painel?.preco ? cotacao(painel.preco) : ''}
          />
        </Field>
        <Field label={`Quantidade em ${unidade} (opcional)`} htmlFor="op-qtd" hint="se souber, é o mais exato">
          <input
            id="op-qtd"
            inputMode="decimal"
            className={inputClass}
            value={form.quantidade}
            onChange={set('quantidade')}
            placeholder={unidade === 'cotas' ? '10' : '19,20'}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Notas" htmlFor="op-notas">
            <input id="op-notas" className={inputClass} value={form.notas} onChange={set('notas')} />
          </Field>
        </div>
      </div>

      {efetiva != null && (
        <p className="mt-4 font-mono text-[11.5px] text-muted">
          {cotacao(qtd, 4)} {unidade}
          {origemQtd && ` (${origemQtd})`} · preço efetivo {cotacao(efetiva)}
          {custoImplicito != null &&
            ` · ${pct(custoImplicito, 2)} ${form.tipo === 'compra' ? 'acima' : 'abaixo'} da cotação de hoje`}
        </p>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button variant="solid" onClick={() => void salvar()} disabled={ocupado || !(valor > 0 && qtd > 0)}>
          {ocupado ? 'salvando…' : 'salvar'}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={ocupado}>
          cancelar
        </Button>
      </div>
    </Modal>
  );
}

function Carteira({
  carteira,
  onLancar,
  onMudou,
}: {
  carteira: CarteiraCambio;
  onLancar: () => void;
  onMudou: () => Promise<void>;
}) {
  const { toast } = useMonitor();
  const [removendo, setRemovendo] = useState<OperacaoCambio | null>(null);

  const ganho = carteira.patrimonio - carteira.investido;
  const vsCdi = carteira.patrimonioCdi != null ? carteira.patrimonio - carteira.patrimonioCdi : null;
  const abertas = carteira.posicoes.filter((p) => p.quantidade > 0);

  async function remover() {
    if (!removendo) return;
    try {
      await api.removerOperacao(removendo.id);
      toast('Operação removida.', 'ok');
      setRemovendo(null);
      await onMudou();
    } catch (err) {
      toast(`Não removi: ${(err as Error).message}`, 'bad');
    }
  }

  return (
    <Card
      title="Sua carteira"
      className="mb-5"
      action={
        <Button size="sm" variant="solid" onClick={onLancar}>
          lançar operação
        </Button>
      }
    >
      {carteira.operacoes.length === 0 ? (
        <p className="text-muted">
          Nenhuma operação ainda. Quando investir de verdade, clique em "investi aqui" no ativo (ou em "lançar
          operação") e informe quanto e quando. O painel passa a acompanhar a posição, dizer em que preço
          vender e comparar o resultado líquido — com IOF, spread e IR — com o mesmo dinheiro no CDI.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label="Investido" value={reais(carteira.investido)} />
            <StatTile
              label="Patrimônio hoje"
              value={reais(carteira.patrimonio)}
              tone={ganho >= 0 ? 'mint' : 'rose'}
              note={`${ganho >= 0 ? '+' : ''}${reais(ganho)} líquido`}
            />
            <StatTile label="No CDI seria" value={reais(carteira.patrimonioCdi)} note="mesmas datas, mesmos valores" />
            <StatTile
              label="Contra o CDI"
              value={vsCdi == null ? '—' : `${vsCdi >= 0 ? '+' : ''}${reais(vsCdi)}`}
              tone={vsCdi == null ? 'ink' : vsCdi >= 0 ? 'mint' : 'rose'}
              note={vsCdi == null ? 'CDI indisponível' : vsCdi >= 0 ? 'ganhando do CDI' : 'perdendo para o CDI'}
            />
          </div>

          {abertas.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="eyebrow text-left">
                    <th className="pb-2 font-normal">Posição</th>
                    <th className="pb-2 text-right font-normal">Quantidade</th>
                    <th className="pb-2 text-right font-normal">Custo</th>
                    <th className="pb-2 text-right font-normal">Se vender agora</th>
                    <th className="pb-2 text-right font-normal">Resultado</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {abertas.map((p) => (
                    <tr key={p.ativo} className="border-t border-rule">
                      <td className="py-2 font-mono">{p.ativo}</td>
                      <td className="py-2 text-right">{cotacao(p.quantidade, 4)}</td>
                      <td className="py-2 text-right">{reais(p.custo)}</td>
                      <td className="py-2 text-right">{reais(p.liquidacao)}</td>
                      <td className={`py-2 text-right ${p.resultado >= 0 ? 'text-mint' : 'text-rose'}`}>
                        {reais(p.resultado)} ({pct(p.resultadoPct)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="pb-2 font-normal">Dia</th>
                  <th className="pb-2 font-normal">Operação</th>
                  <th className="pb-2 text-right font-normal">Reais</th>
                  <th className="pb-2 text-right font-normal">Quantidade</th>
                  <th className="pb-2 text-right font-normal">Taxa efetiva</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="tabular">
                {carteira.operacoes.map((op) => (
                  <tr key={op.id} className="border-t border-rule">
                    <td className="py-2 font-mono text-[12px]">{dia(op.dia)}</td>
                    <td className="py-2">
                      <Badge tone={op.tipo === 'compra' ? 'mint' : 'amber'}>{op.tipo}</Badge>{' '}
                      <span className="font-mono">{op.ativo}</span>
                      {op.plataforma && <span className="text-faint"> · {op.plataforma}</span>}
                    </td>
                    <td className="py-2 text-right">{reais(op.valor_brl)}</td>
                    <td className="py-2 text-right">{cotacao(op.quantidade, 4)}</td>
                    <td className="py-2 text-right">{cotacao(op.valor_brl / op.quantidade)}</td>
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
        </>
      )}

      {removendo && (
        <ConfirmDialog
          title="Remover operação"
          confirmLabel="remover"
          onConfirm={remover}
          onCancel={() => setRemovendo(null)}
        >
          Remover a {removendo.tipo} de {reais(removendo.valor_brl)} em {removendo.ativo} do dia{' '}
          {dia(removendo.dia)}? O resultado da carteira é recalculado sem ela.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function Backtest({ ativos }: { ativos: PainelAtivo[] }) {
  const [ativo, setAtivo] = useState<Ativo>(ativos[0]?.ativo ?? 'DOLA11');
  const [resultado, setResultado] = useState<BacktestCambio | null>(null);
  const [erro, setErro] = useState('');
  const [rodando, setRodando] = useState(false);
  const [verOps, setVerOps] = useState(false);

  async function rodar() {
    setRodando(true);
    setErro('');
    try {
      setResultado(await api.backtest(ativo, 100));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setRodando(false);
    }
  }

  const r = resultado;
  const ganhou = r ? r.final > r.cdiFinal : false;

  return (
    <Card title="Backtest — a estratégia no histórico">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ativo" htmlFor="bt-ativo">
          <select
            id="bt-ativo"
            className={inputClass}
            value={ativo}
            onChange={(e) => setAtivo(e.target.value as Ativo)}
          >
            {ativos.map((a) => (
              <option key={a.ativo} value={a.ativo}>
                {a.ativo}
              </option>
            ))}
          </select>
        </Field>
        <Button onClick={() => void rodar()} disabled={rodando}>
          {rodando ? 'calculando…' : 'rodar com R$ 100'}
        </Button>
      </div>

      {erro && <p className="mt-3 text-rose">{erro}</p>}

      {r && (
        <>
          <p className="mt-4 text-[12.5px] text-muted">
            De {dia(r.inicio)} a {dia(r.fim)}, sem olhar o futuro, com os custos do ativo. Parado em reais, o
            dinheiro rende CDI; em moeda, só o câmbio.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              label="Estratégia"
              value={reais(r.final)}
              tone={ganhou ? 'mint' : 'rose'}
              note={`${pct(r.retornoPct)} · ${r.operacoes.length} operações`}
            />
            <StatTile label="CDI" value={reais(r.cdiFinal)} note={pct(r.cdiRetornoPct)} />
            <StatTile
              label="Comprar e segurar"
              value={reais(r.segurarFinal)}
              note={pct((r.segurarFinal / r.capitalInicial - 1) * 100)}
            />
            <StatTile label="Pior queda" value={pct(-r.piorQuedaPct)} tone="amber" note="do pico ao vale" />
          </div>
          <p className={`mt-3 text-[13px] ${ganhou ? 'text-mint' : 'text-amber'}`}>
            {ganhou
              ? 'Neste período a estratégia ganhou do CDI.'
              : 'Neste período o CDI ganhou. Ajuste os parâmetros antes de arriscar dinheiro.'}
          </p>
          {DESCRICAO_ETF[ativo] && <p className="mt-1.5 text-[12px] text-faint">{DESCRICAO_ETF[ativo]}</p>}

          <Button variant="quiet" size="sm" className="mt-2 -ml-2.5" onClick={() => setVerOps((v) => !v)}>
            {verOps ? 'esconder operações' : 'ver operações'}
          </Button>
          {verOps && (
            <ul className="mt-2 space-y-1 font-mono text-[11.5px] text-muted">
              {r.operacoes.map((op, i) => (
                <li key={i}>
                  <span className={op.tipo === 'compra' ? 'text-mint' : 'text-amber'}>{op.tipo.padEnd(6)}</span>{' '}
                  {dia(op.dia)} a {cotacao(op.taxa)} → {reais(op.brl)} · {op.motivo}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

const DESCRICAO_ETF: Partial<Record<Ativo, string>> = {
  DOLA11:
    'Aproximação: o ETF segue o dólar futuro, que embute o cupom cambial — na prática ele rende um pouco ' +
    'além da variação da PTAX usada aqui.',
};

function Carregando() {
  return (
    <>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[260px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-[260px] rounded-md" />
    </>
  );
}

export default function Cambio() {
  const { toast } = useMonitor();
  const [panorama, setPanorama] = useState<PanoramaCambio | null>(null);
  const [carteira, setCarteira] = useState<CarteiraCambio | null>(null);
  const [erro, setErro] = useState('');
  const [selecionado, setSelecionado] = useState<Ativo | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.cambio(), api.carteira()]);
      setPanorama(p);
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

  async function salvarOperacao(op: OperacaoPayload) {
    try {
      await api.registrarOperacao(op);
      toast(op.tipo === 'compra' ? 'Investimento registrado. Agora o painel acompanha a posição.' : 'Venda registrada.', 'ok');
      setLancamento(null);
      await carregar();
    } catch (err) {
      toast(`Não salvei: ${(err as Error).message}`, 'bad');
    }
  }

  async function atualizar() {
    setAtualizando(true);
    try {
      setPanorama(await api.cambioAtualizar());
      setCarteira(await api.carteira());
      toast('Cotações atualizadas.', 'ok');
    } catch (err) {
      toast(`Falha ao atualizar: ${(err as Error).message}`, 'bad');
    } finally {
      setAtualizando(false);
    }
  }

  if (erro && !panorama) {
    return <EmptyState title="Sem contato com o servidor">{erro}</EmptyState>;
  }
  if (!panorama || !carteira) return <Carregando />;

  if (panorama.ativos.length === 0) {
    return (
      <EmptyState title="Câmbio desligado">
        Nenhum ativo configurado. Ajuste CAMBIO_ATIVOS no .env (ex.: DOLA11,USD,EUR) e reinicie o monitor.
      </EmptyState>
    );
  }

  const atual = panorama.ativos.find((a) => a.ativo === selecionado) ?? panorama.ativos[0];
  const p = panorama.parametros;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11.5px] text-muted">
          cotações {desde(panorama.atualizadoEm)} · faixa de {p.janelaLonga} pregões · tendência de{' '}
          {p.janelaCurta} dias · alvo {pct(p.alvoLucroPct)} líquido · stop {pct(-p.stopPct)}
        </p>
        <Button size="sm" onClick={() => void atualizar()} disabled={atualizando}>
          {atualizando ? 'buscando…' : 'atualizar cotações'}
        </Button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {panorama.ativos.map((a) => (
          <CartaoAtivo
            key={a.ativo}
            painel={a}
            parametros={p}
            ativo={a.ativo === atual.ativo}
            onSelect={() => setSelecionado(a.ativo)}
            onLancar={(tipo) => setLancamento({ ativo: a.ativo, tipo })}
          />
        ))}
      </div>

      <Card
        title={`${atual.referencia}/BRL — últimos ${atual.grafico.length} pregões`}
        className="mb-5"
        action={
          atual.ativo !== atual.referencia && (
            <span className="font-mono text-[11px] text-faint">o sinal do {atual.ativo} segue o {atual.referencia}</span>
          )
        }
      >
        <CambioChart
          serie={atual.grafico}
          janelaLonga={p.janelaLonga}
          zonaCompra={p.zonaCompra}
          zonaVenda={p.zonaVenda}
        />
      </Card>

      <Carteira
        carteira={carteira}
        onLancar={() => setLancamento({ ativo: atual.ativo, tipo: 'compra' })}
        onMudou={carregar}
      />

      {lancamento && (
        <FormOperacao
          ativos={panorama.ativos}
          inicial={lancamento}
          onSalvar={salvarOperacao}
          onCancel={() => setLancamento(null)}
        />
      )}

      <Backtest ativos={panorama.ativos} />

      <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
        Os sinais são estatística sobre o passado, não garantia nem recomendação de investimento. Câmbio pode cair por
        meses seguidos. Opere só com dinheiro que você aceita perder e confira os custos reais da sua plataforma.
      </p>
    </>
  );
}
