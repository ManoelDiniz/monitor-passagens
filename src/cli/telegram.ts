/**
 * Configura e testa o aviso por Telegram:  npm run telegram
 *
 * Descobre o chat id sozinho (basta ter mandado qualquer mensagem ao bot),
 * grava no .env e dispara uma mensagem de teste. Existe porque um canal de
 * aviso que ninguem testou e so uma suposicao: o alerta que importa e o que
 * chega quando o preco cai as 3 da manha.
 *
 *   npm run telegram                # descobre, grava e testa
 *   npm run telegram -- --chat 123  # escolhe o chat quando ha mais de um
 *   npm run telegram -- --so-testar # nao mexe no .env
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const API = 'https://api.telegram.org';

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Resposta<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface Chat {
  id: number | string;
  type: string;
  first_name?: string;
  title?: string;
}

interface Update {
  message?: { chat: Chat };
  channel_post?: { chat: Chat };
}

async function chamar<T>(token: string, metodo: string, corpo?: unknown): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${metodo}`, {
    method: corpo ? 'POST' : 'GET',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const dados = (await res.json()) as Resposta<T>;
  if (!dados.ok) {
    throw new Error(`${metodo}: ${dados.description ?? `HTTP ${res.status}`}`);
  }
  return dados.result as T;
}

/** Grava a chave preservando o resto do arquivo (e os comentarios). */
function gravarNoEnv(chave: string, valor: string): void {
  const arquivo = path.join(config.paths.root, '.env');
  const atual = fs.readFileSync(arquivo, 'utf8');
  const linha = `${chave}=${valor}`;
  const padrao = new RegExp(`^${chave}=.*$`, 'm');

  fs.writeFileSync(
    arquivo,
    padrao.test(atual) ? atual.replace(padrao, linha) : `${atual.trimEnd()}\n${linha}\n`,
  );
}

async function main() {
  const token = config.telegram.botToken.trim();

  if (!token) {
    console.error(
      'TELEGRAM_BOT_TOKEN vazio no .env.\n' +
        'Crie um bot com o @BotFather e cole o token — ele tem o formato\n' +
        '123456789:AA... com 35 caracteres depois dos dois pontos.',
    );
    process.exit(1);
  }

  const bot = await chamar<{ username: string; first_name: string }>(token, 'getMe');
  console.log(`Bot: @${bot.username} (${bot.first_name})`);

  let chatId = argumento('chat') ?? config.telegram.chatId.trim();

  if (!chatId) {
    const updates = await chamar<Update[]>(token, 'getUpdates');
    const chats = [
      ...new Map(
        updates
          .map((u) => u.message ?? u.channel_post)
          .filter((m): m is { chat: Chat } => m !== undefined)
          .map((m) => [String(m.chat.id), m.chat] as const),
      ).values(),
    ];

    if (chats.length === 0) {
      console.error(
        `\nNenhuma conversa encontrada. Abra https://t.me/${bot.username}, toque em Iniciar\n` +
          'e rode este comando de novo — o Telegram so revela o chat id depois que\n' +
          'voce fala com o bot (é o que impede um estranho de mandar mensagem pra voce).',
      );
      process.exit(1);
    }

    if (chats.length > 1 && !argumento('chat')) {
      console.error('\nMais de uma conversa. Escolha com --chat <id>:');
      for (const c of chats) {
        console.error(`  ${c.id}  ${c.type}  ${c.first_name ?? c.title ?? ''}`);
      }
      process.exit(1);
    }

    chatId = String(chats[0].id);
    console.log(`Chat: ${chatId} (${chats[0].first_name ?? chats[0].title ?? chats[0].type})`);
  }

  if (!process.argv.includes('--so-testar')) {
    gravarNoEnv('TELEGRAM_CHAT_ID', chatId);
    console.log('TELEGRAM_CHAT_ID gravado no .env');
  }

  await chamar<unknown>(token, 'sendMessage', {
    chat_id: chatId,
    text:
      '<b>Monitor de Passagens</b>\nCanal de aviso configurado.\n\n' +
      'A partir de agora os alertas de queda de preco chegam por aqui.',
    parse_mode: 'HTML',
  });

  console.log('\nMensagem de teste enviada. Confira no Telegram.');
  console.log('Reinicie o monitor para ele passar a usar este canal.');
}

main().catch((err: unknown) => {
  console.error(`\nFalhou: ${(err as Error).message}`);
  process.exit(1);
});
