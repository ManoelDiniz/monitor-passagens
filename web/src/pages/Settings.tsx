import { Badge, Card, EmptyState, Skeleton } from '../components/ui';
import { desde, proxima, tamanho } from '../lib/format';
import { useMonitor } from '../lib/store';
import type { SourceHealth } from '../types';

function Linha({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: React.ReactNode;
  nota?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule/60 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <span className="block text-[13px] text-ink">{rotulo}</span>
        {nota && <span className="text-[12px] text-faint">{nota}</span>}
      </div>
      <div className="font-mono text-[12.5px] text-muted">{valor}</div>
    </div>
  );
}

/**
 * 24 horários enfileirados não dizem nada que "de hora em hora" não diga melhor.
 * Quando o intervalo é regular, descreve o padrão; senão, lista mesmo.
 */
function descreveAgenda(times: string[]): { valor: string; nota: string } {
  if (times.length === 0) return { valor: 'sem agenda', nota: 'nenhuma consulta automática' };
  if (times.length === 1) return { valor: times[0], nota: 'uma vez por dia' };

  const minutos = times.map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  const passo = minutos[1] - minutos[0];
  const regular =
    minutos[0] === 0 &&
    passo % 60 === 0 &&
    minutos.every((m, i) => i === 0 || m - minutos[i - 1] === passo);

  if (regular) {
    const horas = passo / 60;
    return {
      valor: horas === 1 ? 'de hora em hora' : `de ${horas} em ${horas} horas`,
      nota: `${times.length} consultas por dia`,
    };
  }

  return { valor: times.join('  '), nota: `${times.length} consultas por dia` };
}

const TOM_DA_FONTE = {
  ok: 'mint',
  instavel: 'amber',
  fora: 'rose',
} as const;

const ROTULO_DA_FONTE = {
  ok: 'respondendo',
  instavel: 'instável',
  fora: 'suspensa',
} as const;

/** O que essa fonte fez desde que o monitor subiu. */
function descreveFonte(fonte: SourceHealth): string {
  if (fonte.attempts === 0) return 'ainda não consultada nesta execução';

  const acertos = fonte.attempts - fonte.failures;
  const base = `${acertos}/${fonte.attempts} consultas desde que o monitor subiu`;

  if (fonte.state === 'fora') {
    return `${base} · volta ${quandoVolta(fonte.pausedUntil)} · ${fonte.lastError ?? ''}`;
  }
  if (fonte.state === 'instavel') {
    return `${base} · ${fonte.consecutiveFailures} falha(s) seguida(s) · ${fonte.lastError ?? ''}`;
  }
  return `${base} · última resposta ${desde(fonte.lastOkAt)}`;
}

function quandoVolta(iso: string | null): string {
  if (!iso) return 'em breve';
  const minutos = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  return minutos <= 1 ? 'em menos de 1 min' : `em ${minutos} min`;
}

/**
 * "Ativo" só diz que está configurado. O que interessa é se a última mensagem
 * chegou — um canal que passou a recusar precisa aparecer aqui.
 */
function entrega(
  canal: { ok: boolean | null; at: string | null; error: string | null } | undefined,
  quandoNuncaTentou: string,
): string {
  if (!canal || canal.ok === null) return quandoNuncaTentou;
  if (canal.ok) return `último aviso entregue ${desde(canal.at)}`;
  return `FALHOU ${desde(canal.at)}: ${canal.error ?? 'sem detalhe'}`;
}

export default function Settings() {
  const { status, loading, error } = useMonitor();

  if (error && !status) {
    return (
      <EmptyState title="Sem contato com o servidor">
        {error}. Confira se o monitor está rodando e a página se reconecta sozinha.
      </EmptyState>
    );
  }

  if (loading || !status) return <Skeleton className="h-[280px] rounded-md" />;

  const juncao = status.mode === 'merge' ? ' + ' : ' → ';
  const agenda = descreveAgenda(status.scheduleTimes);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Fontes de preço">
        <Linha
          rotulo="Provedores ativos"
          valor={status.providers.length ? status.providers.join(juncao) : 'nenhum'}
          nota={
            status.mode === 'merge'
              ? 'consulta todas e junta as ofertas'
              : 'usa a primeira que responder'
          }
        />
        <Linha rotulo="Modo" valor={status.mode} />

        {/* No modo merge, uma fonte pode cair sem derrubar a consulta: a outra
            responde e o preço sai "normal", só que sobre metade das ofertas. */}
        {status.sources?.map((fonte) => (
          <Linha
            key={fonte.name}
            rotulo={fonte.name}
            valor={<Badge tone={TOM_DA_FONTE[fonte.state]}>{ROTULO_DA_FONTE[fonte.state]}</Badge>}
            nota={descreveFonte(fonte)}
          />
        ))}
      </Card>

      <Card title="Agenda">
        <Linha rotulo="Agenda" valor={agenda.valor} nota={`${agenda.nota} · ${status.timezone}`} />
        <Linha rotulo="Próxima consulta" valor={proxima(status.nextRun)} />
        <Linha
          rotulo="Última rodada completa"
          valor={desde(status.lastRun)}
          nota="rodadas de todas as rotas, manuais ou agendadas"
        />
        <Linha
          rotulo="Estado agora"
          valor={
            status.running ? <Badge tone="amber">consultando</Badge> : <Badge tone="mint">em espera</Badge>
          }
        />
      </Card>

      <Card title="Quando avisar">
        <Linha
          rotulo="Queda que dispara alerta"
          valor={`${status.dropAlertPct}%`}
          nota="comparando com a consulta anterior"
        />
        <Linha
          rotulo="Intervalo mínimo entre alertas"
          valor={`${status.cooldownHours} h`}
          nota="um novo menor preço histórico ignora este intervalo"
        />
      </Card>

      <Card title="Canais de aviso">
        <Linha
          rotulo="Notificação do Windows"
          valor={<Badge tone="mint">ativa</Badge>}
          nota={entrega(status.channels?.desktop, 'sempre ligada neste computador')}
        />
        <Linha
          rotulo="Telegram"
          valor={
            status.telegram ? <Badge tone="mint">ativo</Badge> : <Badge tone="muted">desligado</Badge>
          }
          nota={
            status.telegram
              ? entrega(status.channels?.telegram, 'nenhum alerta enviado ainda')
              : 'rode npm run telegram para configurar'
          }
        />
      </Card>

      <Card title="Cópia de segurança">
        <Linha
          rotulo="Backup automático"
          valor={
            status.backup?.enabled ? (
              <Badge tone="mint">ativo</Badge>
            ) : (
              <Badge tone="amber">desligado</Badge>
            )
          }
          nota={
            status.backup?.enabled
              ? `todo dia às ${status.backup.time}, guardando as ${status.backup.keep} últimas`
              : 'BACKUP_ENABLED=false no .env'
          }
        />
        <Linha
          rotulo="Última cópia"
          valor={desde(status.backup?.at)}
          nota={
            status.backup?.at
              ? `${tamanho(status.backup.bytes)} em data/backups`
              : 'nenhuma cópia gerada ainda'
          }
        />
        <Linha
          rotulo="Gerar agora"
          valor={<code className="text-muted">npm run backup</code>}
          nota="o histórico de preços não se refaz — ele só existe no banco"
        />
      </Card>

      <p className="text-[12.5px] text-faint lg:col-span-2">
        Estes valores vêm do arquivo <code className="font-mono text-muted">.env</code> na pasta do
        projeto. Depois de editá-lo, reinicie o monitor para as mudanças valerem.
      </p>
    </div>
  );
}
