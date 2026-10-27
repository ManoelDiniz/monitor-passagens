import { useId, useState, type FormEvent } from 'react';
import { api, type RoutePatch, type RoutePayload } from '../lib/api';
import { useMonitor } from '../lib/store';
import type { Route } from '../types';
import AirportPicker from './AirportPicker';
import { Button, Field, inputClass } from './ui';

const hoje = new Date().toISOString().slice(0, 10);

/** Lê o formulário já no formato que a API espera: número é número, vazio é null. */
function readForm(form: HTMLFormElement): RoutePayload {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? '').trim();

  return {
    origin: text('origin').toUpperCase(),
    destination: text('destination').toUpperCase(),
    depart_date: text('depart_date'),
    return_date: text('return_date') || null,
    depart_window_days: Number(text('depart_window_days')) || 0,
    adults: Number(text('adults')) || 1,
    price_limit: text('price_limit') === '' ? null : Number(text('price_limit')),
    max_stops: Number(text('max_stops')),
    require_checked_bag: text('require_checked_bag') === '1' ? 1 : 0,
    notes: text('notes') || null,
  };
}

/** Só o que o usuário realmente mexeu — assim editar o alvo não redispara a busca. */
function diff(payload: RoutePayload, route: Route): RoutePatch {
  const patch: RoutePatch = {};

  for (const key of Object.keys(payload) as Array<keyof RoutePayload>) {
    if (payload[key] !== route[key]) {
      Object.assign(patch, { [key]: payload[key] });
    }
  }

  return patch;
}

interface Props {
  /** Ausente = cadastro novo. Presente = edição daquela rota. */
  route?: Route;
  onDone: () => void;
  onCancel?: () => void;
}

export default function RouteForm({ route, onDone, onCancel }: Props) {
  const { refresh, toast } = useMonitor();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  /* O formulário de criar e o de editar coexistem na tela: id fixo colidiria. */
  const campoId = useId();
  /* form.reset() não limpa campo controlado — remontar o seletor é o que zera. */
  const [geracao, setGeracao] = useState(0);

  const editando = route !== undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErro('');
    setEnviando(true);

    try {
      const payload = readForm(form);

      if (route) {
        const patch = diff(payload, route);
        if (Object.keys(patch).length === 0) {
          onDone();
          return;
        }
        await api.update(route.id, patch);
        toast('Rota atualizada.', 'ok');
      } else {
        await api.create(payload);
        form.reset();
        setGeracao((n) => n + 1);
        toast('Rota criada. A primeira consulta já está rodando.', 'ok');
      }

      await refresh();
      onDone();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AirportPicker
          key={`origin-${geracao}`}
          id={`${campoId}-origin`}
          name="origin"
          label="Origem"
          defaultValue={route?.origin}
        />

        <AirportPicker
          key={`destination-${geracao}`}
          id={`${campoId}-destination`}
          name="destination"
          label="Destino"
          defaultValue={route?.destination}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
        <Field label="Ida" htmlFor="depart_date">
          <input
            id="depart_date"
            name="depart_date"
            type="date"
            required
            min={editando ? undefined : hoje}
            defaultValue={route?.depart_date}
            className={inputClass}
          />
        </Field>

        <Field label="Volta" htmlFor="return_date">
          <input
            id="return_date"
            name="return_date"
            type="date"
            min={editando ? undefined : hoje}
            defaultValue={route?.return_date ?? ''}
            className={inputClass}
          />
        </Field>

        <Field label="Flexibilidade" htmlFor="depart_window_days">
          <select
            id="depart_window_days"
            name="depart_window_days"
            defaultValue={String(route?.depart_window_days ?? 0)}
            className={inputClass}
          >
            <option value="0">Data exata</option>
            <option value="1">± 1 dia · 3 dias</option>
            <option value="2">± 2 dias · 5 dias</option>
            <option value="3">± 3 dias · 7 dias</option>
            <option value="5">± 5 dias · 11 dias</option>
            <option value="7">± 7 dias · 15 dias</option>
          </select>
        </Field>

        <Field label="Avisar abaixo de" htmlFor="price_limit">
          <input
            id="price_limit"
            name="price_limit"
            type="number"
            min={0}
            step={10}
            placeholder="R$ 850"
            defaultValue={route?.price_limit ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      <p className="mt-2.5 text-[12px] text-faint">
        Com flexibilidade, cada dia do período é consultado e o painel mostra o mais barato. A volta
        acompanha a ida mantendo a mesma duração de viagem. Cada dia a mais é uma consulta a mais em
        cada fonte, então prefira o menor período que resolva.
      </p>

      <details className="group mt-4" open={editando}>
        <summary
          className="w-fit cursor-pointer list-none font-mono text-[11px] tracking-[.1em] text-muted
                     uppercase [&::-webkit-details-marker]:hidden"
        >
          <span className="text-faint">+ </span>Passageiros, conexões e bagagem
        </summary>

        <div className="mt-3.5 grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
          <Field label="Passageiros" htmlFor="adults">
            <input
              id="adults"
              name="adults"
              type="number"
              min={1}
              max={9}
              defaultValue={route?.adults ?? 1}
              className={inputClass}
            />
          </Field>

          <Field label="Conexões" htmlFor="max_stops">
            <select
              id="max_stops"
              name="max_stops"
              defaultValue={String(route?.max_stops ?? 2)}
              className={inputClass}
            >
              <option value="0">Somente voo direto</option>
              <option value="1">Até 1 conexão</option>
              <option value="2">Até 2 conexões</option>
              <option value="3">Sem limite</option>
            </select>
          </Field>

          <Field label="Bagagem despachada" htmlFor="require_checked_bag">
            <select
              id="require_checked_bag"
              name="require_checked_bag"
              defaultValue={route?.require_checked_bag ? '1' : ''}
              className={inputClass}
            >
              <option value="">Não exigir</option>
              <option value="1">Exigir</option>
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Anotação" htmlFor="notes" hint="Só para você lembrar por que criou esta rota.">
            <input
              id="notes"
              name="notes"
              maxLength={140}
              placeholder="aniversário da minha mãe"
              defaultValue={route?.notes ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Button variant="solid" type="submit" disabled={enviando}>
          {enviando ? 'salvando…' : editando ? 'salvar alterações' : 'monitorar rota'}
        </Button>

        {onCancel && (
          <Button type="button" variant="quiet" onClick={onCancel} disabled={enviando}>
            cancelar
          </Button>
        )}

        {erro && <span className="font-mono text-xs text-rose">{erro}</span>}
      </div>

      {editando && (
        <p className="mt-3 text-[12px] text-faint">
          Mudar origem, destino, datas, passageiros ou filtros dispara uma nova consulta na hora. O
          histórico de preços da rota continua o mesmo.
        </p>
      )}
    </form>
  );
}
