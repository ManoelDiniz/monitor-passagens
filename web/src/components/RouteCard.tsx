import { useState } from 'react';
import { api } from '../lib/api';
import { cidadeDe } from '../lib/airports';
import { brl, conexoes, dia, diaCurto, desde } from '../lib/format';
import { useMonitor } from '../lib/store';
import type { DayPrice, Offer, Route } from '../types';
import OffersTable from './OffersTable';
import PriceTrack from './PriceTrack';
import RouteForm from './RouteForm';
import { Badge, Button, ConfirmDialog, Modal } from './ui';

interface Props {
  route: Route;
  /** Escalona o traçado das curvas para elas não desenharem todas de uma vez. */
  index: number;
}

export default function RouteCard({ route, index }: Props) {
  const { refresh, toast } = useMonitor();
  const [ocupado, setOcupado] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [carregandoOfertas, setCarregandoOfertas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const noAlvo =
    route.price_limit != null && route.current != null && route.current <= route.price_limit;

  async function consultar() {
    setOcupado(true);
    try {
      const resultado = await api.check(route.id);
      if (resultado.status === 'error') {
        toast(`A consulta falhou: ${resultado.error ?? 'motivo não informado'}`, 'bad');
      } else if (resultado.status === 'empty') {
        toast('Nenhuma oferta passou pelos seus filtros desta vez.', 'info');
      } else {
        /* Com janela, o preço sem o dia não diz qual passagem comprar. */
        const quando =
          route.depart_window_days > 0 && resultado.bestDate
            ? ` em ${diaCurto(resultado.bestDate)}`
            : '';
        toast(
          `${route.origin} → ${route.destination} está ${brl(resultado.bestPrice)}${quando}.`,
          'ok',
        );
      }
      await refresh();
      if (offers) await carregarOfertas();
    } catch (err) {
      toast(`Não consegui consultar: ${(err as Error).message}`, 'bad');
    } finally {
      setOcupado(false);
    }
  }

  async function carregarOfertas() {
    setCarregandoOfertas(true);
    try {
      setOffers(await api.offers(route.id));
    } catch (err) {
      toast(`Não consegui carregar as ofertas: ${(err as Error).message}`, 'bad');
    } finally {
      setCarregandoOfertas(false);
    }
  }

  async function alternarOfertas() {
    if (offers) {
      setOffers(null);
      return;
    }
    await carregarOfertas();
  }

  async function alternarPausa() {
    try {
      await api.update(route.id, { active: !route.active });
      toast(route.active ? 'Rota pausada.' : 'Rota retomada.', 'ok');
      await refresh();
    } catch (err) {
      toast(`Não consegui alterar a rota: ${(err as Error).message}`, 'bad');
    }
  }

  async function excluir() {
    try {
      await api.remove(route.id);
      toast('Rota excluída.', 'ok');
      /* Some da lista no refresh — fechar antes evitaria um piscar do diálogo
         por cima de um card que já não existe. */
      setConfirmandoExclusao(false);
      await refresh();
    } catch (err) {
      toast(`Não consegui excluir: ${(err as Error).message}`, 'bad');
      setConfirmandoExclusao(false);
    }
  }

  return (
    <article
      className={`mb-4 overflow-hidden rounded-md border border-rule bg-panel
                  ${route.active ? '' : 'opacity-60'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 sm:gap-6 sm:px-6 sm:pt-5 sm:pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3.5">
            <span className="display-tight text-[30px] leading-[.95] tracking-[.05em] sm:text-[40px]">
              {route.origin}
            </span>
            <Seta />
            <span className="display-tight text-[30px] leading-[.95] tracking-[.05em] sm:text-[40px]">
              {route.destination}
            </span>
            {!route.active && <Badge tone="amber">pausada</Badge>}
          </div>

          <div className="mt-2 truncate text-[13px] text-muted">
            {cidadeDe(route.origin)} <span className="text-faint">→</span>{' '}
            {cidadeDe(route.destination)}
          </div>

          <div className="mt-1.5 font-mono text-xs text-muted">
            {dia(route.depart_date)}
            {route.depart_window_days > 0 && (
              <span className="text-mint"> ± {route.depart_window_days}d</span>
            )}{' '}
            · {route.return_date ? `volta ${dia(route.return_date)}` : 'só ida'}
            {route.adults > 1 && ` · ${route.adults} passageiros`}
          </div>

          {route.notes && <p className="mt-1.5 text-[12.5px] text-faint">{route.notes}</p>}
        </div>

        <div className="min-w-0 text-left md:text-right">
          <div
            className={`display-tight tabular text-[29px] leading-none sm:text-[38px] ${noAlvo ? 'text-mint' : ''}`}
          >
            {brl(route.current)}
            {noAlvo && (
              <span className="ml-2 inline-block align-[3px]">
                <Badge tone="mint">no alvo</Badge>
              </span>
            )}
          </div>
          <Delta route={route} />
        </div>
      </div>

      <PriceTrack route={route} delayMs={index * 90} />

      <div className="tabular flex flex-wrap gap-x-5 gap-y-4 px-4 pt-4 font-mono text-[12.5px] sm:gap-x-[30px] sm:px-6">
        <Stat k="Menor" v={brl(route.lowest)} />
        <Stat k="Média" v={brl(route.average)} />
        <Stat k="Maior" v={brl(route.highest)} />
        <Stat k="Leituras" v={String(route.checks)} />
        <Stat k="Última" v={desde(route.lastCheck?.checked_at)} />
      </div>

      {route.byDate && route.byDate.length > 1 && <DiasDaJanela dias={route.byDate} />}

      {route.bestOffer && <Melhor offer={route.bestOffer} />}

      {route.lastCheck?.status === 'error' && (
        <p className="px-4 pt-3.5 font-mono text-[12.5px] text-rose sm:px-6">
          A última consulta falhou: {route.lastCheck.error}
        </p>
      )}

      <div className="mx-4 mt-4.5 flex flex-wrap items-center gap-2.5 border-t border-rule pt-3.5 pb-4.5 sm:mx-6">
        <Button onClick={() => void consultar()} disabled={!route.active || ocupado}>
          {ocupado ? 'consultando…' : 'consultar agora'}
        </Button>
        <Button onClick={() => void alternarOfertas()} disabled={carregandoOfertas}>
          {carregandoOfertas ? 'carregando…' : offers ? 'ocultar ofertas' : 'ver ofertas'}
        </Button>
        <Button onClick={() => setEditando(true)}>editar</Button>
        <Button onClick={() => void alternarPausa()}>{route.active ? 'pausar' : 'retomar'}</Button>
        <Button variant="danger" onClick={() => setConfirmandoExclusao(true)}>
          excluir
        </Button>
      </div>

      {offers && (
        <div className="mx-4 mb-4.5 overflow-x-auto sm:mx-6">
          <OffersTable offers={offers} />
        </div>
      )}

      {confirmandoExclusao && (
        <ConfirmDialog
          title={`Excluir ${route.origin} → ${route.destination}`}
          confirmLabel="excluir rota"
          busyLabel="excluindo…"
          onConfirm={excluir}
          onCancel={() => setConfirmandoExclusao(false)}
        >
          Isso apaga a rota e <b className="font-semibold text-ink">todo o histórico de preços</b>{' '}
          dela — {route.checks} leitura{route.checks === 1 ? '' : 's'}
          {route.lowest != null && <> e o menor preço já visto, de {brl(route.lowest)}</>}. Não dá
          para desfazer.
        </ConfirmDialog>
      )}

      {editando && (
        <Modal
          title={`Editar ${route.origin} → ${route.destination}`}
          onClose={() => setEditando(false)}
        >
          <RouteForm
            route={route}
            onDone={() => setEditando(false)}
            onCancel={() => setEditando(false)}
          />
        </Modal>
      )}
    </article>
  );
}

function Seta() {
  return (
    <span className="relative h-px w-6 shrink-0 bg-rule-2 sm:w-[34px]">
      <span
        className="absolute -top-[2.5px] right-0 border-y-[3px] border-l-[5px]
                   border-y-transparent border-l-rule-2"
      />
    </span>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="mb-0.5 block text-[10px] tracking-[.13em] text-faint uppercase">{k}</span>
      {v}
    </div>
  );
}

/* "sem mudança" não ajuda a decidir nada. Quando o preço não mexeu desde a
   última leitura, mostra onde ele está em relação ao menor já visto. */
function Delta({ route }: { route: Route }) {
  const base = 'mt-1.5 font-mono text-xs';

  if (route.variationPct == null) {
    return <div className={`${base} text-muted`}>primeira leitura</div>;
  }

  if (Math.abs(route.variationPct) >= 0.5) {
    const caiu = route.variationPct < 0;
    return (
      <div className={`${base} ${caiu ? 'text-mint' : 'text-rose'}`}>
        {caiu ? '▼' : '▲'} {Math.abs(route.variationPct).toFixed(1)}% ·{' '}
        {brl(Math.abs(route.variation ?? 0))} {caiu ? 'mais barato' : 'mais caro'}
      </div>
    );
  }

  if (route.lowest != null && route.current != null) {
    return route.current <= route.lowest ? (
      <div className={`${base} text-mint`}>menor preço já visto</div>
    ) : (
      <div className={`${base} text-muted`}>{brl(route.current - route.lowest)} acima do menor</div>
    );
  }

  return <div className={`${base} text-muted`}>estável</div>;
}

/* A janela só vale se der para comparar os dias lado a lado: o número que
   interessa não é o preço da rota, é qual dia do período está mais barato.
   Dia que não voltou com oferta simplesmente não aparece — a lacuna diz mais
   que um traço, que seria lido como preço zero. */
function DiasDaJanela({ dias }: { dias: DayPrice[] }) {
  const menor = Math.min(...dias.map((d) => d.price));

  return (
    <div className="mt-4 px-4 sm:px-6">
      <span className="mb-2 block text-[10px] tracking-[.13em] text-faint uppercase">
        Preço por dia de ida
      </span>

      <div className="tabular flex gap-1.5 overflow-x-auto pb-1 font-mono text-[12.5px]">
        {dias.map(({ date, price }) => {
          const barato = price === menor;
          return (
            <div
              key={date}
              className={`shrink-0 rounded border px-2.5 py-1.5 text-center
                          ${barato ? 'border-mint/40 bg-mint/10' : 'border-rule'}`}
            >
              <span
                className={`block text-[10px] tracking-[.08em] uppercase
                            ${barato ? 'text-mint' : 'text-faint'}`}
              >
                {diaCurto(date)}
              </span>
              <span className={barato ? 'font-semibold text-mint' : 'text-muted'}>{brl(price)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Melhor({ offer }: { offer: Offer }) {
  return (
    <div className="px-4 pt-4 font-mono text-[12.5px] text-muted sm:px-6">
      <b className="font-semibold text-ink">{offer.airline ?? 'companhia não informada'}</b> ·{' '}
      {conexoes(offer.stops_out)} ·{' '}
      {offer.checked_bags ? 'com bagagem despachada' : 'sem bagagem despachada'}
      {offer.source && (
        <>
          {' '}
          · via <b className="font-semibold text-ink">{offer.source}</b>
        </>
      )}
      {offer.link && (
        <>
          {' · '}
          <a
            href={offer.link}
            target="_blank"
            rel="noopener"
            className="border-b border-transparent text-mint hover:border-mint"
          >
            abrir oferta ↗
          </a>
        </>
      )}
    </div>
  );
}
