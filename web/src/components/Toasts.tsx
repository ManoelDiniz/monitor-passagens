import { useMonitor, type ToastTone } from '../lib/store';

const TONE: Record<ToastTone, string> = {
  ok: 'border-mint text-mint',
  bad: 'border-rose text-rose',
  info: 'border-rule-2 text-ink',
};

/** Avisos de ação: aparecem no canto, somem sozinhos, nunca bloqueiam a tela. */
export default function Toasts() {
  const { toasts, dismiss } = useMonitor();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-3 z-60 flex w-[min(380px,calc(100vw-1.5rem))]
                 flex-col gap-2 sm:right-5 sm:bottom-5"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`toast-in pointer-events-auto cursor-pointer rounded-md border bg-panel px-3.5 py-3
                      text-left text-[13px] leading-snug shadow-xl ${TONE[t.tone]}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
