# KonekTron API v3.2

API do KonekTron — Engenharia de Software e Análise de Dados.
Node.js 24 · Express 5 · PostgreSQL (Knex) · Zod 4 · JWT.

## Estrutura

```
src/
├── server.js · app.js · routes.js
├── docs/          openapi.js (especificação gerada dos schemas Zod), página Swagger UI
├── config/        env.js (validação do .env), plans.js (planos e seções)
├── database/      connection.js, helpers.js, migrations/, seeds/
├── middlewares/   authenticate, authorize, validate, loadProject, errorHandler
├── services/      mailer (SMTP), auditLog
├── shared/        crudRouter (CRUD genérico com escopo), schemas comuns
├── utils/         AppError, case (snake/camel), logger, tokens
└── modules/
    ├── auth/         RF1, RF2, RF4, RF7
    ├── profiles/     RF3
    ├── addresses/    endereços (CRUD genérico)
    ├── users/        RF5 — administração de contas
    ├── logs/         RF5 — acessos e operações
    ├── projects/     projetos `software` ou `data_analysis`
    ├── system-analysis/  requisitos, histórias de usuário e diagramas (projetos de software)
    ├── crisp-dm/     metodologia CRISP-DM para projetos de dados
    └── engineering/  RF6 — catálogo de seções (as não implementadas respondem 501)
```

Imports internos usam *subpath imports* do Node: `import { db } from '#database/connection.js'`.

**Convenção de nomes:** o banco é `snake_case` e o código/API é `camelCase`. A conversão
é automática (hooks do Knex em `utils/case.js`). Exceções: migrations, seeds e `db.raw`,
que usam `snake_case` direto. O conteúdo de colunas `jsonb` não é convertido.

## Rodando localmente

```bash
nvm use                          # lê o .nvmrc (24.21.0)
cp .env.example .env             # preencha; JWT: openssl rand -hex 64
docker compose up -d             # Postgres 17 local (opcional)
npm install
npm run migrate
npm run seed                     # admin + projeto CRISP-DM demo (se SEED_ADMIN_* definidos)
npm run dev
curl http://localhost:3333/api/v1/health
```

Outros scripts: `npm test`, `npm run lint`, `npm run migrate:status`, `npm run db:reset` e
`npm run db:check` (testa a conexão com o banco do `.env` e mostra as migrations pendentes).

## Documentação interativa

Com a API rodando, abra **http://localhost:3333/api/v1/docs/**: Swagger UI com todas as rotas,
exemplos e *Try it out*. Um login ou cadastro feito pela página já autoriza as chamadas
seguintes. A especificação OpenAPI 3.1 fica em `/api/v1/docs/openapi.json`, pronta para
importar no Postman/Insomnia ou gerar um cliente para o front.

A especificação é montada em [src/docs/openapi.js](src/docs/openapi.js) a partir dos mesmos
schemas Zod que validam as requisições, então corpos, filtros, limites e enums acompanham o
código. **Ao criar uma rota, registre-a lá**. Os exemplos são validados contra os schemas, e
`npm test` falha se algum ficar inválido. Para desligar a página (ex.: em produção), use
`DOCS_ENABLED=false`.

## Endpoints (`/api/v1`)

### Conta e administração

| Método | Rota | Acesso | Req. |
|---|---|---|---|
| POST | /auth/register · /auth/login · /auth/refresh | público | RF1/RF2 |
| POST | /auth/verify-email · /auth/forgot-password · /auth/reset-password | público | RF1/RF4 |
| POST | /auth/logout (`{ refreshToken }` ou `{ allDevices: true }`) | logado | RF7 |
| GET · DELETE | /auth/me (DELETE exige `{ password }`) | logado | RF2/RF5 |
| POST | /auth/change-password · /auth/resend-verification | logado | RF1/RF4 |
| GET · PATCH | /profiles/me | logado | RF3 |
| CRUD | /addresses | logado | RF3 |
| GET · PATCH · DELETE | /admin/users[/:id] | admin | RF5 |
| GET | /admin/logs · /admin/logs/summary | admin | RF5 |

### Projetos e engenharia

| Método | Rota | Observação |
|---|---|---|
| GET · POST | /projects | `type`: `software` (padrão) ou `data_analysis` |
| GET · PATCH · DELETE | /projects/:projectId | o tipo não muda após criado |
| GET | /engineering/sections | seções, se estão liberadas pelo plano e implementadas |

### Análise de Sistemas — `/projects/:projectId/system-analysis`

Disponível em todos os planos, para projetos `software`.

| Método | Rota | Observação |
|---|---|---|
| GET | / | visão geral: análise e contagens por tipo/status |
| GET | /report | documento completo, com histórias por requisito |
| GET · PATCH | /analysis | `goal`, `scope`, `technicalDescription`, `notes` |
| CRUD | /requirements | filtros `?type=&status=&priority=`; `code` único no projeto (RF1, RNF7...) |
| CRUD | /user-stories | `asA`/`iWant`/`soThat`, `requirementId` opcional; filtros `?requirementId=&status=` |
| CRUD | /diagrams | `url` ou `source` (Mermaid, PlantUML...); filtro `?type=` |

### CRISP-DM — `/projects/:projectId/crisp-dm`

Exige plano Standard/Master e projeto `data_analysis`. As 6 fases são criadas
automaticamente com o projeto.

| Método | Rota | Fase |
|---|---|---|
| GET | / | visão geral: progresso, fase atual, contagens |
| GET | /report | documento completo (base para relatório/PDF) |
| GET | /phases · /phases/:phase | todas |
| PATCH | /phases/:phase (`status`, `notes`, `content`) | todas |
| CRUD | /objectives | Business Understanding |
| CRUD | /datasets · /datasets/:datasetId/fields | Data Understanding |
| CRUD | /preparation-steps | Data Preparation |
| CRUD | /models | Modeling |
| CRUD | /models/:modelId/metrics | Evaluation |

### Kanban — `/projects/:projectId/kanban`

Disponível em todos os planos, para qualquer tipo de projeto (migration 000010).

| Método | Rota | Observação |
|---|---|---|
| GET | / | quadro: colunas em ordem, cada uma com seus cartões em ordem |
| CRUD | /columns | `name`, `wipLimit` opcional; nova coluna entra à direita |
| POST | /columns/:id/move | `{ position }`; devolve o quadro |
| CRUD | /cards | `columnId`, `title`, `description`, `priority` (`low`…`urgent`), `dueDate`, `assignee`; filtros `?columnId=&priority=` |
| POST | /cards/:id/move | `{ columnId, position }`; reordena os vizinhos e devolve o quadro |

O PATCH de cartão não muda coluna nem posição: use `/move`. Excluir uma coluna exclui
seus cartões.

`content` de cada fase guarda as saídas das tarefas do guia CRISP-DM 1.0
(ex.: `background`, `dataQualityReport`, `testDesign`, `decision`). O PATCH faz *merge*:
envie só as tarefas que mudaram. A lista de tarefas de cada fase vem em `GET /phases`.

Exemplo:

```bash
curl -X PATCH $API/projects/$ID/crisp-dm/phases/evaluation \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"completed","content":{"assessmentOfResults":"Recall 0.81","decision":"deploy"}}'
```

## Banco na HostGator

O banco roda como serviço Docker no painel da VPS. O endereço que o painel mostra como
**host interno** (ex.: `konektron_konektron_database`) só existe dentro da rede Docker do
servidor: funciona para a API instalada lá, mas não do seu computador.

| Onde a API roda | `DATABASE_URL` |
| --- | --- |
| No painel, no mesmo projeto do banco | URL interna do painel (`postgres://…@konektron_konektron_database:5432/…`) |
| No seu computador, via túnel SSH | `postgres://…@127.0.0.1:5433/…` com o túnel aberto (abaixo) |
| No seu computador, via porta pública | `postgres://…@<IP da VPS>:<porta pública>/…` |

**Túnel SSH (recomendado):** o banco continua fechado para a internet. Preencha `SSH_HOST`
(e, se preciso, `SSH_USER`, `SSH_PORT`, `DB_CONTAINER`, `TUNNEL_PORT`) no `.env`, ative a
`DATABASE_URL` com `127.0.0.1:5433` e rode:

```bash
npm run db:tunnel      # deixe aberto; Ctrl+C fecha
npm run db:check       # em outro terminal
```

O script entra no servidor, localiza o contêiner do banco (no Docker Swarm do EasyPanel, pelo
IP da `docker_gwbridge`, que o host alcança) e abre o túnel. Sem chave SSH, a senha é pedida
duas vezes; para não digitar, crie uma chave uma única vez:

```bash
ssh-keygen -t ed25519                                        # Enter em tudo
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@<IP da VPS> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"   # PowerShell
ssh-copy-id root@<IP da VPS>                                 # Linux/macOS
```

**Porta pública:** no serviço do banco, publique a porta 5432 em uma porta externa e libere
no firewall **apenas o seu IP**. Com senha fraca, um Postgres aberto para a internet é
invadido em horas.

## Deploy na VPS (HostGator)

**Com o painel (Docker):** crie um app no mesmo projeto do banco apontando para este
repositório; o `Dockerfile` instala as dependências, aplica as migrations ao iniciar
(`npm run start:prod`) e informa a saúde em `/api/v1/health`. Configure no painel as
variáveis do `.env.example` (com `NODE_ENV=production` e a `DATABASE_URL` interna), a porta
3333 e o domínio com HTTPS.

**Sem Docker:** Node 24 via nvm, PM2 (`pm2 start ecosystem.config.cjs --env production`) e
Nginx como proxy reverso com HTTPS (Let's Encrypt) para a porta 3333.

Em ambos: bancos separados para homologação e produção (RNF7), e a extensão `citext`
disponível (já vem na imagem oficial do Postgres; fora dela, pacote `postgresql-contrib`).
