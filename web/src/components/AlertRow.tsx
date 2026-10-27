import { brl, desde, motivos, quando } from '../lib/format';
import type { AlertEntry } from '../types';
import { Badge } from './ui';

/** Um alerta na lista: o trecho, por que disparou e por quanto. */
export default function AlertRow({ alert, detalhado = false }: { alert: AlertEntry; detalhado?: boolean }) {
  return (
    <article className="border-b border-rule/60 py-3.5 last:border-0 last:pb-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="display-tight text-[17px] tracking-[.06em] text-ink">
            {alert.origin}
          </span>
          <span className="text-faint">→</span>
          <span className="display-tight text-[17px] tracking-[.06em] text-ink">
            {alert.destination}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {motivos(alert.reason).map((m) => (
              <Badge key={m} tone="mint">
                {m}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span className="display-tight tabular text-[20px] text-mint">{brl(alert.price)}</span>
          <span
            className="font-mono text-[11px] text-faint"
            title={quando(alert.sent_at)}
          >
            {desde(alert.sent_at)}
          </span>
        </div>
      </div>

      {detalhado && (
        <p className="mt-2 font-mono text-[12px] leading-relaxed whitespace-pre-line text-muted">
          {alert.message}
        </p>
      )}
    </article>
  );
}
