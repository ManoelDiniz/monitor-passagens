import type { Status } from '../types';

export default function Masthead({ status }: { status: Status | null }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2.5 border-b border-rule pt-6 pb-3.5 sm:pt-8">
      <h1 className="display-tight m-0 min-w-0 text-[18px] leading-none tracking-[.11em] uppercase sm:text-[27px] sm:tracking-[.16em]">
        Monitor de passagens
      </h1>

      <div className="min-w-0 font-mono text-[11px] leading-[1.75] tracking-[.02em] text-muted sm:text-left sm:text-[11.5px] md:text-right">
        {status ? <Rail status={status} /> : 'iniciando…'}
      </div>
    </header>
  );
}

function Rail({ status }: { status: Status }) {
  const juncao = status.mode === 'merge' ? ' + ' : ' → ';
  const fontes = status.providers.length
    ? status.providers.join(juncao)
    : 'nenhuma fonte configurada';

  return (
    <>
      <b className="font-semibold text-ink">{fontes}</b>
      <Sep />
      {status.scheduleTimes.join('  ')}
      <Sep />
      próxima <b className="font-semibold text-ink">{status.nextRun ?? '—'}</b>
    </>
  );
}

const Sep = () => <span className="px-[7px] text-faint">/</span>;
