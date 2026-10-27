import { brl, conexoesCurto, quando } from '../lib/format';
import type { Offer } from '../types';

const TH = 'px-3 py-2 text-left font-normal';

export default function OffersTable({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) {
    return (
      <p className="px-1 py-3 font-mono text-[12px] text-faint">
        A última consulta não trouxe nenhuma oferta dentro dos seus filtros.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[560px] border-collapse font-mono text-[12px]">
      <thead>
        <tr className="border-b border-rule text-[10px] tracking-[.13em] text-faint uppercase">
          <th className={`${TH} text-right`}>Preço</th>
          <th className={TH}>Companhia</th>
          <th className={TH}>Saída</th>
          <th className={TH}>Conexões</th>
          <th className={TH}>Bagagem</th>
          <th className={TH}>Fonte</th>
          <th className={TH} />
        </tr>
      </thead>
      <tbody>
        {offers.map((offer, i) => (
          <tr key={i} className="border-b border-rule/60 last:border-0">
            <td className="tabular px-3 py-2 text-right text-ink">{brl(offer.price)}</td>
            <td className="px-3 py-2 text-muted">{offer.airline ?? '—'}</td>
            <td className="px-3 py-2 text-muted">{quando(offer.depart_at)}</td>
            <td className="px-3 py-2 text-muted">{conexoesCurto(offer.stops_out)}</td>
            <td className="px-3 py-2 text-muted">
              {offer.checked_bags == null ? '—' : offer.checked_bags ? 'inclusa' : 'não'}
            </td>
            <td className="px-3 py-2 text-muted">{offer.source ?? '—'}</td>
            <td className="px-3 py-2 text-right">
              {offer.link && (
                <a
                  href={offer.link}
                  target="_blank"
                  rel="noopener"
                  className="border-b border-transparent text-mint hover:border-mint"
                >
                  abrir ↗
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
