export function brl(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** Sem o símbolo, para rótulos apertados dentro do gráfico. */
export function brlPlain(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10-08" -> "08 out 2026", sem depender do formato do locale. */
export function dia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d} ${MESES[Number(m) - 1]} ${y}`;
}

/** Versão curta para tabela: "08 out". */
export function diaCurto(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d} ${MESES[Number(m) - 1]}`;
}

export function quando(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "há 3 h" — quem olha o painel quer saber se o dado é fresco, não a data exata. */
export function desde(iso: string | null | undefined): string {
  if (!iso) return 'nunca';

  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/** Tamanho de arquivo em escala legível: 69,3 MB, 1,2 GB. */
export function tamanho(bytes: number | null | undefined): string {
  if (bytes == null) return '—';

  const unidades = ['B', 'KB', 'MB', 'GB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }

  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: i === 0 ? 0 : 1 })} ${unidades[i]}`;
}

export function conexoes(n: number | null | undefined): string {
  if (n == null) return 'conexões não informadas';
  if (n === 0) return 'voo direto';
  return n === 1 ? '1 conexão' : `${n} conexões`;
}

/** Versão curta de conexões, para célula de tabela. */
export function conexoesCurto(n: number | null | undefined): string {
  if (n == null) return '—';
  return n === 0 ? 'direto' : `${n}×`;
}

/**
 * O agendador monta "hoje as 12:00" sem acento, porque a mesma string vai para
 * o log no console do Windows. Na tela ela sai escrita direito.
 */
export function proxima(texto: string | null | undefined): string {
  if (!texto) return '—';
  return texto.replace(/\bas\b/, 'às').replace(/\bamanha\b/, 'amanhã');
}

const MOTIVOS: Record<string, string> = {
  menor_preco_historico: 'Menor preço já visto',
  abaixo_do_limite: 'Abaixo do alvo',
  queda: 'Queda de preço',
};

/** Um alerta pode ter mais de um motivo, gravados juntos separados por vírgula. */
export function motivos(reason: string): string[] {
  return reason
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => MOTIVOS[r] ?? r.replace(/_/g, ' '));
}
