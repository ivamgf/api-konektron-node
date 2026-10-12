import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import { PLAN_SECTIONS, PLANS, ROLES } from '#config/plans.js';
import * as auth from '#modules/auth/auth.schemas.js';
import { addressSchema } from '#modules/addresses/addresses.schemas.js';
import { updateProfileSchema } from '#modules/profiles/profiles.schemas.js';
import * as users from '#modules/users/users.schemas.js';
import * as logs from '#modules/logs/logs.schemas.js';
import * as projects from '#modules/projects/projects.schemas.js';
import * as sa from '#modules/system-analysis/systemAnalysis.schemas.js';
import * as dm from '#modules/crisp-dm/crispdm.schemas.js';
import * as kb from '#modules/kanban/kanban.schemas.js';
import { PHASES } from '#modules/crisp-dm/crispdm.constants.js';

// Especificação OpenAPI 3.1 gerada a partir dos schemas Zod usados na validação:
// corpos, filtros, limites e enums nunca divergem do código. Ao criar uma rota nova,
// registre-a aqui (o teste tests/openapi.test.js confere a estrutura do documento).

// ---------- Zod -> JSON Schema ----------
const SAFE_INT = Number.MAX_SAFE_INTEGER;

// Remove ruído do JSON Schema gerado: regex enormes quando já há `format` (email, uuid)
// e os limites de inteiro seguro que o Zod adiciona em todo .int()
function clean(node) {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema' || key === 'additionalProperties') continue;
    if (key === 'pattern' && node.format) continue;
    if ((key === 'minimum' || key === 'maximum') && Math.abs(value) >= SAFE_INT) continue;
    out[key] =
      key === 'properties'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]))
        : clean(value);
  }
  return out;
}

const toSchema = (schema, io = 'input') =>
  clean(z.toJSONSchema(schema, { io, unrepresentable: 'any' }));

// ---------- Blocos reutilizáveis ----------
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const arrayOf = (schema) => ({ type: 'array', items: schema });
const object = (properties, required) => ({ type: 'object', properties, ...(required && { required }) });
const counts = { type: 'object', additionalProperties: { type: 'integer' } };

const paginated = (item) =>
  object(
    { data: arrayOf(item), page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' } },
    ['data', 'page', 'pageSize'],
  );

// Registro do banco: campos do schema de criação + id e timestamps
function entity(schema, extra = {}) {
  const { properties } = toSchema(schema, 'output');
  return object(
    { id: uuid, ...extra, ...properties, createdAt: dateTime, updatedAt: dateTime },
    ['id', 'createdAt', 'updatedAt'],
  );
}

const ERRORS = {
  400: 'Requisição inválida (ex.: nenhum campo para atualizar)',
  401: 'Token ausente, inválido ou expirado (ou credenciais incorretas)',
  403: 'Sem permissão: papel insuficiente ou seção fora do plano',
  404: 'Recurso não encontrado (ou pertence a outro usuário)',
  409: 'Conflito: registro duplicado, em uso ou tipo de projeto incompatível',
  422: 'Dados inválidos; `details` traz os erros por campo',
  429: 'Muitas tentativas; aguarde e tente novamente',
};

const PATH_PARAMS = {
  id: 'ID do registro',
  projectId: 'ID do projeto',
  datasetId: 'ID do dataset',
  modelId: 'ID do modelo',
};

// ---------- Registro das operações ----------
const paths = {};

function add(method, path, o) {
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) =>
    name === 'phase'
      ? { name, in: 'path', required: true, schema: toSchema(dm.phaseParams).properties.phase }
      : { name, in: 'path', required: true, schema: uuid, description: PATH_PARAMS[name] },
  );

  const queryParams = o.query
    ? Object.entries(toSchema(o.query).properties).map(([name, schema]) => ({
        name,
        in: 'query',
        required: false,
        schema,
        ...(schema.description && { description: schema.description }),
      }))
    : [];

  // exemplo desatualizado quebra o build da especificação (e o teste), em vez de enganar o leitor
  if (o.example) o.body.parse(o.example);

  const isPublic = o.auth === false;
  const status = o.status ?? 200;
  const codes = new Set(o.errors ?? []);
  if (!isPublic) codes.add(401);
  if (o.body || o.query || pathParams.length) codes.add(422);
  if (pathParams.length) codes.add(404);

  paths[path] ??= {};
  paths[path][method] = {
    tags: [o.tag],
    summary: o.summary,
    ...(o.description && { description: o.description }),
    security: isPublic ? [] : [{ bearerAuth: [] }],
    ...(pathParams.length + queryParams.length && { parameters: [...pathParams, ...queryParams] }),
    ...(o.body && {
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: toSchema(o.body), ...(o.example && { example: o.example }) },
        },
      },
    }),
    responses: {
      [status]:
        status === 204
          ? { description: 'Sem conteúdo' }
          : { description: o.responseDescription ?? 'Sucesso', content: { 'application/json': { schema: o.response ?? {} } } },
      ...Object.fromEntries([...codes].sort().map((c) => [c, { $ref: `#/components/responses/E${c}` }])),
    },
  };
}

// GET/POST na coleção e GET/PATCH/DELETE no item, como o shared/crudRouter
function crud(base, { tag, name, label, plural, schema, updateSchema = schema.partial(), filters, example, errors = [] }) {
  const item = `${base}/{id}`;
  add('get', base, { tag, summary: `Listar ${plural}`, query: filters, errors, response: arrayOf(ref(name)) });
  add('post', base, {
    tag, summary: `Criar ${label}`, body: schema, example, status: 201, errors: [...errors, 409], response: ref(name),
  });
  add('get', item, { tag, summary: `Obter ${label}`, errors, response: ref(name) });
  add('patch', item, {
    tag,
    summary: `Atualizar ${label}`,
    description: 'Atualização parcial: envie só os campos que mudaram.',
    body: updateSchema,
    errors: [...errors, 400, 409],
    response: ref(name),
  });
  add('delete', item, { tag, summary: `Excluir ${label}`, status: 204, errors });
}

// ---------- Sistema ----------
add('get', '/', {
  tag: 'Sistema',
  auth: false,
  summary: 'Identificação da API',
  description: 'Nome, versão e os links de saúde e documentação. A raiz do servidor (`/`) redireciona para cá.',
  response: object({
    name: { type: 'string' },
    version: { type: 'string' },
    health: { type: 'string' },
    docs: { type: 'string' },
    openapi: { type: 'string' },
  }),
});
add('get', '/health', {
  tag: 'Sistema',
  auth: false,
  summary: 'Saúde da API e do banco',
  description: 'Responde 503 com `status: "degraded"` quando o banco está fora.',
  response: ref('Health'),
});

// ---------- Autenticação ----------
const T_AUTH = 'Autenticação';
add('post', '/auth/register', {
  tag: T_AUTH, auth: false, summary: 'Cadastrar usuário (RF1)', status: 201,
  description: 'Cria a conta, envia o e-mail de ativação e já devolve uma sessão (UC001).',
  body: auth.registerSchema, errors: [409, 429], response: ref('AuthResult'),
  example: { email: 'ana@exemplo.com', password: 'senhaSegura123', confirmPassword: 'senhaSegura123', acceptTerms: true },
});
add('post', '/auth/verify-email', {
  tag: T_AUTH, auth: false, summary: 'Confirmar e-mail',
  description: 'Recebe o token do link enviado por e-mail (válido por 48 h).',
  body: auth.tokenSchema, errors: [400], response: ref('Message'),
});
add('post', '/auth/login', {
  tag: T_AUTH, auth: false, summary: 'Entrar (RF2)', body: auth.loginSchema, errors: [429], response: ref('AuthResult'),
  example: { email: 'ana@exemplo.com', password: 'senhaSegura123' },
});
add('post', '/auth/refresh', {
  tag: T_AUTH, auth: false, summary: 'Renovar a sessão',
  description:
    'Troca o refresh token por um par novo (rotação). Reusar um refresh token já trocado ' +
    'encerra **todas** as sessões do usuário (proteção contra roubo de token).',
  body: auth.refreshSchema, response: ref('Tokens'),
});
add('post', '/auth/logout', {
  tag: T_AUTH, summary: 'Sair (RF7)',
  description: 'Revoga o `refreshToken` informado, ou todas as sessões com `allDevices: true`.',
  body: auth.logoutSchema, status: 204,
});
add('post', '/auth/forgot-password', {
  tag: T_AUTH, auth: false, summary: 'Pedir link de nova senha (RF4)',
  description: 'A resposta é sempre a mesma, para não revelar quais e-mails estão cadastrados. O link vale 1 h.',
  body: auth.forgotSchema, errors: [429], response: ref('Message'),
});
add('post', '/auth/reset-password', {
  tag: T_AUTH, auth: false, summary: 'Definir nova senha com o token do e-mail',
  description: 'Também encerra todas as sessões abertas.',
  body: auth.resetSchema, errors: [400, 429], response: ref('Message'),
});
add('get', '/auth/me', { tag: T_AUTH, summary: 'Usuário logado', response: ref('User') });
add('delete', '/auth/me', {
  tag: T_AUTH, summary: 'Excluir a própria conta',
  description: 'Exige a senha. Os dados de login são anonimizados e o e-mail fica livre para novo cadastro.',
  body: auth.deleteAccountSchema, status: 204, errors: [400, 429],
});
add('post', '/auth/change-password', {
  tag: T_AUTH, summary: 'Trocar a senha',
  description: 'Exige a senha atual. Encerra as outras sessões e devolve tokens novos para esta.',
  body: auth.changePasswordSchema, errors: [400, 429], response: ref('Tokens'),
  example: { currentPassword: 'senhaSegura123', password: 'novaSenha456', confirmPassword: 'novaSenha456' },
});
add('post', '/auth/resend-verification', {
  tag: T_AUTH, summary: 'Reenviar e-mail de ativação', errors: [429], response: ref('Message'),
});

// ---------- Conta ----------
add('get', '/profiles/me', { tag: 'Perfil', summary: 'Obter meu perfil (RF3)', response: ref('Profile') });
add('patch', '/profiles/me', {
  tag: 'Perfil', summary: 'Atualizar meu perfil (RF3)',
  description: '`socialNetworks`, quando enviado, substitui a lista inteira.',
  body: updateProfileSchema, response: ref('Profile'),
});
crud('/addresses', {
  tag: 'Endereços', name: 'Address', label: 'endereço', plural: 'meus endereços', schema: addressSchema,
});

// ---------- Administração ----------
const T_ADMIN = 'Administração';
const adminOnly = [403];
add('get', '/admin/users', {
  tag: T_ADMIN, summary: 'Listar usuários (RF5)', description: '`search` busca por parte do e-mail.',
  query: users.listQuery, errors: adminOnly, response: paginated(ref('AdminUser')),
});
add('get', '/admin/users/{id}', { tag: T_ADMIN, summary: 'Obter usuário', errors: adminOnly, response: ref('AdminUser') });
add('patch', '/admin/users/{id}', {
  tag: T_ADMIN, summary: 'Editar papel, plano ou status (RF5.1)',
  description: 'Desativar um usuário encerra as sessões dele. O admin não pode mudar o próprio papel nem se desativar.',
  body: users.adminUpdateSchema, errors: [...adminOnly, 400], response: ref('AdminUser'),
});
add('delete', '/admin/users/{id}', {
  tag: T_ADMIN, summary: 'Excluir usuário (RF5.2)', description: 'Soft delete com anonimização do login.',
  status: 204, errors: [...adminOnly, 400],
});
add('get', '/admin/logs', {
  tag: T_ADMIN, summary: 'Logs de acesso e operações (RF5)', query: logs.listQuery, errors: adminOnly,
  response: paginated(ref('AuditLog')),
});
add('get', '/admin/logs/summary', {
  tag: T_ADMIN, summary: 'Resumo para o dashboard (UC005)', errors: adminOnly, response: ref('AdminSummary'),
});

// ---------- Projetos e seções ----------
const T_PROJ = 'Projetos';
add('get', '/projects', {
  tag: T_PROJ, summary: 'Listar meus projetos', query: projects.listQuery, response: paginated(ref('Project')),
});
add('post', '/projects', {
  tag: T_PROJ, summary: 'Criar projeto', status: 201,
  description:
    '`software` (padrão) prepara a seção Análise de Sistemas; `data_analysis` cria as 6 fases do ' +
    'CRISP-DM e exige plano Standard ou Master.',
  body: projects.createProjectSchema, errors: [403], response: ref('Project'),
  example: { name: 'Sistema de Agendamento', type: 'software', description: 'Agenda web para clínicas.' },
});
add('get', '/projects/{projectId}', { tag: T_PROJ, summary: 'Obter projeto', response: ref('Project') });
add('patch', '/projects/{projectId}', {
  tag: T_PROJ, summary: 'Atualizar projeto', description: 'O tipo não muda depois de criado.',
  body: projects.updateProjectSchema, errors: [400], response: ref('Project'),
});
add('delete', '/projects/{projectId}', { tag: T_PROJ, summary: 'Excluir projeto (soft delete)', status: 204 });
add('get', '/engineering/sections', {
  tag: T_PROJ, summary: 'Catálogo de seções (RF6)',
  description:
    'Usado pelo front para montar o menu: indica se cada seção está no plano do usuário, se já ' +
    'existe na API e o tipo de projeto exigido. Seções não implementadas respondem **501** em ' +
    '`/engineering/{secao}`.',
  response: arrayOf(ref('Section')),
});

// ---------- Análise de Sistemas ----------
const T_SA = 'Análise de Sistemas';
const SA = '/projects/{projectId}/system-analysis';
const sectionErrors = [403, 409]; // plano sem a seção / projeto de outro tipo
add('get', SA, {
  tag: T_SA, summary: 'Visão geral', description: 'Dados da análise e contagens por tipo e status.',
  errors: sectionErrors, response: ref('SystemAnalysisOverview'),
});
add('get', `${SA}/report`, {
  tag: T_SA, summary: 'Relatório completo',
  description: 'Documento inteiro do projeto. Cada requisito traz os códigos das histórias que o refinam.',
  errors: sectionErrors, response: ref('SystemAnalysisReport'),
});
add('get', `${SA}/analysis`, { tag: T_SA, summary: 'Obter a análise', errors: sectionErrors, response: ref('SystemAnalysis') });
add('patch', `${SA}/analysis`, {
  tag: T_SA, summary: 'Atualizar a análise', body: sa.analysisUpdateSchema, errors: [...sectionErrors, 400],
  response: ref('SystemAnalysis'),
  example: {
    goal: 'Permitir que clientes agendem atendimentos sem ligar para a recepção.',
    scope: 'Agenda web e notificações por e-mail. Pagamentos ficam fora do escopo.',
  },
});
crud(`${SA}/requirements`, {
  tag: T_SA, name: 'Requirement', label: 'requisito', plural: 'requisitos',
  schema: sa.requirementSchema, filters: sa.requirementFilters, errors: sectionErrors,
  example: {
    code: 'RF1', title: 'Agendar atendimento', type: 'functional', priority: 'must',
    description: 'O cliente escolhe serviço, data e horário disponíveis.',
  },
});
crud(`${SA}/user-stories`, {
  tag: T_SA, name: 'UserStory', label: 'história de usuário', plural: 'histórias de usuário',
  schema: sa.userStorySchema, filters: sa.userStoryFilters, errors: sectionErrors,
  example: {
    code: 'US1', title: 'Agendar pelo celular', asA: 'cliente', iWant: 'reservar um horário pelo celular',
    soThat: 'eu não precise ligar para a recepção', storyPoints: 5, priority: 'must',
    acceptanceCriteria: 'Dado um horário livre, quando confirmo, recebo um e-mail com o resumo.',
  },
});
crud(`${SA}/diagrams`, {
  tag: T_SA, name: 'Diagram', label: 'diagrama', plural: 'diagramas',
  schema: sa.diagramSchema, filters: sa.diagramFilters, errors: sectionErrors,
  example: {
    title: 'Casos de uso — Agendamento', type: 'use_case', notation: 'mermaid',
    source: 'flowchart LR\n  Cliente --> A[Agendar atendimento]\n  Cliente --> B[Cancelar agendamento]',
  },
});

// ---------- CRISP-DM ----------
const T_DM = 'CRISP-DM';
const DM = '/projects/{projectId}/crisp-dm';
const phaseTasks = PHASES.map((p) => `| \`${p.key}\` | ${p.tasks.map((t) => `\`${t}\``).join(', ')} |`).join('\n');
add('get', DM, {
  tag: T_DM, summary: 'Visão geral', description: 'Progresso, fase atual e contagens.',
  errors: sectionErrors, response: ref('CrispDmOverview'),
});
add('get', `${DM}/report`, {
  tag: T_DM, summary: 'Relatório completo', description: 'Fases, objetivos, datasets com campos e modelos com métricas.',
  errors: sectionErrors, response: { type: 'object' },
});
add('get', `${DM}/phases`, { tag: T_DM, summary: 'Listar as 6 fases', errors: sectionErrors, response: arrayOf(ref('CrispDmPhase')) });
add('get', `${DM}/phases/{phase}`, { tag: T_DM, summary: 'Obter fase', errors: sectionErrors, response: ref('CrispDmPhase') });
add('patch', `${DM}/phases/{phase}`, {
  tag: T_DM, summary: 'Atualizar fase',
  description:
    '`content` faz *merge*: envie só as tarefas que mudaram. Mudar `status` preenche ' +
    '`startedAt`/`completedAt`. Tarefas aceitas por fase (guia CRISP-DM 1.0):\n\n' +
    `| Fase | Tarefas em \`content\` |\n|---|---|\n${phaseTasks}\n\n` +
    'Na fase `evaluation`, `decision` aceita `deploy`, `iterate`, `new_project` ou `stop`.',
  body: dm.phaseUpdateSchema, errors: [...sectionErrors, 400], response: ref('CrispDmPhase'),
  example: { status: 'completed', content: { assessmentOfResults: 'Recall 0.81 no teste', decision: 'deploy' } },
});
crud(`${DM}/objectives`, {
  tag: T_DM, name: 'CrispDmObjective', label: 'objetivo', plural: 'objetivos (Business Understanding)',
  schema: dm.objectiveSchema, errors: sectionErrors,
  example: {
    type: 'data_mining', description: 'Classificar clientes com risco de churn em 30 dias',
    successCriteria: 'Recall >= 0.75 no conjunto de teste', priority: 1,
  },
});
crud(`${DM}/datasets`, {
  tag: T_DM, name: 'CrispDmDataset', label: 'dataset', plural: 'datasets (Data Understanding)',
  schema: dm.datasetSchema, errors: sectionErrors,
  example: { name: 'clientes_2025', source: 'CRM', format: 'csv', rowCount: 48000, collectedAt: '2026-01-31' },
});
crud(`${DM}/datasets/{datasetId}/fields`, {
  tag: T_DM, name: 'CrispDmDatasetField', label: 'campo do dataset', plural: 'campos do dataset (dicionário de dados)',
  schema: dm.datasetFieldSchema, errors: sectionErrors,
});
crud(`${DM}/preparation-steps`, {
  tag: T_DM, name: 'CrispDmPreparationStep', label: 'passo de preparação', plural: 'passos de preparação (Data Preparation)',
  schema: dm.preparationStepSchema, errors: sectionErrors,
});
crud(`${DM}/models`, {
  tag: T_DM, name: 'CrispDmModel', label: 'modelo', plural: 'modelos (Modeling)',
  schema: dm.modelSchema, errors: sectionErrors,
  example: {
    name: 'rf-churn-v1', technique: 'classification', algorithm: 'RandomForest',
    hyperparameters: { n_estimators: 300, max_depth: 12 },
  },
});
crud(`${DM}/models/{modelId}/metrics`, {
  tag: T_DM, name: 'CrispDmModelMetric', label: 'métrica', plural: 'métricas do modelo (Evaluation)',
  schema: dm.modelMetricSchema, errors: sectionErrors,
  example: { metric: 'recall', value: 0.81, split: 'test' },
});

// ---------- Kanban ----------
const T_KB = 'Kanban';
const KB = '/projects/{projectId}/kanban';
add('get', KB, {
  tag: T_KB, summary: 'Quadro completo', description: 'Colunas em ordem, cada uma com seus cartões em ordem.',
  errors: [403], response: ref('KanbanBoard'),
});
crud(`${KB}/columns`, {
  tag: T_KB, name: 'KanbanColumn', label: 'coluna', plural: 'colunas',
  schema: kb.columnSchema, errors: [403],
  example: { name: 'Em andamento', wipLimit: 3 },
});
add('post', `${KB}/columns/{id}/move`, {
  tag: T_KB, summary: 'Mover coluna', description: 'Reordena as colunas do quadro e devolve o quadro atualizado.',
  body: kb.moveColumnSchema, errors: [403], response: ref('KanbanBoard'), example: { position: 0 },
});
crud(`${KB}/cards`, {
  tag: T_KB, name: 'KanbanCard', label: 'cartão', plural: 'cartões',
  schema: kb.cardSchema, updateSchema: kb.cardUpdateSchema, filters: kb.cardFilters, errors: [403],
  example: {
    columnId: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e', title: 'Tela de agendamento', priority: 'high',
    dueDate: '2026-11-30', assignee: 'Ana',
  },
});
add('post', `${KB}/cards/{id}/move`, {
  tag: T_KB, summary: 'Mover cartão',
  description: 'Muda o cartão de coluna e/ou posição, reordenando os vizinhos. Devolve o quadro atualizado.',
  body: kb.moveCardSchema, errors: [403], response: ref('KanbanBoard'),
  example: { columnId: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e', position: 0 },
});

// ---------- Schemas de resposta ----------
const tokens = { accessToken: { type: 'string' }, refreshToken: { type: 'string' } };
const user = object(
  {
    id: uuid,
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: Object.values(ROLES) },
    plan: { type: 'string', enum: Object.values(PLANS) },
    emailVerified: { type: 'boolean' },
  },
  ['id', 'email', 'role', 'plan', 'emailVerified'],
);
const { emailVerified: _emailVerified, ...adminUserBase } = user.properties;
const profile = toSchema(updateProfileSchema, 'output');
const analysis = object({ ...toSchema(sa.analysisUpdateSchema, 'output').properties, updatedAt: nullable(dateTime) });
const phase = object({
  id: uuid,
  projectId: uuid,
  phase: toSchema(dm.phaseParams).properties.phase,
  status: toSchema(dm.phaseUpdateSchema).properties.status,
  content: { type: 'object', description: 'Saídas das tarefas da fase (ver PATCH)' },
  notes: nullable({ type: 'string' }),
  startedAt: nullable(dateTime),
  completedAt: nullable(dateTime),
  order: { type: 'integer' },
  label: { type: 'object', properties: { en: { type: 'string' }, 'pt-BR': { type: 'string' } } },
  tasks: arrayOf({ type: 'string' }),
});

const schemas = {
  Error: object(
    {
      error: { type: 'string' },
      details: { description: 'Erros por campo (422) ou contexto adicional' },
      requestId: { type: 'string', description: 'Presente em erros 500; informe ao suporte' },
    },
    ['error'],
  ),
  Message: object({ message: { type: 'string' } }, ['message']),
  Health: object({
    status: { type: 'string', enum: ['ok', 'degraded'] },
    db: { type: 'string', enum: ['up', 'down'] },
    version: { type: 'string' },
    uptime: { type: 'integer', description: 'segundos' },
    node: { type: 'string' },
  }),
  Tokens: object(tokens, ['accessToken', 'refreshToken']),
  User: user,
  AuthResult: object({ user: ref('User'), ...tokens }, ['user', 'accessToken', 'refreshToken']),
  Profile: object({
    ...profile.properties,
    socialNetworks: arrayOf(object({ id: uuid, network: { type: 'string' }, url: { type: 'string', format: 'uri' } })),
  }),
  Address: entity(addressSchema, { userId: uuid }),
  AdminUser: object({
    ...adminUserBase,
    isActive: { type: 'boolean' },
    emailVerifiedAt: nullable(dateTime),
    lastLoginAt: nullable(dateTime),
    createdAt: dateTime,
  }),
  AuditLog: object({
    id: { type: 'integer' },
    userId: nullable(uuid),
    email: nullable({ type: 'string' }),
    action: { type: 'string' },
    description: nullable({ type: 'string' }),
    ip: nullable({ type: 'string' }),
    userAgent: nullable({ type: 'string' }),
    requestId: nullable({ type: 'string' }),
    createdAt: dateTime,
  }),
  AdminSummary: object({
    totalUsers: { type: 'integer' },
    usersByPlan: arrayOf(object({ plan: { type: 'string' }, total: { type: 'integer' } })),
    projectsByType: arrayOf(object({ type: { type: 'string' }, total: { type: 'integer' } })),
    loginsLast30Days: arrayOf(object({ day: { type: 'string', format: 'date' }, total: { type: 'integer' } })),
  }),
  Project: entity(projects.createProjectSchema, { ownerId: uuid, deletedAt: nullable(dateTime) }),
  Section: object({
    key: { type: 'string' },
    enabled: { type: 'boolean', description: 'Incluída no plano do usuário' },
    implemented: { type: 'boolean' },
    projectType: nullable({ type: 'string' }),
    route: nullable({ type: 'string' }),
  }),
  SystemAnalysis: analysis,
  SystemAnalysisOverview: object({
    project: object({ id: uuid, name: { type: 'string' }, version: { type: 'string' } }),
    analysis: ref('SystemAnalysis'),
    counts: object({
      requirements: object({ total: { type: 'integer' }, byType: counts, byStatus: counts }),
      userStories: object({ total: { type: 'integer' }, byStatus: counts }),
      diagrams: object({ total: { type: 'integer' }, byType: counts }),
    }),
  }),
  SystemAnalysisReport: object({
    generatedAt: dateTime,
    project: ref('Project'),
    analysis: ref('SystemAnalysis'),
    requirements: arrayOf({
      allOf: [ref('Requirement'), object({ userStories: arrayOf({ type: 'string', description: 'códigos' }) })],
    }),
    userStories: arrayOf(ref('UserStory')),
    diagrams: arrayOf(ref('Diagram')),
  }),
  Requirement: entity(sa.requirementSchema, { projectId: uuid }),
  UserStory: entity(sa.userStorySchema, { projectId: uuid }),
  Diagram: entity(sa.diagramSchema, { projectId: uuid }),
  CrispDmOverview: object({
    project: object({ id: uuid, name: { type: 'string' }, version: { type: 'string' } }),
    progress: { type: 'integer', description: '% de fases concluídas' },
    currentPhase: nullable({ type: 'string' }),
    phases: arrayOf({ type: 'object' }),
    counts,
  }),
  CrispDmPhase: phase,
  CrispDmObjective: entity(dm.objectiveSchema, { projectId: uuid }),
  CrispDmDataset: entity(dm.datasetSchema, { projectId: uuid }),
  CrispDmDatasetField: entity(dm.datasetFieldSchema, { datasetId: uuid }),
  CrispDmPreparationStep: entity(dm.preparationStepSchema, { projectId: uuid }),
  CrispDmModel: entity(dm.modelSchema, { projectId: uuid }),
  CrispDmModelMetric: entity(dm.modelMetricSchema, { modelId: uuid }),
  KanbanColumn: entity(kb.columnSchema, { projectId: uuid, position: { type: 'integer' } }),
  KanbanCard: entity(kb.cardSchema, { projectId: uuid, position: { type: 'integer' } }),
  KanbanBoard: object({
    columns: arrayOf({ allOf: [ref('KanbanColumn'), object({ cards: arrayOf(ref('KanbanCard')) })] }),
  }),
};

// ---------- Documento ----------
const planTable = Object.entries(PLAN_SECTIONS)
  .map(([plan, sections]) => `| ${plan} | ${sections.join(', ')} |`)
  .join('\n');

const description = `
API do KonekTron: engenharia de software e análise de dados.

## Autenticação
1. \`POST /auth/register\` ou \`POST /auth/login\` devolvem \`accessToken\` (JWT, 15 min) e \`refreshToken\` (30 dias).
2. Envie \`Authorization: Bearer <accessToken>\` nas rotas protegidas (botão **Authorize**).
   Nesta página, um login ou cadastro feito em *Try it out* já preenche o token.
3. Quando o access token expirar (401), troque o refresh token em \`POST /auth/refresh\`.

## Convenções
- JSON em \`camelCase\`; datas em ISO 8601 (campos só de data como \`YYYY-MM-DD\`).
- \`PATCH\` é parcial. Listagens administrativas e de projetos são paginadas (\`page\`, \`pageSize\` ≤ 100).
- Erros seguem \`{ "error": "...", "details": {...} }\`. Em 422, \`details\` traz os erros por campo.
- Toda resposta tem o cabeçalho \`X-Request-Id\` (o mesmo valor aparece nos logs).
- Cadastro, login e rotas de senha têm limite de 20 tentativas a cada 15 min por IP.

## Planos e seções
| Plano | Seções |
|---|---|
${planTable}

Administradores acessam todas as seções.
`.trim();

let cached;

export function buildOpenApi() {
  cached ??= {
    openapi: '3.1.0',
    info: { title: 'KonekTron API', version: pkg.version, description },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'Sistema' },
      { name: T_AUTH, description: 'Cadastro, sessão e senha (RF1, RF2, RF4, RF7)' },
      { name: 'Perfil', description: 'Dados do usuário logado (RF3)' },
      { name: 'Endereços', description: 'Endereços do usuário logado' },
      { name: T_ADMIN, description: 'Somente para o papel `admin` (RF5)' },
      { name: T_PROJ, description: 'Projetos `software` ou `data_analysis` e catálogo de seções' },
      { name: T_SA, description: 'Requisitos, histórias de usuário e diagramas. Projetos `software`, todos os planos.' },
      { name: T_DM, description: 'Metodologia CRISP-DM. Projetos `data_analysis`, planos Standard e Master.' },
      { name: T_KB, description: 'Quadro de tarefas com colunas e cartões. Qualquer tipo de projeto, todos os planos.' },
    ],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
      responses: Object.fromEntries(
        Object.entries(ERRORS).map(([code, text]) => [
          `E${code}`,
          { description: text, content: { 'application/json': { schema: ref('Error') } } },
        ]),
      ),
    },
  };
  return cached;
}
