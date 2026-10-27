
# Sistema de Monitoramento Automático de Passagens Aéreas

## Objetivo

Desenvolver uma aplicação desktop (Windows) responsável por monitorar automaticamente o preço de passagens aéreas, realizando consultas diariamente e armazenando o histórico dos valores encontrados.

O sistema deverá funcionar de forma totalmente automática após configurado, sem necessidade de intervenção do usuário, permitindo acompanhar a evolução dos preços e identificar oportunidades de compra quando houver redução significativa.

---

# Objetivos do Projeto

## Objetivo Geral

Criar um sistema leve e automatizado capaz de consultar diariamente os preços de passagens aéreas entre rotas cadastradas pelo usuário.

## Objetivos Específicos

* Consultar preços automaticamente todos os dias.
* Armazenar o histórico das consultas.
* Comparar preços atuais com históricos.
* Identificar redução de preços.
* Notificar o usuário quando houver promoções.
* Executar em segundo plano.
* Consumir poucos recursos do computador.
* Funcionar sem necessidade de abrir manualmente o programa.

---

# Funcionamento Geral

O fluxo esperado será:

```text
Inicialização do Windows
        │
        ▼
Aplicação inicia automaticamente
        │
        ▼
Verifica horário da consulta
        │
        ▼
Consulta os preços
        │
        ▼
Salva no banco de dados
        │
        ▼
Compara com histórico
        │
        ▼
Existe redução?
      /     \
    Sim      Não
    │         │
Envia alerta  Aguarda próxima execução
```

---

# Requisitos Funcionais

## Cadastro de Rotas

O usuário poderá cadastrar diversas rotas contendo:

* Aeroporto de origem
* Aeroporto de destino
* Data de ida
* Data de volta (opcional)
* Quantidade de passageiros
* Limite de preço desejado
* Observações

Exemplo:

| Origem | Destino | Ida        | Volta      | Limite |
| ------ | ------- | ---------- | ---------- | ------ |
| FOR    | GRU     | 15/12/2026 | 22/12/2026 | R$ 850 |

---

## Consulta Automática

A aplicação deverá realizar consultas automaticamente.

Exemplo:

* Todos os dias às 08:00
* Todos os dias às 12:00
* Todos os dias às 18:00

A frequência deverá ser configurável.

---

## Histórico

Cada consulta deverá ser armazenada.

Exemplo:

| Data  | Preço   |
| ----- | -------- |
| 01/08 | R$ 1.250 |
| 02/08 | R$ 1.180 |
| 03/08 | R$ 1.090 |
| 04/08 | R$ 980   |

Isso permitirá acompanhar a evolução dos preços.

---

## Comparação

Após cada consulta o sistema deverá comparar:

* último preço
* menor preço encontrado
* média histórica
* diferença percentual
* diferença em reais

Exemplo:

```text
Preço anterior:
R$ 1.250

Preço atual:
R$ 980

Redução:
R$ 270

Percentual:
21,6%
```

---

# Notificações

O sistema deverá ser capaz de enviar alertas quando:

* preço ficar abaixo do valor desejado
* preço diminuir X%
* surgir promoção
* menor preço histórico

As notificações poderão ser enviadas futuramente por:

* Desktop (Windows)
* Telegram
* WhatsApp
* Discord
* Email

---

# Banco de Dados

Cada consulta deverá gerar um registro contendo:

```text
ID

Origem

Destino

Data da viagem

Data da consulta

Preço encontrado

Fornecedor

Moeda

Link da oferta

Tempo da consulta

Status
```

---

# Inicialização Automática

## Objetivo

O usuário **não deverá precisar abrir o sistema manualmente**.

Sempre que o Windows iniciar, a aplicação deverá iniciar automaticamente.

### Requisitos

* iniciar junto com o Windows;
* permanecer em segundo plano;
* minimizar para a bandeja do sistema (System Tray);
* não abrir janelas desnecessárias durante a inicialização;
* consumir pouca memória.

A inicialização poderá ser realizada utilizando:

* Registro do Windows (Run)
* Pasta Startup
* Agendador de Tarefas do Windows (Task Scheduler)

O método deverá ser configurável.

---

# Execução Diária

Após iniciar com o Windows, o sistema deverá permanecer ativo aguardando o horário configurado para executar as consultas.

Exemplo:

```text
08:00
↓

Consulta

↓

Salva resultados

↓

Aguarda

↓

12:00

↓

Nova consulta

↓

Aguarda

↓

18:00

↓

Nova consulta

↓

Fim do dia
```

Caso o computador permaneça ligado por vários dias, o sistema continuará executando conforme o agendamento.

Caso o computador seja desligado, ao ligar novamente a aplicação será iniciada automaticamente e retomará o monitoramento.

---

# Recuperação de Falhas

O sistema deverá possuir mecanismos de recuperação.

Exemplos:

* perda de internet;
* API indisponível;
* erro na consulta;
* timeout;
* falha de autenticação;
* erro ao salvar dados.

Todas as falhas deverão ser registradas em log para facilitar diagnóstico.

---

# Logs

Registrar:

* data e hora
* rota consultada
* duração da consulta
* preço encontrado
* erros
* notificações enviadas

Os logs deverão possuir níveis:

* INFO
* WARNING
* ERROR

---

# Arquitetura Sugerida

## Aplicação

* Node.js
* TypeScript
* NestJS

## Agendamento

* node-cron

## Banco

* SQLite (projeto local)
* ou PostgreSQL (versão futura)

## Interface

* Electron
* React

---

# Estrutura Sugerida

```text
src/

config/

scheduler/

scraper/

providers/

database/

notifications/

logs/

history/

routes/

utils/
```

---

# Fluxo Completo

```text
Windows inicia

↓

Aplicação inicia automaticamente

↓

Carrega configurações

↓

Carrega rotas cadastradas

↓

Aguarda horário

↓

Consulta preços

↓

Armazena histórico

↓

Compara resultados

↓

Preço caiu?

↓

Sim
    ↓
Envia notificação

Não
    ↓
Aguarda próxima consulta
```

---

# Possíveis Evoluções

* Dashboard web.
* Aplicativo mobile.
* Gráficos de evolução de preços.
* Inteligência para prever tendência de aumento ou queda.
* Múltiplos usuários.
* Sincronização em nuvem.
* Integração com calendários de promoções.
* Suporte a diferentes provedores de consulta (APIs e scraping) com troca automática em caso de falhas.

---

# Resultado Esperado

Ao final do projeto, o usuário terá um sistema totalmente automatizado que:

* inicia junto com o Windows;
* executa em segundo plano;
* consulta preços diariamente sem intervenção manual;
* mantém histórico completo das consultas;
* identifica reduções de preço automaticamente;
* envia notificações quando encontrar oportunidades de compra;
* pode ser expandido futuramente para suportar múltiplos usuários, diferentes fontes de dados e novos canais de notificação.
