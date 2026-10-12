# Changelog

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
