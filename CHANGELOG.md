# Changelog

## 4.1.0 — 2026-10-15

### Adicionado
- **Formulário de contato** (`POST /contact`, público; com token válido a mensagem fica ligada ao usuário): nome,
  e-mail, assunto e mensagem, com limite de 5 envios a cada 15 minutos e campo-armadilha anti-robô. As mensagens
  ficam no banco e, com `CONTACT_EMAIL` definido, também são enviadas por e-mail (com `Reply-To` do remetente).
  Caixa do admin em `/admin/contact-messages` (lista paginada com contagem por situação, mudar situação, excluir).
- Seção **Pontos de Função** (`/projects/:projectId/function-points`, projetos `software`, plano Master): contagens
  IFPUG por tipo (projeto de desenvolvimento, de melhoria ou aplicação), com escopo e fronteira, e funções de dados
  (ALI/AIE) e de transação (EE/SE/CE). Complexidade e PF são calculados pela API a partir de TD e TR/ALR (tabelas de
  complexidade e contribuição do IFPUG). O resumo traz as tabelas das planilhas (determinação do escopo,
  complexidade, contribuição), PF de dados e de transação, PF por ação (melhoria) e estimativa de esforço e custo.
- Seção **Scrum** (`/projects/:projectId/scrum`, qualquer tipo de projeto, planos Standard e Master): dados gerais
  (visão, Meta do Produto, Definição de Preparado e de Pronto, duração da sprint, acordos), papéis (Product Owner,
  Scrum Master, Developers, stakeholders), Product Backlog ordenável, Sprint Backlog, sprints com meta, tasks e
  incremento, eventos (planning, daily com atualizações por membro, review, retrospectiva, refinamento), burndown
  e velocidade.
- `shared/ordering.js`: ordenação manual por posição, agora usada pelo Kanban e pelo Product Backlog.
- Migrations 000016 a 000018; rotas documentadas no OpenAPI.

### Configuração
- Nova variável opcional `CONTACT_EMAIL` (vazia: as mensagens só ficam no banco).

## 4.0.0 — 2026-10-14

### Removido (incompatível)
- Seção **Visão de Sistema** (`/projects/:projectId/system-view` e a seção `system-view` do catálogo e dos
  planos): a Análise de Sistemas já cobre requisitos, histórias e diagramas. A migration 000012 continua no
  histórico e as tabelas dela (`system_specs`, `stakeholders`, `glossary_terms`, `use_cases`, `use_case_flows`,
  `use_case_relations`, `bdd_scenarios`) não são apagadas: nenhum dado é perdido no deploy.

### Adicionado
- Seção **Ontologias** (`/projects/:projectId/ontologies`, plano Master, qualquer tipo de projeto): catálogo com
  título, descrição, formato, IRI, versão, situação, contagens de classes, relacionamentos, propriedades e
  objetos, vocabulários (RDF, RDFS, OWL, Schema.org, RDFa, SKOS, Dublin Core, FOAF, PROV, DCAT, SHACL...),
  princípios (FAIR, CARE, 5 estrelas, TRUST), URL de publicação e de repositório, questões de competência e
  upload do arquivo (OWL, RDF/XML, OWL/XML, Turtle, N-Triples, N3, JSON-LD, OBO, RDFa...). O arquivo é lido na
  hora: formato, IRI, versão, vocabulários e contagens estimadas preenchem os campos vazios.
- Seção **BPM** (`/projects/:projectId/bpm`, planos Standard e Master): arquitetura de processos
  (macroprocesso → atividade, sem ciclos) com SIPOC, indicadores, problemas e melhorias, e diagramas AS IS / TO BE
  com upload de BPMN 2.0 (contagem de tarefas, eventos, gateways, pools e raias), imagem ou PDF.
- Seção **CommonKADS** (`/projects/:projectId/commonkads`, plano Master): as 17 planilhas (OM-1 a OM-5, TM-1,
  TM-2, AM-1, MAS, OTA-1, KM-1, CM-1, CM-2, DM-1 a DM-4) com situação, conteúdo com merge, cadastros de tarefas,
  conhecimento (com natureza, forma, disponibilidade e gargalos), agentes e transações, visão geral com lacunas
  entre os modelos e documento completo.
- Upload/download de arquivos (`shared/files.js`): corpo binário até 20 MB, nome em `X-File-Name`, conteúdo em
  tabela própria apagada em cascata. Erros 413 (grande demais) e 415 (não enviado como octet-stream).
- `crudRouter` aceita `afterDelete`; os vínculos jsonb do CommonKADS são limpos quando o registro citado é excluído.
- Migrations 000013 a 000015; rotas documentadas no OpenAPI (inclusive o corpo binário).

## 3.8.0 — 2026-10-13

### Adicionado
- `POST /projects/:projectId/system-view/import`: monta a Visão de Sistema a partir de um projeto da
  Análise de Sistemas — o próprio ou outro projeto `software` do usuário (o admin pode usar qualquer um).
  Copia análise, requisitos, histórias, diagramas e, se houver, a Visão de Sistema da origem, religando
  os vínculos (requisitos, generalização, histórias, cenários, `«include»`/`«extend»`). Gera um caso de
  uso por requisito funcional sem caso de uso (ator e cenário principal vindos da história vinculada) e
  stakeholders a partir dos papéis das histórias. Nada é sobrescrito; `dryRun: true` devolve a prévia.

## 3.7.0 — 2026-10-13

### Adicionado
- Seção **Visão de Sistema** (`/projects/:projectId/system-view`), extensão da Análise de Sistemas
  para projetos `software` nos planos Standard e Master. Base: a *Planilha de Análise* do projeto,
  a ISO/IEC/IEEE 29148 e o modelo de documentação de casos de uso de Guedes (*UML 2*, tab. 3.1).
  - Definições do software, stakeholders e glossário de domínio.
  - Casos de uso com ator principal e secundários, resumo, pré e pós-condições, restrições,
    generalização (sem ciclos), rastreabilidade com requisitos, cenários principal (um só),
    alternativos e de exceção (passos ator/sistema) e relações `«include»`/`«extend»`.
  - BDD: cenários Dado/Quando/Então, gerados a partir dos fluxos do caso de uso ou cadastrados à
    mão, e exportação Gherkin (`.feature` por história) em português, inglês ou espanhol.
  - Visão geral com lacunas de rastreabilidade e documento de especificação completo.
- Tipo de requisito `domain` (requisitos de domínio, RD) na Análise de Sistemas.
- Migration 000012; rotas documentadas no OpenAPI.

## 3.6.0 — 2026-10-12

### Adicionado
- Espanhol: o perfil aceita `locale: "es"` e as fases do CRISP-DM trazem o nome em `es`.

### Alterado
- Português (`pt-BR`) passa a ser o idioma padrão dos perfis novos (migration 000011);
  perfis existentes mantêm o idioma que têm.

## 3.5.0 — 2026-10-12

### Adicionado
- Seção **Kanban** (`/projects/:projectId/kanban`), em todos os planos e para qualquer tipo
  de projeto: quadro com colunas ordenadas (limite WIP opcional) e cartões com prioridade,
  prazo e responsável. `POST /columns/:id/move` e `POST /cards/:id/move` reordenam os
  vizinhos numa transação e devolvem o quadro atualizado.
- Migration 000010 (`kanban_columns`, `kanban_cards`); rotas na documentação OpenAPI.

## 3.4.0 — 2026-10-11

### Adicionado
- `DATABASE_URL` (formato dos painéis de hospedagem), com prioridade sobre as variáveis `DB_*`.
- `npm run db:check`: testa a conexão, mostra a versão do PostgreSQL e as migrations pendentes,
  com dicas para host não encontrado, porta fechada, senha e banco inexistente.
- `npm run db:tunnel`: abre um túnel SSH até o Postgres do EasyPanel sem expor a porta,
  localizando o contêiner sozinho (variáveis `SSH_HOST`, `SSH_USER`, `SSH_PORT`,
  `DB_CONTAINER`, `TUNNEL_PORT`).
- `Dockerfile` e `.dockerignore` para o deploy no painel da VPS; `npm run start:prod` aplica
  as migrations antes de subir a API.
- README: como acessar o banco da HostGator de fora (túnel SSH ou porta pública) e deploy com Docker.

### Corrigido
- `GET /admin/logs` passa a devolver `total`, como os demais endpoints paginados (necessário
  para a paginação do app).
- `GET /api/v1` respondia 404; agora devolve nome, versão e links de saúde e documentação,
  e a raiz `/` redireciona para ele.
- `birth_date` do perfil passa a ser criada pela migration 000009. Antes ela tinha sido incluída
  na 000004 já aplicada, então bancos existentes ficavam sem a coluna e `/profiles/me` falhava.

## 3.3.0 — 2026-10-11

### Adicionado
- Página de documentação em `/api/v1/docs/` (Swagger UI servido localmente, sem CDN) e
  especificação OpenAPI 3.1 em `/api/v1/docs/openapi.json`, gerada dos schemas Zod.
  Login/cadastro pelo *Try it out* autorizam a página automaticamente.
- Variável `DOCS_ENABLED` (padrão `true`).

### Alterado
- Schemas de endereços e de filtro de logs movidos para `*.schemas.js`.
- `storyPoints` validado com `z.literal` (aparece como enum na documentação).

### Corrigido
- `.gitignore` ignorava `src/modules/logs/` (a regra `logs/` valia para qualquer pasta), então
  o módulo de logs ficava fora do repositório e a API não iniciava a partir de um clone.

## 3.2.0 — 2026-10-11

Incorpora as funcionalidades da API legada (`api-konektron-node` v2, TypeScript/MySQL/Sequelize).

### Adicionado
- Seção **Análise de Sistemas** (`/projects/:projectId/system-analysis`, projetos `software`,
  todos os planos): análise (objetivo, escopo, descrição técnica), requisitos, histórias de
  usuário (com vínculo ao requisito) e diagramas (URL ou fonte Mermaid/PlantUML), visão geral
  e relatório com rastreabilidade. Substitui `/analysis`, `/requirements`, `/userStories` e
  `/diagrams` da API legada e as tabelas `*_have_*`.
- `POST /auth/change-password` (exige a senha atual; encerra as outras sessões e devolve tokens
  novos) — substitui `PUT /users/password/:userId`, que não exigia autenticação.
- `DELETE /auth/me` (exige a senha) — substitui `DELETE /users/delete/:userId`.
- `POST /auth/resend-verification`.
- `birthDate` no perfil (o `dateBirth` da API legada).
- Filtros de listagem no `crudRouter` (`filters`), ex.: `GET .../requirements?type=functional`.
- `GET /engineering/sections` informa `projectType` de cada seção.
- Seed de projeto de software de demonstração.

### Corrigido
- Colunas `date` deslocavam um dia ao serializar em UTC (`collectedAt`, `birthDate`).
- `X-Request-Id` longo/arbitrário quebrava a gravação no `audit_logs`; agora só é reaproveitado
  se tiver até 100 caracteres seguros.
- Contas excluídas mantinham o e-mail (coluna única), impedindo novo cadastro; agora os dados de
  login são anonimizados na exclusão.
- Falha de SMTP no cadastro/recuperação devolvia 500 depois de o usuário já ter sido criado;
  agora é registrada no log.
- Corpo de `POST /auth/logout` passa a ser validado.

## 3.1.0 — 2026-10-11

### Adicionado
- Módulo **CRISP-DM**: fases com conteúdo por tarefa (jsonb com merge), objetivos,
  datasets com dicionário de dados, passos de preparação, modelos e métricas,
  visão geral com progresso e relatório completo.
- Tipo de projeto (`software` | `data_analysis`); fases CRISP-DM criadas automaticamente.
- `crudRouter` genérico com escopo, validação e hooks.
- Conversão automática snake_case ↔ camelCase entre banco e API.
- Trigger `set_updated_at` no banco (dispensa atualizar `updated_at` no código).
- Request ID (`X-Request-Id`) nos logs e no `audit_logs`.
- Detecção de reuso de refresh token (revoga todas as sessões).
- Logout de todos os dispositivos (`allDevices: true`).
- Resumo do admin com usuários por plano e projetos por tipo.
- Testes com `node:test`, ESLint 9 (flat config), workflow de CI no GitHub Actions.
- Seed de projeto CRISP-DM de demonstração.

### Alterado
- Node 24 (`.nvmrc` 24.21.0): `process.loadEnvFile()` no lugar do `dotenv`,
  *subpath imports* (`#config/...`), import de JSON com `with { type: 'json' }`.
- Express 4 → 5: erros async tratados nativamente (removido `asyncHandler`).
- Zod 3 → 4 (`z.email()`, `z.uuid()`, `z.flattenError`).
- bcryptjs 3, nodemailer 7, express-rate-limit 8.
- `PUT /profiles/me` → `PATCH /profiles/me`; endereços com `PATCH` (atualização parcial).
- Login compara hash mesmo quando o e-mail não existe (evita enumeração por tempo de resposta).
- Bigint/numeric do Postgres retornam como `number`.
- Índice parcial garante um único endereço principal por usuário.
- Admin não pode excluir/desativar a própria conta nem mudar o próprio papel.

### Removido
- Dependência `dotenv` e `pgcrypto` (`gen_random_uuid()` é nativo no PostgreSQL 13+).
