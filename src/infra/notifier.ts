import notifier from 'node-notifier';
import { config } from '../config';
import { log } from '../logger';

export interface Alert {
  routeId: number;
  title: string;
  message: string;
  reason: string;
  price: number;
  link: string | null;
}

/**
 * Como foi a ultima entrega de cada canal.
 *
 * Um canal de aviso que falha calado e pior que canal nenhum: voce acha que
 * esta coberto. O Telegram pode recusar por token trocado, chat apagado ou bot
 * bloqueado, e ate hoje isso so aparecia numa linha de log que ninguem le.
 */
export interface EstadoCanal {
  /** null = nunca tentou (ou nao esta configurado). */
  ok: boolean | null;
  at: string | null;
  error: string | null;
}

const estado: Record<'desktop' | 'telegram', EstadoCanal> = {
  desktop: { ok: null, at: null, error: null },
  telegram: { ok: null, at: null, error: null },
};

function registrar(canal: 'desktop' | 'telegram', ok: boolean, error?: string): void {
  estado[canal] = { ok, at: new Date().toISOString(), error: ok ? null : (error ?? 'sem detalhe') };
}

export function estadoDosCanais(): Record<'desktop' | 'telegram', EstadoCanal> {
  return { desktop: { ...estado.desktop }, telegram: { ...estado.telegram } };
}

/** Canal do Windows: aparece na hora, some sozinho, nao bloqueia o processo. */
function desktop(alert: Pick<Alert, 'title' | 'message'>): void {
  notifier.notify(
    {
      title: alert.title,
      message: alert.message,
      sound: true,
      wait: false,
      appID: 'Monitor de Passagens',
    },
    (err) => {
      if (err) log.warn('falha na notificacao do Windows', err);
      registrar('desktop', !err, err ? String(err.message ?? err) : undefined);
    },
  );
}

export const escaparHtml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Canal opcional: so entra em acao com bot e chat configurados no .env.
 *
 * Usa HTML, nao Markdown. No Markdown do Telegram o link termina no primeiro
 * parentese fechado, e deep link de provedor vem cheio deles — o link chegava
 * cortado ("...token=ab_c" no lugar da URL inteira) e o botao "Ver oferta"
 * levava a uma pagina quebrada. Em HTML a URL fica dentro de um atributo, onde
 * so importa escapar & e aspas.
 */
async function telegram(alert: Pick<Alert, 'title' | 'message' | 'link'>): Promise<void> {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return;

  const corpo = `<b>${escaparHtml(alert.title)}</b>\n${escaparHtml(alert.message)}`;
  const text = alert.link
    ? `${corpo}\n\n<a href="${escaparHtml(alert.link)}">Ver oferta</a>`
    : corpo;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    if (res.ok) {
      registrar('telegram', true);
      return;
    }

    /* A resposta de erro do Telegram diz o motivo ("chat not found", "bot was
       blocked by the user"); guardar so o status HTTP joga fora o diagnostico. */
    const detalhe = await res
      .json()
      .then((d) => (d as { description?: string }).description)
      .catch(() => null);
    const motivo = `HTTP ${res.status}${detalhe ? ` — ${detalhe}` : ''}`;

    log.warn('Telegram recusou a mensagem', motivo);
    registrar('telegram', false, motivo);
  } catch (err) {
    log.warn('falha ao enviar para o Telegram', err);
    registrar('telegram', false, (err as Error).message);
  }
}

/** Dispara o alerta em todos os canais disponiveis. Nenhum canal derruba o outro. */
export async function deliver(alert: Pick<Alert, 'title' | 'message' | 'link'>): Promise<void> {
  desktop(alert);
  await telegram(alert);
}
