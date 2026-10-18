# KonekTron API v4

API do KonekTron — Engenharia de Software e Análise de Dados.
Node.js 24 · Express 5 · PostgreSQL (Knex) · Zod 4 · JWT.

## Estrutura

```
src/
├── server.js · app.js · routes.js
├── docs/          openapi.js (especificação gerada dos schemas Zod), página Swagger UI
├── config/        env.js (validação do .env), plans.js (perfis e seções)
├── database/      connection.js, helpers.js, migrations/, seeds/
├── middlewares/   authenticate, authorize, validate, loadProject, errorHandler
├── services/      mailer (SMTP), auditLog
├── shared/        crudRouter (CRUD genérico com escopo), files (upload/download), projectRefs, schemas comuns
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
    ├── ontologies/   catálogo de ontologias com arquivo e leitura automática (qualquer projeto)
    ├── bpm/          arquitetura de processos, SIPOC e diagramas BPMN (qualquer projeto)
    ├── commonkads/   planilhas CommonKADS e MAS-CommonKADS (qualquer projeto)
    ├── function-points/  contagem de Pontos de Função IFPUG (projetos de software)
    ├── scrum/        papéis, backlogs, sprints, tasks e eventos (qualquer projeto)
    ├── kanban/       quadro de tarefas (qualquer projeto)
    ├── contact/      formulário de contato e caixa de mensagens do admin
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
| POST | /auth/google (`{ credential, acceptTerms? }`) | público | UC002 A1 |
| POST | /auth/verify-email · /auth/forgot-password · /auth/reset-password | público | RF1/RF4 |
| POST | /auth/logout (`{ refreshToken }` ou `{ allDevices: true }`) | logado | RF7 |
| GET · DELETE | /auth/me (DELETE exige `{ password }`, ou `{ confirmEmail }` em conta só Google) | logado | RF2/RF5 |
| POST | /auth/change-password · /auth/resend-verification | logado | RF1/RF4 |

**Login com Google:** o app usa o botão do Google (Google Identity Services) e envia o ID token
em `POST /auth/google`; a API confere a assinatura com `google-auth-library` (sem client secret).
A conta vinculada entra direto; sem vínculo, o `google_id` é ligado à conta com o mesmo e-mail;
sem conta, ela é criada sem senha e com o e-mail verificado, após o aceite dos Termos (422 com
`details.acceptTerms` até lá). Conta só Google define a primeira senha em `/auth/change-password`
sem a senha atual. Configure `GOOGLE_CLIENT_ID` com o ID do cliente OAuth (tipo Aplicativo da
Web, com o domínio do app em "Origens JavaScript autorizadas"); vazio, a rota responde 503.
| GET · PATCH | /profiles/me | logado | RF3 |
| CRUD | /addresses | logado | RF3 |
| GET · PATCH · DELETE | /admin/users[/:id] | admin Master | RF5 |
| GET | /admin/logs · /admin/logs/summary | admin Master | RF5 |

### Projetos e engenharia

| Método | Rota | Observação |
|---|---|---|
| GET · POST | /projects | `type`: `software` (padrão) ou `data_analysis` |
| GET · PATCH · DELETE | /projects/:projectId | o tipo não muda após criado |
| GET | /engineering/sections | seções, se estão liberadas (todas) e implementadas |

### Análise de Sistemas — `/projects/:projectId/system-analysis`

Projetos `software`.

| Método | Rota | Observação |
|---|---|---|
| GET | / | visão geral: análise e contagens por tipo/status |
| GET | /report | documento completo, com histórias por requisito |
| GET · PATCH | /analysis | `goal`, `scope`, `technicalDescription`, `notes` |
| CRUD | /requirements | filtros `?type=&status=&priority=`; `code` único no projeto (RF1, RNF7...) |
| CRUD | /user-stories | `asA`/`iWant`/`soThat`, `requirementId` opcional; filtros `?requirementId=&status=` |
| CRUD | /diagrams | `url` ou `source` (Mermaid, PlantUML...); filtro `?type=` |

### CRISP-DM — `/projects/:projectId/crisp-dm`

Exige projeto `data_analysis`. As 6 fases são criadas
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

### Ontologias — `/projects/:projectId/ontologies`

Qualquer tipo de projeto (migration 000013). A raiz é a própria coleção.

| Método | Rota | Observação |
|---|---|---|
| GET | /summary | totais, publicadas, com arquivo, soma das contagens, uso de formatos/vocabulários/princípios |
| CRUD | / | título, descrição, formato, IRI, versão, situação, contagens (`classCount`, `relationshipCount`, `propertyCount`, `objectCount`), `vocabularies`, `principles`, `publicationUrl`, questões de competência...; filtros `?format=&status=` |
| PUT · GET · DELETE | /:id/file | arquivo da ontologia (`.owl`, `.rdf`, `.ttl`, `.jsonld`, `.obo`...) |

Ao receber o arquivo, a API identifica formato, IRI, versão e vocabulários (pelos namespaces) e
estima as contagens: relacionamentos = propriedades de objeto, propriedades = de dados, objetos =
indivíduos. Só preenche o que está vazio; a leitura completa volta em `analysis`.

### BPM — `/projects/:projectId/bpm`

Qualquer tipo de projeto (migration 000014).

| Método | Rota | Observação |
|---|---|---|
| GET | / | processos para a árvore (por `parentId`), contagens e se o SIPOC de cada um está completo |
| CRUD | /processes | `code`, `level` (macroprocesso → atividade), `parentId` (sem ciclos), dono, SIPOC (`suppliers`, `inputs`, `steps`, `outputs`, `customers`), indicadores, problemas e melhorias |
| CRUD | /diagrams | `processId`, `state` (`as_is`/`to_be`), notação, versão, ferramenta, `url`; filtros `?processId=&state=` |
| PUT · GET · DELETE | /diagrams/:id/file | `.bpmn`/`.xml` (lido: tarefas, eventos, gateways, pools, raias → `metrics`), imagem ou PDF |

### CommonKADS — `/projects/:projectId/commonkads`

Qualquer tipo de projeto (migration 000015). As 17 planilhas do CommonKADS e da
extensão MAS-CommonKADS: as de texto livre guardam o conteúdo na própria planilha; as em linhas
são cadastros (OM-3/TM-1 → tarefas, OM-4/TM-2 → conhecimento, AM-1/MAS → agentes, CM-1/CM-2 →
transações). Os vínculos são guardados uma vez só e o relatório os resolve nos dois sentidos.

| Método | Rota | Observação |
|---|---|---|
| GET | / | progresso, situação das planilhas, contagens e lacunas (tarefas sem agente, conhecimento sem uso...) |
| GET | /report | documento completo |
| GET · PATCH | /worksheets[/:key] | `om-1` … `dm-4`; `status`, `notes` e `content` (merge) |
| CRUD | /tasks | OM-3 + TM-1; `agentIds`, `knowledgeIds`, intensiva em conhecimento, significância 1–5 |
| CRUD | /knowledge | OM-4 + TM-2; forma/lugar/tempo/qualidade certos e `characterization` (natureza, forma, disponibilidade, gargalos) |
| CRUD | /agents | AM-1 + MAS; `kind`, `knowledgeIds`, `communicatesWithIds`, condições de ativação/término/sucesso/falha, técnica de IA |
| CRUD | /transactions | CM-1 + CM-2; tarefas e agentes de origem/destino, `informationItems`, `messages` (tipos de comunicação) |

### Arquivos

Upload com o arquivo bruto no corpo (`Content-Type: application/octet-stream`, até 20 MB) e o
nome em `X-File-Name` (codificado com `encodeURIComponent`). O conteúdo fica no Postgres, numa
tabela própria apagada em cascata com o registro; as listagens trazem só os metadados (`fileName`,
`fileMime`, `fileSize`, `fileSha256`, `fileUploadedAt`).

```bash
curl -X PUT $API/projects/$ID/ontologies/$ONTO/file \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/octet-stream' \
  -H 'X-File-Name: agenda.owl' --data-binary @agenda.owl
```

### Pontos de Função — `/projects/:projectId/function-points`

Projetos `software` (migration 000017). Contagem IFPUG: a API calcula a complexidade
(matriz TR × TD para ALI/AIE, ALR × TD para EE/SE/CE) e os PF de cada função na gravação.

| Método | Rota | Observação |
|---|---|---|
| GET | / | contagens com o número de funções e o total de PF |
| CRUD | /counts | `name`, `countType` (`development`, `enhancement`, `application`), propósito, escopo, `hoursPerFp`, `costPerHour`, `currency` |
| GET | /counts/:id/summary | contagem, funções e o resumo: escopo (ALI/AIE), complexidade (TD/TR), contribuição, PF de dados e de transação, PF por ação (melhoria), esforço e custo |
| CRUD | /counts/:countId/functions | `type` (`ilf` ALI, `eif` AIE, `ei` EE, `eo` SE, `eq` CE), `det` (TD), `retFtr` (TR ou ALR), `action` (melhoria); filtros `?type=&complexity=` |

### Scrum — `/projects/:projectId/scrum`

Qualquer tipo de projeto (migration 000018), segundo o Guia do Scrum 2020.

| Método | Rota | Observação |
|---|---|---|
| GET | / | papéis, contagens, eventos por tipo, velocidade e a sprint atual com burndown |
| GET · PATCH | /settings | visão, Meta do Produto, Definição de Preparado e de Pronto, duração da sprint, acordos de trabalho |
| CRUD | /members | `role` (`product_owner`, `scrum_master`, `developer`, `stakeholder`), capacidade em horas |
| CRUD | /items | Product Backlog: `code`, `type`, `storyPoints` (Fibonacci), valor de negócio, critérios de aceitação; `sprintId` põe o item no Sprint Backlog |
| POST | /items/:id/move | `{ position }`; reordena o Product Backlog |
| CRUD | /sprints | `number`, meta, datas, `status`, incremento (texto, versão, URL) |
| GET | /sprints/:id/detail | sprint com itens, tasks, eventos e burndown |
| CRUD | /tasks | `sprintId`, `itemId`, `assigneeId`, `status` (`todo`, `in_progress`, `done`), horas estimadas e restantes |
| POST | /sprints/:id/publish-kanban | publica no Kanban as tasks da sprint que ainda não estão lá (ver abaixo) |
| CRUD | /events | `type` (`planning`, `daily`, `review`, `retrospective`, `refinement`), data, facilitador, participantes, `updates` da daily, campos da review e da retrospectiva |

**Scrum ↔ Kanban** (migration 000019). Publicar a sprint cria um cartão para cada task (itens do Sprint
Backlog sem tasks ganham uma task com o próprio título), na coluna da situação da task. As colunas do
Kanban têm `taskStatus` (`todo`, `in_progress`, `done`); um quadro vazio ganha as três colunas e um quadro
sem nenhuma marcação é marcado pela ordem (1ª, 2ª e última). Depois disso:

- mover o cartão para uma coluna marcada muda a situação da task (colunas sem marcação não mudam nada);
- mudar a task no Scrum leva o cartão para a coluna da nova situação; título, descrição e responsável acompanham;
- editar título ou descrição do cartão edita a task; excluir a task exclui o cartão (excluir o cartão mantém a task);
- o item do backlog acompanha as suas tasks: todas concluídas → item concluído; alguma reaberta → em andamento;
- `GET /sprints/:id/detail` traz `delivered` (itens e tasks concluídos e os pontos entregues): o incremento.

### Contato — `/contact` e `/admin/contact-messages`

`POST /contact` é público (5 envios a cada 15 minutos): `name`, `email`, `subject`, `message`. A mensagem
fica no banco (migration 000016) e, com `CONTACT_EMAIL` definido, também vai por e-mail. O admin lista
(`?status=&page=`), muda a situação (`new`, `read`, `answered`, `archived`) e exclui em `/admin/contact-messages`.

Teste do e-mail: `npm run mail:test [-- destino]` confere o SMTP e envia uma mensagem de teste (padrão: `CONTACT_EMAIL`).

### Perfis e administração

Não há cobrança: todos os planos (`free`, `standard`, `master`) acessam todas as seções, e todo cadastro novo
começa `client`/`free`. Os perfis continuam distintos no banco; quem os muda é o administrador, em
`PATCH /admin/users/:id` (`role`, `plan`). As rotas `/admin/*` (usuários, logs, mensagens) e o acesso a
projetos de outros usuários são exclusivos de quem tem papel `admin` **e** plano `master`; o middleware
`requireMasterAdmin` confere isso no banco a cada requisição, então um rebaixamento vale na hora. A migration
000021 removeu as tabelas da antiga integração com o PagBank e deixou todos como Free, exceto o dono do sistema.

### Kanban — `/projects/:projectId/kanban`

Qualquer tipo de projeto (migration 000010).

| Método | Rota | Observação |
|---|---|---|
| GET | / | quadro: colunas em ordem, cada uma com seus cartões em ordem |
| CRUD | /columns | `name`, `wipLimit` opcional; nova coluna entra à direita |
| POST | /columns/:id/move | `{ position }`; devolve o quadro |
| CRUD | /cards | `columnId`, `title`, `description`, `priority` (`low`…`urgent`), `dueDate`, `assignee`; filtros `?columnId=&priority=` |
| POST | /cards/:id/move | `{ columnId, position }`; reordena os vizinhos e devolve o quadro |

O PATCH de cartão não muda coluna nem posição: use `/move`. Excluir uma coluna exclui
seus cartões. Colunas aceitam `taskStatus` e cartões publicados pelo Scrum trazem `scrumTaskId`,
`taskStatus`, `sprintId`, `sprintNumber` e `itemCode` (ver Scrum ↔ Kanban acima).

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
repositório, com o Dockerfile em `.github/workflows/Dockerfile` e o contexto do build na
raiz. Ele instala as dependências, aplica as migrations ao iniciar e informa a saúde em
`/api/v1/health`. Configure no painel as variáveis do `.env.example` (com
`NODE_ENV=production` e a `DATABASE_URL` interna), a porta 3333 e o domínio com HTTPS.

**Docker direto na VPS:**

```bash
git clone -b main https://github.com/ivamgf/api-konektron-node.git && cd api-konektron-node
# crie o .env de produção a partir do .env.example
docker build -f .github/workflows/Dockerfile -t konektron-api .
docker run -d --name konektron-api --env-file .env -p 3333:3333 --restart unless-stopped konektron-api
```

**Sem Docker:** Node 24 via nvm, PM2 (`pm2 start ecosystem.config.cjs --env production`) e
Nginx como proxy reverso com HTTPS (Let's Encrypt) para a porta 3333.

Em ambos: bancos separados para homologação e produção (RNF7), e a extensão `citext`
disponível (já vem na imagem oficial do Postgres; fora dela, pacote `postgresql-contrib`).
