import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'outline' | 'solid' | 'quiet' | 'danger' | 'destructive';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  outline: 'border-rule-2 text-ink hover:enabled:border-mint hover:enabled:text-mint',
  solid:
    'border-mint bg-mint font-semibold text-[#08211A] hover:enabled:bg-mint-lit hover:enabled:border-mint-lit',
  quiet: 'border-transparent text-muted hover:enabled:text-ink',
  danger: 'border-transparent text-muted hover:enabled:text-rose',
  /* O botão que confirma a perda. Preenchido de rosa porque, dentro do diálogo,
     um botão discreto some ao lado do "cancelar" e vira clique no automático. */
  destructive:
    'border-rose bg-rose font-semibold text-[#2A0906] hover:enabled:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-[10.5px]',
  md: 'px-4 py-2 text-[11.5px]',
};

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...rest}
      className={`cursor-pointer rounded-sm border font-mono tracking-[.09em] uppercase
                  transition-colors disabled:cursor-default disabled:opacity-40
                  ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-mono text-[10.5px] tracking-[.12em] text-faint uppercase"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-sm border border-rule-2 bg-ground px-3 py-2.5 text-ink ' +
  'transition-colors hover:border-rule-2 focus:border-mint';

/** Código IATA: tratado como painel de embarque, não como campo de texto. */
export const iataClass =
  'w-full rounded-sm border border-rule-2 bg-ground px-1 py-1.5 text-center ' +
  'display-tight text-[21px] tracking-[.1em] uppercase text-ink focus:border-mint';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

/** Bloco padrão de conteúdo. Título e ação são opcionais. */
export function Card({
  title,
  action,
  children,
  className = '',
  bodyClass = 'px-4 py-4 sm:px-5 sm:py-5',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-md border border-rule bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3 sm:px-5">
          <Eyebrow>{title}</Eyebrow>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

type Tone = 'ink' | 'mint' | 'rose' | 'amber' | 'muted';

const TONES: Record<Tone, string> = {
  ink: 'text-ink',
  mint: 'text-mint',
  rose: 'text-rose',
  amber: 'text-amber',
  muted: 'text-muted',
};

const BADGE_TONES: Record<Tone, string> = {
  ink: 'border-rule-2 text-muted',
  mint: 'border-mint text-mint',
  rose: 'border-rose text-rose',
  amber: 'border-amber text-amber',
  muted: 'border-rule-2 text-faint',
};

export function Badge({ tone = 'ink', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[10px]
                  tracking-[.11em] whitespace-nowrap uppercase ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Indicador do topo: um número grande com o rótulo do que ele mede. */
export function StatTile({
  label,
  value,
  note,
  tone = 'ink',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-md border border-rule bg-panel px-4 py-3.5">
      <span className="eyebrow block">{label}</span>
      <div className={`display-tight tabular mt-1.5 text-[27px] leading-none ${TONES[tone]}`}>
        {value}
      </div>
      {note && <p className="mt-1.5 font-mono text-[11px] text-muted">{note}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-sm ${className}`} />;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-rule px-5 py-10 text-center sm:py-14">
      <strong className="display-tight mb-2 block text-xl tracking-[.04em] text-ink">{title}</strong>
      <p className="mx-auto max-w-[46ch] text-muted">{children}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-[720px]',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Um formulário pede espaço; uma pergunta de sim ou não fica melhor estreita.
   * Passe a classe escrita por extenso: o Tailwind lê o código-fonte para saber
   * o que gerar, e uma string montada em tempo de execução não sai no CSS.
   */
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                 bg-[#050A0B]/75 px-3 py-8 sm:px-6 sm:py-14"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`page-in w-full ${width} rounded-md border border-rule-2 bg-panel shadow-2xl`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3 sm:px-5">
          <Eyebrow>{title}</Eyebrow>
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Fechar">
            fechar
          </Button>
        </header>
        <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Confirmação de ação sem volta, no lugar do `confirm()` do navegador.
 *
 * O nativo destoa: ignora o tema da página, escreve o domínio do site no título
 * e trava a aba inteira — numa tela escura ele parece erro do sistema, não uma
 * pergunta do painel. Este também segura o clique enquanto a ação corre, coisa
 * que o `confirm()` não faz: ele devolve o booleano e sai de cena, deixando o
 * botão livre para ser clicado de novo antes de a primeira chamada terminar.
 */
export function ConfirmDialog({
  title,
  confirmLabel,
  busyLabel = 'aguarde…',
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  confirmLabel: string;
  busyLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    setOcupado(true);
    try {
      await onConfirm();
    } finally {
      setOcupado(false);
    }
  }

  return (
    /* Fechar no meio da ação deixaria a tela mentindo sobre o que está
       acontecendo; enquanto ocupado, Esc e o clique no fundo não respondem. */
    <Modal title={title} onClose={ocupado ? () => {} : onCancel} width="max-w-[440px]">
      <div className="text-[13.5px] leading-relaxed text-muted">{children}</div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Button variant="destructive" onClick={() => void confirmar()} disabled={ocupado}>
          {ocupado ? busyLabel : confirmLabel}
        </Button>
        {/* O foco começa no cancelar: um Enter distraído não deve destruir nada. */}
        <Button variant="quiet" onClick={onCancel} disabled={ocupado} autoFocus>
          cancelar
        </Button>
      </div>
    </Modal>
  );
}
