# Monitor de Passagens

> Monitor local e automático de preços de passagens aéreas, com módulo de câmbio (DOLA11, USD, EUR) e radar de cripto — tudo num painel web e com alertas no Telegram.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-4-000000?logo=fastify&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-1-FE0803?logo=typeorm&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Telegram](https://img.shields.io/badge/alertas-Telegram-26A5E4?logo=telegram&logoColor=white)

## O que faz

**Passagens aéreas**

- Você cadastra rotas no navegador (origem/destino por cidade, estado ou sigla IATA, data fixa ou
  período de ± até 7 dias, ida ou ida-e-volta, filtros de escalas e bagagem, preço-limite).
- Consulta os preços sozinho, de hora em hora ou em horários fixos (`node-cron`), e recupera as
  consultas perdidas enquanto o PC estava desligado.
- Fontes: **Kiwi**, **MaxMilhas** e **Google Flights** (sem chave) e, opcionalmente,
  **Travelpayouts** e **Amadeus** (com chave). Modo `merge` (melhor preço entre todas) ou
  `failover`, com retentativas, `Retry-After` e suspensão temporária de fontes que falham.
- Guarda o histórico de preços e avisa quando o preço fica abaixo do seu limite, cai X% desde a
  última consulta ou bate o menor valor já registrado — com cooldown contra spam.

**Câmbio**

- Acompanha **DOLA11** (ETF de dólar na B3), **USD** e **EUR** (conta global).
- Histórico da **PTAX** e do **CDI** (SGS série 12) pelas APIs abertas do Banco Central, cotação
  ao vivo pela **AwesomeAPI** e cotação do DOLA11 pelo **Yahoo Finance**.
- Calcula indicadores e um sinal de compra/venda/stop considerando IOF, spread e IR de cada ativo,
  registra suas operações numa carteira e faz **backtest da estratégia contra o CDI**.

**Cripto**

- Radar de quedas das moedas configuradas, com candles diários em BRL do **Mercado Bitcoin**.
- Estratégia em grade (compra em partes na queda, venda de cada parte no alvo, stop opcional),
  carteira de lotes e estudo histórico de quedas/recuperações com **backtest contra o CDI**.

**Alertas e operação**

- Notificação do Windows e **Telegram** (`npm run telegram` descobre o chat id e envia um teste).
- Backup diário do banco com `mysqldump`, rotação de cópias e poda de ofertas antigas.
- Pode iniciar junto com o Windows (Agendador de Tarefas ou pasta Startup).

## Arquitetura

Um único processo Node serve a API e o painel. O backend é em camadas — **controller** traduz
HTTP, **service** decide, **repository** fala com o banco — e as regras de negócio puras (rotas,
janelas de datas, câmbio, cripto) ficam em `src/domain/`, cobertas por testes.

```
src/
  http/          Fastify: rotas da API e controllers
  services/      monitor, alertas, agendador, câmbio, cripto, status
  domain/        regras puras e testadas (route-input, date-window, cambio, cripto)
  repositories/  acesso a dados via TypeORM
  db/            DataSource e entities (MySQL 8)
  providers/     adaptadores: kiwi, maxmilhas, google, travelpayouts, amadeus,
                 bcb, awesome, yahoo, mercadobitcoin
  infra/         notificações (Windows + Telegram) e backup
  cli/           comandos de terminal (check-now, comparar, backup, backtest…)
web/             painel React + Vite + Tailwind; o build vai para public/
tests/           node:test via tsx
scripts/         instalação na inicialização do Windows
```

## Como rodar

Pré-requisitos: **Node.js 20.19+** (ou 22.12+) e um **MySQL 8** acessível.

```bash
# 1. Dependências e configuração
npm install
cp .env.example .env        # no Windows: copy .env.example .env
#    edite DB_USER / DB_PASSWORD e, se quiser, TELEGRAM_BOT_TOKEN

# 2. Banco vazio (o TypeORM cria as tabelas com DB_SYNCHRONIZE=true)
mysql -u root -p -e "CREATE DATABASE monitor CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

# 3. Build e execução
npm run build
npm start                   # painel em http://localhost:3777
```

Desenvolvimento (dois terminais):

```bash
npm run dev       # backend em :3777 com reload
npm run web:dev   # painel em :5173 com hot reload (/api vai para :3777)
```

Outros comandos úteis:

| Comando | O que faz |
|---|---|
| `npm test` / `npm run typecheck` / `npm run lint` | testes, tipos e lint |
| `npm run check-now` | consulta todas as rotas uma vez e sai |
| `npm run comparar FOR SSA 2026-12-10` | compara as fontes num trecho, sem cadastrar rota |
| `npm run telegram` | descobre o chat id do bot e manda uma mensagem de teste |
| `npm run backtest-cambio -- USD 500` | backtest da estratégia de câmbio contra o CDI |
| `npm run estudo-cripto -- BTC ETH` | estudo de quedas e da grade de cripto contra o CDI |
| `npm run backup` / `npm run compactar` | cópia do banco agora / poda de ofertas antigas |
| `npm run install-startup` | inicia o monitor junto com o Windows |

Todas as variáveis estão documentadas em [`.env.example`](.env.example). Nenhuma chave é
obrigatória: sem configurar nada, o monitor usa Kiwi, MaxMilhas e Google Flights.

## Tecnologias

- **Backend:** Node.js, TypeScript, Fastify, TypeORM, MySQL 8 (`mysql2`), node-cron, dotenv,
  node-notifier
- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Dados externos:** Kiwi, MaxMilhas, Google Flights, Travelpayouts, Amadeus, Banco Central
  (PTAX/SGS), AwesomeAPI, Yahoo Finance, Mercado Bitcoin
- **Alertas:** Telegram Bot API e notificações do Windows
- **Qualidade:** node:test + tsx, ESLint (typescript-eslint, react-hooks)

---

# Detalhes de funcionamento

## Fontes de preço

**Vindo da versão em SQLite?** O histórico de preços é o ativo do projeto, então
existe um comando para trazê-lo:

```bash
npm run migrar-mysql            # aborta se o MySQL já tiver rotas
npm run migrar-mysql -- --force # reexecuta, ignorando o que já foi copiado
```

Ele copia `routes`, `checks`, `offers`, `notifications` e `runs` preservando os
ids (as tabelas se referenciam por id), confere as contagens dos dois lados e
**não apaga o arquivo `data/passagens.db`** — ele fica como cópia de segurança.

**Não precisa de cadastro nem chave de API.** O padrão consulta Kiwi, MaxMilhas e
Google Flights juntas e fica com o melhor preço entre elas.

| Provedor | Chave? | Característica |
|---|---|---|
| **Kiwi** (padrão) | não | API GraphQL pública do site da Kiwi. Rápida (~1-3s), boa cobertura internacional. |
| **MaxMilhas** (padrão) | não | API interna (BFF) do site. Consulta GOL, LATAM e Azul direto, ~5-10s. Costuma achar tarifa doméstica brasileira mais barata que a Kiwi. |
| **Google Flights** (padrão) | não | Endpoint RPC interno da página do Google Voos. Traz tarifas publicadas por LATAM, GOL e Azul; o formato pode mudar sem aviso. |
| **Travelpayouts** | sim | [travelpayouts.com](https://www.travelpayouts.com) → API tokens. Preços de cache de buscas recentes. |
| **Amadeus** | sim | [developers.amadeus.com](https://developers.amadeus.com) → Self-Service. Preços de GDS, quota mensal limitada. |

### Fontes que não dão

Testadas e descartadas, para não perder tempo tentando de novo:

- **Skyscanner** — PerimeterX, 403 com captcha em todos os endpoints
- **Decolar** — bloqueio com captcha em todo o domínio
- **Google Flights (página HTML)** — os voos só chegam via JavaScript; por isso o adaptador usa o endpoint RPC interno, não a página
- **Skiplagged** — Cloudflare

### Modo de consulta

`PROVIDER_MODE` decide o que fazer com múltiplas fontes:

- **`merge`** (padrão) — consulta todas em paralelo e junta as ofertas, guardando de qual fonte veio cada uma. Nenhuma fonte ganha em todas as rotas, então é o modo que realmente acha o menor preço.
- **`failover`** — usa a primeira de `PROVIDER_ORDER` que responder e ignora o resto. Mais rápido, menos completo.

### Quando uma fonte cai

No modo `merge` a queda de uma fonte é silenciosa por natureza: a outra responde,
a consulta termina "ok" e o painel mostra um preço normal — calculado sobre
metade das ofertas. Foi exatamente o que aconteceu nas 11 primeiras consultas
deste monitor, feitas só com a Kiwi sem nada registrar.

Por isso cada fonte tem estado próprio, visível em **Ajustes**:

| Estado | Quer dizer |
|---|---|
| **respondendo** | última consulta deu certo |
| **instável** | falhou, mas ainda não bateu o limite |
| **suspensa** | falhou `PROVIDER_BREAKER_FAILURES` vezes seguidas; sai da rodada por `PROVIDER_BREAKER_MINUTES` |

Suspender não é castigo por castigo: bater de hora em hora numa API que já
recusou três vezes é o caminho curto para trocar um erro temporário por um
bloqueio permanente. Quando o prazo vence, a próxima rodada serve de sondagem —
e se **todas** estiverem suspensas, o monitor consulta assim mesmo, porque ficar
sem consultar ninguém é pior que tentar.

Dentro de cada requisição há até `PROVIDER_RETRIES` tentativas, com espera
crescente (2s, 6s, 18s) e um sorteio de até 1s para as fontes não retentarem no
mesmo instante. `429` é o único 4xx que se retenta — os outros são erro de quem
chama, e repetir só gasta a paciência do provedor. Quando a resposta traz
`Retry-After`, ele manda, limitado a 60s para não travar as outras rotas.

O estado zera quando o monitor reinicia: é o retrato do "está funcionando
agora?", não um histórico. O histórico longo está na tabela `checks` e no log.

Para comparar as fontes num trecho específico sem cadastrar rota:

```bash
npm run comparar FOR SSA 2026-10-08              # só ida
npm run comparar FOR GRU 2026-12-15 2026-12-22   # ida e volta
```

### Se a Kiwi mudar a API

O sintoma é a rota parar de atualizar e o painel mostrar
*"GraphQL recusou a consulta (a API da Kiwi pode ter mudado)"*. O acoplamento
está inteiro em um arquivo só. Para ver o schema atual:

```bash
curl -X POST "https://api.skypicker.com/umbrella/v2/graphql?featureName=probe" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __type(name: \"ItineraryReturn\") { fields { name } } }"}'
```

A introspecção está aberta, então dá para redescobrir os campos e corrigir a
query sem adivinhação.

### O painel

Seis seções, escolhidas na barra lateral:

| Seção | Para quê |
|---|---|
| **Painel** | indicadores do dia e o quadro de rotas — responde "algum preço bom hoje?" de relance |
| **Rotas** | cadastrar, editar, pausar, consultar na hora e ver as ofertas de cada trecho |
| **Alertas** | histórico do que o monitor achou digno de avisar, com o motivo de cada disparo |
| **Câmbio** | cotação de DOLA11, USD e EUR, sinal de compra/venda, carteira de operações e backtest contra o CDI |
| **Cripto** | radar de quedas das moedas no Mercado Bitcoin, carteira em partes e estudo histórico contra o CDI |
| **Ajustes** | como o monitor está configurado (fontes, horários, regras de alerta, canais) |

A navegação é por hash (`#/rotas`), então recarregar a página cai na mesma tela e
não é preciso configurar nada no servidor.

### Origem e destino

Ninguém decora sigla de aeroporto, então os campos de origem e destino buscam por
cidade ("fortaleza"), por estado ("ceará", "CE") ou pela própria sigla, e o que
vai para a API é sempre o código IATA. O catálogo cobre os aeroportos comerciais
dos 27 estados (`web/src/lib/airports.ts`), conferido contra a base da
[OurAirports](https://davidmegginson.github.io/ourairports-data/airports.csv).

Se faltar algum, o campo continua aceitando as três letras digitadas à mão — o
catálogo ajuda, não obriga. As telas de rota mostram a cidade embaixo da sigla,
para não precisar traduzir `FOR → BEL` de cabeça.

### Buscar um período, não só uma data

Quase ninguém precisa viajar num dia exato — e a diferença entre uma terça e o
sábado seguinte costuma ser maior que qualquer queda de preço que o monitor vá
pegar esperando. Por isso cada rota tem um campo **Flexibilidade**: `± N dias` em
volta da data de ida, até 7 para cada lado.

Com ele preenchido, cada dia do período é consultado, o painel mostra **o preço
de cada dia lado a lado** com o mais barato destacado, e o alerta passa a dizer
*em que dia* o preço está (`FOR → SSA por R$ 380 em 12 set`).

Duas decisões que valem entender:

**A volta acompanha a ida.** Não existe janela separada para a volta. O que a
rota guarda de verdade é a *duração da viagem* — as noites entre `depart_date` e
`return_date` — e o par inteiro desliza junto: 10 noites continuam 10 noites em
qualquer dia da janela. Janela nos dois lados seria 7 × 7 = 49 consultas por
rodada, para devolver pares de duração que ninguém pediu.

**Cada dia é uma consulta a mais.** Uma rota de data fixa custa 1 consulta por
fonte por rodada; com `± 7 dias`, custa 15. A Kiwi resolve a janela de só-ida
numa chamada só (a API dela aceita intervalo em `outboundDepartureDate`), então
esse caso é barato; ida-e-volta e as demais fontes vão dia a dia, com pausa entre
eles. `SEARCH_MAX_DATES` é o teto por rota por rodada, e o que ficar de fora
aparece no log — o corte tira sempre os dias mais distantes da data escolhida.

Um dia que falha não derruba a janela: só vira erro quando *nenhum* dia do
período respondeu. Dia que já passou é descartado antes de consultar.

### Verificação

```bash
npm run typecheck # tipos do backend e do front
npm test          # validação de rota, janela de datas, formatação e catálogo
npm run lint      # ESLint, incluindo as regras de hooks do React
```

O `npm run build` já roda o typecheck do front antes de empacotar — o `vite build`
sozinho transpila sem checar tipo, então um erro passaria direto para produção.

### Desenvolvendo

O backend e o front têm ciclos separados:

```bash
npm run dev       # backend em :3777, recarrega ao salvar (tsx watch)
npm run web:dev   # front em :5173 com hot reload, /api é encaminhado para :3777
```

Rode os dois em terminais diferentes e trabalhe em **http://localhost:5173**. Para
gerar o front de produção: `npm run web:build` (sai em `public/`, que o Fastify serve).

## Iniciar junto com o Windows

```bash
npm run build
npm run install-startup
```

Sobe no logon, sem janela de console. O script escolhe o método sozinho:

- **Agendador de Tarefas** quando o terminal está elevado — ganha reinício automático em caso de falha;
- **pasta Startup do usuário** caso contrário — não pede admin e dá no mesmo aqui, porque a recuperação de horários perdidos é feita pelo próprio app, não pelo Windows.

Para remover (limpa os dois métodos): `npm run uninstall-startup`.

---

## Como funciona

```
logon do Windows
   ↓
tarefa agendada inicia o processo (oculto)
   ↓
recupera horários perdidos de hoje ──→ consulta
   ↓
node-cron aguarda a próxima hora cheia
   ↓
para cada rota ativa: cada dia da janela × provedor 1 → (falhou?) provedor 2
   ↓
grava todas as ofertas no MySQL, marcando quais atendem aos filtros da rota
   ↓
compara o melhor preço elegível com: consulta anterior · mínimo histórico · seu limite
   ↓
dispara alerta (notificação do Windows + Telegram opcional)
```

### Agenda

`SCHEDULE_EVERY_HOURS=1` (padrão) consulta de hora em hora, nas horas cheias.
Para horários fixos em vez do intervalo, use `SCHEDULE_TIMES=08:00,12:00,18:00` —
quando ele existe, manda nele.

### Recuperação de execuções perdidas

`node-cron` só dispara com o processo vivo — se o PC estava desligado às 08:00,
aquela consulta simplesmente não aconteceria. Cada horário executado vira uma
linha na tabela `runs`; na inicialização o app verifica quais horários de hoje já
passaram sem execução e roda **uma** consulta de recuperação (não uma por horário
perdido).

### Comparação justa de preços

Preço de passagem não é um número solto: uma tarifa promocional sem bagagem e com
2 conexões custa 40% menos que uma tarifa flex direta. Comparar as duas gera
"queda de 30%" que não existe.

Por isso cada rota tem filtros (`max_stops`, `require_checked_bag`) e **só ofertas
que passam nos filtros entram na comparação e nos alertas**. As demais ficam
gravadas com `eligible = 0`, para consulta, mas não disparam nada.

Numa rota com flexibilidade de datas, o **dia** também é filtro: busca por
intervalo pode devolver data fora do período pedido, e um preço de uma viagem que
você não faria envenenaria o histórico da rota.

Sobre a **média histórica**: ela aparece no painel, mas é a métrica menos útil das
três — preço é função de quantos dias faltam para o embarque, e a média arrasta
valores de quando faltavam 90 dias, que não voltam mais. Confie mais no *menor
preço* e na *variação desde a última consulta*.

### Alertas

Disparam quando:

- o melhor preço fica **abaixo do limite** que você definiu na rota;
- o preço **cai `DROP_ALERT_PCT`%** ou mais em relação à consulta anterior;
- é o **menor preço já registrado** para aquela rota.

`NOTIFY_COOLDOWN_HOURS` evita spam quando o preço fica oscilando em volta do
limite. Mínimo histórico ignora o cooldown — esse você sempre quer saber.

### Onde o aviso chega

A notificação do Windows está sempre ligada, mas ela se perde: jogo em tela
cheia engole o toast e você descobre a queda horas depois. O Telegram entrega no
celular.

```bash
npm run telegram   # descobre o chat id, grava no .env e manda um teste
```

Crie o bot no [@BotFather](https://t.me/BotFather), cole o token em
`TELEGRAM_BOT_TOKEN` e toque em *Iniciar* na conversa com o seu bot — o Telegram
só revela o chat id depois que você fala com ele, e é isso que impede um
estranho de te mandar mensagem. O comando descobre o resto sozinho.

As mensagens vão em **HTML, não em Markdown**: no Markdown do Telegram o link
termina no primeiro parêntese fechado, e deep link de provedor vem cheio deles —
`...?token=ab_c)d&passengers=1(2)` chegava cortado em `...?token=ab_c` e o botão
"Ver oferta" levava a uma página quebrada.

Em **Ajustes** cada canal mostra como foi a última entrega. Um canal que passou a
recusar (token trocado, bot bloqueado, chat apagado) aparece ali como falha, em
vez de silenciosamente parar de avisar.

---

## Estrutura

O backend é dividido em camadas: **controller** traduz HTTP, **service** decide,
**repository** fala com o banco. Nenhuma consulta SQL sai de `repositories/`, e
nenhum controller conhece o banco — trocar o acesso a dados (por um ORM, por
exemplo) mexe só naquela pasta.

```
src/
  config.ts             leitura e validação do .env
  logger.ts             log em data/app.log com níveis INFO/WARN/ERROR
  db/
    data-source.ts      DataSource do TypeORM (conexão, entities, synchronize)
    entities/           Route, Check, Offer, Notification, Run, Cambio*, CriptoOperacao — o esquema
    transformers.ts     DECIMAL → número e DATE → "YYYY-MM-DD"
  domain/
    route-input.ts      validação e normalização de rota (pura, testada)
    date-window.ts      janela de datas: expansão, corte do passado e teto (pura, testada)
    errors.ts           erros que sabem virar resposta HTTP
    cambio.ts           regras de câmbio: indicadores, sinal, custos e backtest (pura, testada)
    cripto.ts           regras do radar de cripto e backtest da grade (pura, testada)
  repositories/         route · check · offer · notification · run
  services/
    route.service.ts    CRUD de rota, resumo com histórico e estatísticas
    monitor.service.ts  consulta, elegibilidade e persistência
    alert.service.ts    regras de alerta e cooldown
    scheduler.service.ts node-cron + recuperação de horários perdidos
    status.service.ts   estado do sistema para o painel
    cambio.service.ts   cotações, sinal, carteira, alertas e backtest de câmbio
    cripto.service.ts   radar de quedas, grade em partes, carteira e estudo de cripto
  infra/
    notifier.ts         notificação do Windows + Telegram
    backup.ts           mysqldump diário, com rotação e conferência do arquivo
  http/
    server.ts           Fastify, parser de corpo vazio, tratamento de erro
    routes.ts           mapa da API
    controllers/        route · status · notification · cambio · cripto
  providers/
    types.ts            interface PriceProvider, fetch com timeout, backoff e Retry-After
    health.ts           estado de cada fonte e suspensão de quem está falhando
    kiwi.ts             adaptador Kiwi GraphQL (padrão, sem chave)
    maxmilhas.ts        adaptador MaxMilhas BFF (padrão, sem chave)
    google.ts           adaptador Google Flights RPC (padrão, sem chave; LATAM/GOL/Azul)
    travelpayouts.ts    adaptador Travelpayouts
    amadeus.ts          adaptador Amadeus (OAuth2 com cache de token)
    index.ts            seleção, fallback e expansão da janela de datas
    bcb.ts              Banco Central: PTAX (fechamento) e CDI (SGS série 12)
    awesome.ts          AwesomeAPI: cotação comercial ao vivo de USD/EUR
    yahoo.ts            Yahoo Finance: cotação do DOLA11 na B3
    mercadobitcoin.ts   Mercado Bitcoin: candles diários em BRL
  index.ts              inicialização
  cli/check-now.ts      consulta avulsa pelo terminal
  cli/comparar.ts       compara as fontes lado a lado num trecho
  cli/migrar-mysql.ts   traz o histórico do SQLite antigo para o MySQL
  cli/backup.ts         cópia do banco na hora, pelo terminal
  cli/compactar.ts      poda as ofertas antigas e encolhe a tabela
  cli/telegram.ts       descobre o chat id e testa a entrega do aviso
  cli/backtest-cambio.ts estratégia de câmbio no histórico, contra o CDI
  cli/estudo-cripto.ts  quedas e recuperações de cada cripto e a grade contra o CDI
web/                    painel em React + TypeScript + Tailwind (Vite)
  src/App.tsx           roteamento entre as páginas
  src/components/       AppShell, FlightBoard, RouteCard, RouteForm, AirportPicker…
  src/pages/            Dashboard, Routes, Alerts, Cambio, Cripto, Settings
  src/lib/              cliente da API, store, roteador, formatação pt-BR e o
                        catálogo de aeroportos (airports.ts)
  src/index.css         tokens de cor e tipografia (@theme do Tailwind)
tests/                  node:test rodando via tsx
public/                 build do front — gerado, não editar à mão
scripts/                instalação na inicialização do Windows
data/                   log, backups e o SQLite antigo (fora do git)
```

### API

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/status` | fontes, agenda, próxima e última rodada, se está consultando |
| `GET` | `/api/routes` | rotas com preço atual, série histórica, melhor oferta e, com janela, o menor preço de cada dia (`byDate`) |
| `POST` | `/api/routes` | cadastra e já dispara a primeira consulta |
| `PATCH` | `/api/routes/:id` | altera qualquer campo; mudar o que afeta a busca redispara a consulta |
| `DELETE` | `/api/routes/:id` | remove a rota e todo o histórico dela |
| `POST` | `/api/routes/:id/check` | consulta uma rota agora |
| `GET` | `/api/routes/:id/offers` | as melhores ofertas da última consulta |
| `POST` | `/api/check-all` | dispara a rodada completa; responde na hora |
| `GET` | `/api/notifications` | alertas enviados, com o trecho de cada um |
| `GET` | `/api/cambio` | panorama de câmbio: cotação, indicadores e sinal de cada ativo |
| `POST` | `/api/cambio/atualizar` | sincroniza as cotações agora |
| `GET` | `/api/cambio/carteira` | operações de câmbio registradas e resultado |
| `GET` | `/api/cambio/alertas` | alertas de câmbio e cripto enviados |
| `POST`/`DELETE` | `/api/cambio/operacoes[/:id]` | registra ou remove uma operação de câmbio |
| `GET` | `/api/cambio/backtest` | backtest da estratégia de um ativo contra o CDI |
| `GET` | `/api/cripto` | radar de cripto: queda do topo, tendência e ação do dia por moeda |
| `POST` | `/api/cripto/atualizar` | sincroniza os candles agora |
| `GET` | `/api/cripto/carteira` | lotes de cripto registrados e resultado |
| `POST`/`DELETE` | `/api/cripto/operacoes[/:id]` | registra ou remove uma operação de cripto |
| `GET` | `/api/cripto/estudo` | estudo de quedas e backtest da grade para uma moeda |

O painel acompanha o fim de uma rodada pelo campo `running` do `/api/status`, em
vez de cronometrar no escuro quanto ela demoraria.

## Banco

MySQL 8 com TypeORM. As entities estão em `src/db/entities/` e são a única
definição do esquema — não há SQL de criação escrito à mão.

`routes` (rotas cadastradas) · `checks` (uma linha por consulta, com duração,
provedor, status e erro) · `offers` (as ofertas retornadas, com flag de
elegibilidade e retenção — veja abaixo) · `runs` (horários já executados, para o
catch-up) · `notifications` (alertas enviados, base do cooldown).

Tudo que aponta para `routes` cai por `ON DELETE CASCADE`: excluir uma rota leva
junto o histórico dela, sem deixar órfão para bagunçar as contas de menor preço.

### Por que o banco não cresce sem parar

Cada consulta traz ~120 ofertas. Com a agenda de hora em hora e 5 rotas, são
~14.400 linhas por dia em `offers` — a única tabela que cresce de verdade.

Duas decisões seguram isso:

- **Nada de payload bruto.** A resposta completa do provedor chegava a ocupar
  9,4 KB por oferta e nunca era lida por ninguém. Sem ela, cada oferta custa
  **764 bytes** — 18× menos.
- **Consulta velha guarda só a melhor oferta.** Passados `OFFERS_RETENTION_DAYS`
  (padrão 30), a limpeza diária apaga as demais linhas daquela consulta.

A poda não mexe em nenhum número do painel, e isso não é promessa: a série de
preços é o `MIN(price)` elegível de cada consulta, que é exatamente a linha
preservada. Menor, maior, média, variação e menor histórico saem iguais depois
da limpeza. O que se perde é a lista completa de ofertas de consultas antigas —
e nenhuma tela abre isso, porque "ver ofertas" lê só a última consulta.

```bash
npm run compactar                    # poda agora e devolve o espaço ao disco
npm run compactar -- --simular       # só diz quantas linhas sairiam
npm run compactar -- --dias 7        # poda mais fundo nesta execução
```

A limpeza automática roda logo depois do backup diário, nunca antes — a cópia do
dia precisa conter o detalhe que vai ser apagado.

Duas armadilhas do MySQL que valem saber, porque as duas fazem uma limpeza
bem-sucedida parecer que não funcionou:

- Apagar linha do InnoDB **não devolve espaço ao disco**; o arquivo só encolhe
  com `OPTIMIZE TABLE`, que o `npm run compactar` já roda.
- `information_schema.tables` serve tamanho de um cache que expira em 24 h. Ler
  o tamanho logo depois da limpeza devolve o valor de ontem — por isso o código
  faz `ANALYZE TABLE` antes de medir.

Duas conversões merecem atenção, em `src/db/transformers.ts`:

- **`DECIMAL` volta como string** no driver do MySQL, para não perder precisão.
  Preço aqui entra em conta e comparação, então vira número na fronteira.
- **Data de voo é dia de calendário, não instante.** `depart_date` e `return_date`
  são `DATE` e trafegam como `"YYYY-MM-DD"` puro (`dateStrings` no DataSource);
  passar por `Date` arriscaria adiantar ou atrasar o dia conforme o fuso. Já os
  instantes (`checked_at`, `sent_at`) são `datetime(3)` e viajam em UTC.

### Backup

O histórico de preços não se refaz: uma série de meses só existe porque o monitor
estava no ar naquelas horas. Por isso o banco é copiado sozinho.

```bash
npm run backup   # gera uma cópia na hora e lista as que existem
```

Todo dia às `BACKUP_TIME` (padrão 04:00) o monitor roda um `mysqldump` em
`data/backups/`, mantém as `BACKUP_KEEP` cópias mais recentes (padrão 7) e apaga
o resto. Se o PC estava desligado no horário, a cópia do dia é feita na
inicialização seguinte — a mesma ideia da recuperação de consultas perdidas.

Cada dump é conferido antes de contar como válido: sem a marca `Dump completed`
no fim do arquivo, o mysqldump morreu no meio e o resultado não serve. Um arquivo
truncado é pior que nenhum, porque parece que existe cópia.

O `mysqldump.exe` é procurado na instalação padrão do MySQL e depois no PATH;
`MYSQLDUMP_PATH` no `.env` resolve instalações fora do lugar. A senha vai por
variável de ambiente, não na linha de comando, para não aparecer na lista de
processos.

Para restaurar:

```bash
mysql -u root -p < "data/backups/monitor-2026-08-05-0400.sql"
```

O dump inclui `CREATE DATABASE`, então ele **recria o banco inteiro** — restaurar
por cima descarta o que estiver lá. A última cópia e o tamanho dela aparecem em
**Ajustes**, no painel.

## Adicionar outro provedor

Implemente a interface `PriceProvider` (`name`, `isConfigured()`, `search()`),
registre em `src/providers/index.ts` e adicione o nome em `PROVIDER_ORDER`.
Nada mais no código precisa mudar.
