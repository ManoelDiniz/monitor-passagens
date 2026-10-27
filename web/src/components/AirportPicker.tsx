import { useEffect, useId, useRef, useState } from 'react';
import { aeroporto, buscarAeroportos, ESTADOS, type Aeroporto } from '../lib/airports';
import { iataClass, inputClass } from './ui';

/**
 * Campo de aeroporto: você digita "fortaleza", "ceará" ou "FOR" e ele resolve
 * para a sigla que a API precisa.
 *
 * O input continua sendo o campo do formulário (mesmo `name`, mesmo FormData) —
 * a busca só ajuda a preencher. Quem já sabe a sigla digita as três letras e
 * ignora a lista; quem não sabe procura pelo nome da cidade ou do estado.
 */

interface Props {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  autoFocus?: boolean;
}

const ehSigla = (texto: string) => /^[A-Za-z]{3}$/.test(texto.trim());

export default function AirportPicker({ id, name, label, defaultValue = '', autoFocus }: Props) {
  const [texto, setTexto] = useState(defaultValue.toUpperCase());
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const caixa = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const escolhido = aeroporto(texto);
  /* Com a sigla já resolvida, buscar pelo nome da cidade mantém o próprio
     aeroporto no topo da lista em vez de esvaziá-la. */
  const sugestoes = buscarAeroportos(escolhido ? escolhido.cidade : texto);

  /* Clique fora fecha a lista. Sem isso ela fica aberta atrás do resto do form. */
  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function escolher(a: Aeroporto) {
    setTexto(a.iata);
    setAberto(false);
    input.current?.focus();
  }

  function aoDigitar(valor: string) {
    setTexto(valor);
    setAtivo(0);
    setAberto(true);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setAberto(false);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        return;
      }
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((i) => (i + passo + sugestoes.length) % Math.max(sugestoes.length, 1));
      return;
    }

    if (e.key === 'Enter' && aberto && sugestoes[ativo]) {
      e.preventDefault(); // não envia o formulário: o Enter aqui é "escolher este"
      escolher(sugestoes[ativo]);
    }
  }

  return (
    <div className="relative min-w-0" ref={caixa}>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[10.5px] tracking-[.12em] text-faint uppercase"
      >
        {label}
      </label>

      <input
        ref={input}
        id={id}
        name={name}
        required
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={aberto && sugestoes[ativo] ? `${listaId}-${ativo}` : undefined}
        pattern="[A-Za-z]{3}"
        title="Escolha um aeroporto da lista ou digite a sigla de três letras."
        placeholder="cidade, estado ou sigla"
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
        onFocus={(e) => {
          e.target.select();
          setAberto(true);
        }}
        onKeyDown={aoTeclar}
        /* Sigla resolvida vira painel de embarque; durante a busca é texto comum. */
        className={ehSigla(texto) ? iataClass : inputClass}
      />

      <p className="mt-1.5 truncate text-[11.5px] leading-snug text-faint">
        {escolhido
          ? `${escolhido.cidade} · ${ESTADOS[escolhido.uf]} — ${escolhido.nome}`
          : ehSigla(texto)
            ? 'sigla fora do catálogo — será enviada assim mesmo'
            : 'procure pelo nome da cidade'}
      </p>

      {aberto && sugestoes.length > 0 && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto
                     rounded-sm border border-rule-2 bg-panel shadow-2xl"
        >
          {sugestoes.map((a, i) => (
            <li
              key={a.iata}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === ativo}
              /* mousedown, não click: o blur do input não pode roubar a escolha. */
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(a);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={`flex cursor-pointer items-baseline gap-3 border-b border-rule/60 px-3 py-2
                          last:border-0 ${i === ativo ? 'bg-rule/40' : ''}`}
            >
              <span className="display-tight w-[3.2ch] shrink-0 text-[15px] tracking-[.06em] text-mint">
                {a.iata}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ink">
                  {a.cidade} · {a.uf}
                </span>
                <span className="block truncate font-mono text-[11px] text-faint">{a.nome}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
