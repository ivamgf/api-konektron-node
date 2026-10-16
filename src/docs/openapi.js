import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import { PLANS, ROLES } from '#config/plans.js';
import * as auth from '#modules/auth/auth.schemas.js';
import { addressSchema } from '#modules/addresses/addresses.schemas.js';
import { updateProfileSchema } from '#modules/profiles/profiles.schemas.js';
import * as users from '#modules/users/users.schemas.js';
import * as logs from '#modules/logs/logs.schemas.js';
import * as projects from '#modules/projects/projects.schemas.js';
import * as sa from '#modules/system-analysis/systemAnalysis.schemas.js';
import * as dm from '#modules/crisp-dm/crispdm.schemas.js';
import * as kb from '#modules/kanban/kanban.schemas.js';
import * as on from '#modules/ontologies/ontologies.schemas.js';
import * as bpm from '#modules/bpm/bpm.schemas.js';
import * as ck from '#modules/commonkads/commonkads.schemas.js';
import { PHASES } from '#modules/crisp-dm/crispdm.constants.js';
import { FILE_EXTENSIONS as ONTOLOGY_FILES } from '#modules/ontologies/ontologies.constants.js';
import { FILE_EXTENSIONS as BPM_FILES } from '#modules/bpm/bpm.constants.js';
import { WORKSHEETS } from '#modules/commonkads/commonkads.constants.js';
import { MAX_FILE_BYTES } from '#shared/files.js';
import * as ct from '#modules/contact/contact.schemas.js';
import * as fp from '#modules/function-points/fp.schemas.js';
import { WEIGHTS } from '#modules/function-points/fp.rules.js';
import * as sc from '#modules/scrum/scrum.schemas.js';

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
  403: 'Sem permissão: área exclusiva do administrador Master',
  404: 'Recurso não encontrado (ou pertence a outro usuário)',
  409: 'Conflito: registro duplicado, em uso ou tipo de projeto incompatível',
  413: 'Arquivo maior que o limite',
  415: 'O arquivo deve ser enviado como application/octet-stream',
  422: 'Dados inválidos; `details` traz os erros por campo',
  429: 'Muitas tentativas; aguarde e tente novamente',
  502: 'O servidor de e-mail (SMTP) recusou o envio',
  503: 'Envio de e-mail não configurado (sem SMTP_HOST)',
};

const PATH_PARAMS = {
  id: 'ID do registro',
  projectId: 'ID do projeto',
  datasetId: 'ID do dataset',
  modelId: 'ID do modelo',
  countId: 'ID da contagem de pontos de função',
};

// Parâmetros de rota que não são uuid
const ENUM_PARAMS = {
  phase: () => toSchema(dm.phaseParams).properties.phase,
  key: () => toSchema(ck.worksheetParams).properties.key,
};

// ---------- Registro das operações ----------
const paths = {};

function add(method, path, o) {
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) =>
    ENUM_PARAMS[name]
      ? { name, in: 'path', required: true, schema: ENUM_PARAMS[name]() }
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

  // upload de arquivo: corpo binário e o nome no cabeçalho X-File-Name
  const headerParams = o.upload
    ? [{ name: 'X-File-Name', in: 'header', required: true, schema: { type: 'string' }, description: 'Nome do arquivo (encodeURIComponent)' }]
    : [];
  const binary = { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } };

  const isPublic = o.auth === false;
  const status = o.status ?? 200;
  const codes = new Set(o.errors ?? []);
  if (!isPublic) codes.add(401);
  if (o.body || o.upload || o.query || pathParams.length) codes.add(422);
  if (pathParams.length) codes.add(404);

  paths[path] ??= {};
  paths[path][method] = {
    tags: [o.tag],
    summary: o.summary,
    ...(o.description && { description: o.description }),
    security: isPublic ? [] : [{ bearerAuth: [] }],
    ...(pathParams.length + queryParams.length + headerParams.length && {
      parameters: [...pathParams, ...queryParams, ...headerParams],
    }),
    ...(o.upload && { requestBody: { required: true, description: o.upload, content: binary } }),
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
          : {
              description: o.responseDescription ?? 'Sucesso',
              content: o.binary ? binary : { 'application/json': { schema: o.response ?? {} } },
            },
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

// PUT/GET/DELETE {item}/file, como o shared/files.js
function fileOps(item, { tag, name, label, extensions, analysis, errors = [] }) {
  const mb = MAX_FILE_BYTES / 1024 / 1024;
  const accepted = extensions.map((e) => `\`.${e}\``).join(', ');
  add('put', `${item}/file`, {
    tag,
    summary: `Enviar o arquivo do(a) ${label}`,
    description:
      `Corpo = o arquivo bruto (\`Content-Type: application/octet-stream\`), até ${mb} MB; o nome vai no cabeçalho ` +
      `\`X-File-Name\`. Extensões aceitas: ${accepted}. Substitui o arquivo anterior. ${analysis}`,
    upload: 'Conteúdo do arquivo',
    errors: [...errors, 413, 415],
    response: { allOf: [ref(name), object({ analysis: { description: 'Leitura do arquivo (ou null)' } })] },
  });
  add('get', `${item}/file`, {
    tag, summary: `Baixar o arquivo do(a) ${label}`, errors, binary: true,
    description: 'Devolve o arquivo com o tipo e o nome originais (Content-Disposition).',
  });
  add('delete', `${item}/file`, { tag, summary: `Remover o arquivo do(a) ${label}`, status: 204, errors });
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
  tag: T_ADMIN, summary: 'Editar perfil (papel e plano) ou status (RF5.1)',
  description:
    'Todo cadastro novo é `client`/`free`; o administrador muda o perfil por aqui. O plano novo vale na próxima renovação ' +
    'do token. Quem perde a administração (deixa de ser `admin` com plano `master`) ou é desativado tem as sessões ' +
    'encerradas. O administrador não pode mudar o próprio perfil nem se desativar.',
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
    'CRISP-DM.',
  body: projects.createProjectSchema, response: ref('Project'),
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
    'Usado pelo front para montar o menu: indica se cada seção está liberada (todas, em qualquer plano), se já ' +
    'existe na API e o tipo de projeto exigido. Seções não implementadas respondem **501** em ' +
    '`/engineering/{secao}`.',
  response: arrayOf(ref('Section')),
});

// ---------- Análise de Sistemas ----------
const T_SA = 'Análise de Sistemas';
const SA = '/projects/{projectId}/system-analysis';
const sectionErrors = [409]; // projeto de outro tipo
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

// ---------- Ontologias ----------
const T_ON = 'Ontologias';
const ON = '/projects/{projectId}/ontologies';
const anySection = []; // seções para qualquer tipo de projeto
add('get', `${ON}/summary`, {
  tag: T_ON, summary: 'Resumo do catálogo',
  description: 'Totais de ontologias, publicadas, com arquivo, soma das contagens e uso de formatos, vocabulários e princípios.',
  errors: anySection, response: ref('OntologySummary'),
});
crud(ON, {
  tag: T_ON, name: 'Ontology', label: 'ontologia', plural: 'ontologias',
  schema: on.ontologySchema, filters: on.ontologyFilters, errors: anySection,
  example: {
    title: 'Ontologia de Agendamento', format: 'rdf_xml', iri: 'https://exemplo.com/onto/agenda', version: '1.0',
    status: 'published', classCount: 42, relationshipCount: 18, propertyCount: 25, objectCount: 120,
    vocabularies: ['owl', 'rdfs', 'schema', 'skos', 'dublin_core'], principles: ['fair'],
    publicationUrl: 'https://exemplo.com/onto/agenda.owl',
  },
});
fileOps(`${ON}/{id}`, {
  tag: T_ON, name: 'Ontology', label: 'ontologia', extensions: ONTOLOGY_FILES, errors: anySection,
  analysis:
    'O arquivo é lido na hora: formato, IRI, versão, vocabulários (pelos namespaces) e contagens estimadas de classes, ' +
    'relacionamentos (propriedades de objeto), propriedades (de dados) e objetos (indivíduos). Só os campos vazios são ' +
    'preenchidos; a análise completa volta em `analysis` e fica guardada no registro.',
});

// ---------- BPM ----------
const T_BPM = 'BPM';
const BPM = '/projects/{projectId}/bpm';
add('get', BPM, {
  tag: T_BPM, summary: 'Visão geral',
  description: 'Processos para montar a arquitetura (árvore por `parentId`), contagens por nível, situação e diagramas, e se o SIPOC de cada processo está completo.',
  errors: anySection, response: ref('BpmOverview'),
});
crud(`${BPM}/processes`, {
  tag: T_BPM, name: 'BpmProcess', label: 'processo', plural: 'processos',
  schema: bpm.processSchema, filters: bpm.processFilters, errors: anySection,
  example: {
    code: 'P1', name: 'Agendar atendimento', level: 'process', owner: 'Recepção',
    suppliers: 'Cliente', inputs: 'Pedido de horário', steps: 'Receber pedido\nVerificar agenda\nConfirmar horário',
    outputs: 'Horário confirmado', customers: 'Cliente',
  },
});
crud(`${BPM}/diagrams`, {
  tag: T_BPM, name: 'BpmDiagram', label: 'diagrama', plural: 'diagramas',
  schema: bpm.diagramSchema, filters: bpm.diagramFilters, errors: anySection,
  example: { title: 'Agendamento — AS IS', state: 'as_is', tool: 'Camunda Modeler', version: '1' },
});
fileOps(`${BPM}/diagrams/{id}`, {
  tag: T_BPM, name: 'BpmDiagram', label: 'diagrama', extensions: BPM_FILES, errors: anySection,
  analysis:
    'Arquivos BPMN 2.0 (`.bpmn`/`.xml`) são lidos: contagem de tarefas, eventos, gateways, fluxos, pools e raias, ' +
    'e os nomes de processos, participantes e tarefas vão para `metrics`. Imagens e PDF são só guardados.',
});

// ---------- CommonKADS ----------
const T_CK = 'CommonKADS';
const CK = '/projects/{projectId}/commonkads';
const worksheetTable = WORKSHEETS.map(
  (w) => `| \`${w.key}\` | ${w.fields ? w.fields.map((f) => `\`${f}\``).join(', ') : `cadastro \`/${w.resource}\``} |`,
).join('\n');
add('get', CK, {
  tag: T_CK, summary: 'Visão geral',
  description: 'Progresso (planilhas concluídas), situação de cada planilha, contagens e lacunas entre os modelos (tarefas sem agente, conhecimento sem uso...).',
  errors: anySection, response: ref('CommonKadsOverview'),
});
add('get', `${CK}/report`, {
  tag: T_CK, summary: 'Documento completo',
  description: 'Todas as planilhas e cadastros, com as relações resolvidas nos dois sentidos (ex.: conhecimento → agentes que o possuem e tarefas que o usam).',
  errors: anySection, response: { type: 'object' },
});
add('get', `${CK}/worksheets`, {
  tag: T_CK, summary: 'Listar as 17 planilhas', errors: anySection, response: arrayOf(ref('CommonKadsWorksheet')),
});
add('get', `${CK}/worksheets/{key}`, { tag: T_CK, summary: 'Obter planilha', errors: anySection, response: ref('CommonKadsWorksheet') });
add('patch', `${CK}/worksheets/{key}`, {
  tag: T_CK, summary: 'Atualizar planilha',
  description:
    '`content` faz *merge*: envie só os campos que mudaram (`null` apaga). As planilhas em linhas (OM-3, OM-4, TM-1, ' +
    'TM-2, AM-1, MAS, CM-1, CM-2) aceitam só `status` e `notes`; o conteúdo delas vem dos cadastros.\n\n' +
    `| Planilha | Campos de \`content\` |\n|---|---|\n${worksheetTable}`,
  body: ck.worksheetUpdateSchema, errors: [...anySection, 400], response: ref('CommonKadsWorksheet'),
  example: { status: 'in_progress', content: { problemsOpportunities: 'Diagnósticos dependem de poucos especialistas.' } },
});
crud(`${CK}/tasks`, {
  tag: T_CK, name: 'CkTask', label: 'tarefa (OM-3/TM-1)', plural: 'tarefas (OM-3/TM-1)',
  schema: ck.taskSchema, errors: anySection,
  example: { code: 'T1', name: 'Diagnosticar falha', location: 'Suporte técnico', knowledgeIntensive: true, significance: 5 },
});
crud(`${CK}/knowledge`, {
  tag: T_CK, name: 'CkKnowledge', label: 'item de conhecimento (OM-4/TM-2)', plural: 'itens de conhecimento (OM-4/TM-2)',
  schema: ck.knowledgeSchema, errors: anySection,
  example: {
    name: 'Regras de diagnóstico', domain: 'Manutenção de equipamentos', rightForm: false, rightFormNotes: 'Só na cabeça dos técnicos',
    characterization: { nature: { heuristic: { applies: true, bottleneck: true } }, form: { mind: { applies: true } } },
  },
});
crud(`${CK}/agents`, {
  tag: T_CK, name: 'CkAgent', label: 'agente (AM-1/MAS)', plural: 'agentes (AM-1/MAS)',
  schema: ck.agentSchema, errors: anySection,
  example: { name: 'Técnico de suporte', kind: 'human', responsibilities: 'Fecha o diagnóstico; não autoriza troca de peças.' },
});
crud(`${CK}/transactions`, {
  tag: T_CK, name: 'CkTransaction', label: 'transação (CM-1/CM-2)', plural: 'transações (CM-1/CM-2)',
  schema: ck.transactionSchema, errors: anySection,
  example: {
    code: 'TR1', name: 'Informar diagnóstico', informationObject: 'Diagnóstico',
    informationItems: [{ name: 'Diagnóstico', role: 'core', form: 'texto', medium: 'janela' }],
    messages: [{ type: 'report', content: 'Diagnóstico concluído' }],
  },
});

// ---------- Contato ----------
const T_CT = 'Contato';
add('post', '/contact', {
  tag: T_CT, auth: false, summary: 'Enviar mensagem pelo formulário de contato', status: 201,
  description:
    'Pública (com token, a mensagem fica ligada ao usuário). Guarda a mensagem e a envia para `CONTACT_EMAIL`, ' +
    'com resposta para o e-mail informado. Limite de 5 mensagens a cada 15 min por IP. O campo `website` é uma ' +
    'armadilha para robôs: se vier preenchido, a resposta é 202 e nada é gravado.',
  body: ct.contactSchema, errors: [429], response: object({ id: uuid, createdAt: dateTime, message: { type: 'string' } }),
  example: { name: 'Ana Souza', email: 'ana@exemplo.com', subject: 'Plano Master', message: 'Gostaria de saber mais sobre o plano Master.' },
});
add('get', '/admin/contact-messages', {
  tag: T_CT, summary: 'Mensagens de contato (admin)', query: ct.contactListQuery, errors: [403],
  response: { allOf: [paginated(ref('ContactMessage')), object({ byStatus: counts })] },
});
add('patch', '/admin/contact-messages/{id}', {
  tag: T_CT, summary: 'Mudar a situação da mensagem (admin)', body: ct.contactUpdateSchema, errors: [403],
  response: ref('ContactMessage'), example: { status: 'answered' },
});
add('post', '/admin/contact-messages/{id}/reply', {
  tag: T_CT, summary: 'Responder por e-mail (admin)',
  description:
    'Envia a resposta ao e-mail do remetente pelo SMTP do sistema (`MAIL_FROM`, com resposta para `CONTACT_EMAIL`), ' +
    'citando a mensagem original. Se o envio der certo, grava `reply`, `repliedAt` e `repliedBy` e marca como ' +
    '`answered`. **502** quando o servidor de e-mail recusa (ex.: senha do SMTP errada); **503** sem `SMTP_HOST`.',
  body: ct.contactReplySchema, errors: [403, 502, 503], response: ref('ContactMessage'),
  example: { message: 'Olá, Ana! Todas as seções estão liberadas no plano Free.' },
});
add('delete', '/admin/contact-messages/{id}', { tag: T_CT, summary: 'Excluir mensagem (admin)', status: 204, errors: [403] });

// ---------- Pontos de Função ----------
const T_FP = 'Pontos de Função';
const FP = '/projects/{projectId}/function-points';
const weightTable = Object.entries(WEIGHTS)
  .map(([type, w]) => `| \`${type}\` | ${w.low} | ${w.average} | ${w.high} |`)
  .join('\n');
add('get', FP, {
  tag: T_FP, summary: 'Contagens com o total de PF', errors: sectionErrors, response: arrayOf(ref('FpCount')),
});
crud(`${FP}/counts`, {
  tag: T_FP, name: 'FpCount', label: 'contagem', plural: 'contagens', schema: fp.countSchema, errors: sectionErrors,
  example: { name: 'Contagem inicial', countType: 'development', hoursPerFp: 8, costPerHour: 120, currency: 'BRL' },
});
add('get', `${FP}/counts/{id}/summary`, {
  tag: T_FP, summary: 'Resumo da contagem',
  description:
    'Determinação do escopo (ALI/AIE), totais de TD e TR, contribuição por tipo e complexidade, total de PF e, com ' +
    'produtividade e custo informados, a estimativa de esforço e custo. Contribuição (IFPUG):\n\n' +
    `| Tipo | Baixa | Média | Alta |\n|---|---|---|---|\n${weightTable}`,
  errors: sectionErrors, response: ref('FpSummary'),
});
crud(`${FP}/counts/{countId}/functions`, {
  tag: T_FP, name: 'FpFunction', label: 'função', plural: 'funções da contagem', schema: fp.functionSchema,
  filters: fp.functionFilters, errors: sectionErrors,
  example: { name: 'Clientes', type: 'ilf', det: 12, retFtr: 2 },
});

// ---------- Scrum ----------
const T_SC = 'Scrum';
const SC = '/projects/{projectId}/scrum';
add('get', SC, {
  tag: T_SC, summary: 'Visão geral',
  description: 'Compromissos, papéis, contagens, velocidade das sprints encerradas e a sprint atual com burndown.',
  errors: anySection, response: ref('ScrumOverview'),
});
add('get', `${SC}/settings`, { tag: T_SC, summary: 'Dados gerais do projeto', errors: anySection, response: ref('ScrumSettings') });
add('patch', `${SC}/settings`, {
  tag: T_SC, summary: 'Atualizar dados gerais (visão, Meta do Produto, DoR, DoD...)', body: sc.settingsSchema,
  errors: [...anySection, 400], response: ref('ScrumSettings'),
  example: { productGoal: 'Agendamento online sem ligações', definitionOfDone: 'Código revisado, testado e publicado' },
});
crud(`${SC}/members`, {
  tag: T_SC, name: 'ScrumMember', label: 'membro', plural: 'membros (PO, SM, desenvolvedores)', schema: sc.memberSchema,
  errors: anySection, example: { name: 'Ana', role: 'product_owner' },
});
crud(`${SC}/items`, {
  tag: T_SC, name: 'ScrumItem', label: 'item do backlog', plural: 'itens do Product/Sprint Backlog', schema: sc.itemSchema,
  filters: sc.itemFilters, errors: anySection,
  example: { code: 'PB-1', title: 'Agendar pelo celular', type: 'story', storyPoints: 5, businessValue: 80 },
});
add('post', `${SC}/items/{id}/move`, {
  tag: T_SC, summary: 'Reordenar o Product Backlog', body: sc.moveSchema, errors: anySection,
  response: arrayOf(ref('ScrumItem')), example: { position: 0 },
});
crud(`${SC}/sprints`, {
  tag: T_SC, name: 'ScrumSprint', label: 'sprint', plural: 'sprints', schema: sc.sprintSchema, errors: anySection,
  example: { number: 1, goal: 'Cliente agenda sozinho', startDate: '2026-11-02', endDate: '2026-11-13', status: 'active' },
});
add('get', `${SC}/sprints/{id}/detail`, {
  tag: T_SC, summary: 'Sprint com Sprint Backlog, tasks, eventos, burndown e incremento entregue',
  description:
    'Cada task traz `kanbanCardId` quando está publicada no Kanban. `delivered` lista os itens e tasks concluídos ' +
    '(ordem de conclusão) e os pontos entregues.',
  errors: anySection, response: { type: 'object' },
});
add('post', `${SC}/sprints/{id}/publish-kanban`, {
  tag: T_SC, summary: 'Publicar as tasks da sprint no Kanban',
  description:
    'Cria um cartão para cada task da sprint que ainda não está no quadro (itens do Sprint Backlog sem tasks ganham ' +
    'uma task com o próprio título). Cada cartão entra na coluna da situação da task (`taskStatus` das colunas); ' +
    'num quadro vazio são criadas as colunas A fazer, Fazendo e Feito (ou os nomes em `columnNames`). Depois disso, ' +
    'mover o cartão muda a task e mudar a task move o cartão; tasks concluídas aparecem no incremento entregue.',
  body: sc.publishKanbanSchema, errors: anySection,
  response: object({ published: { type: 'integer' }, createdTasks: { type: 'integer' }, sprint: { type: 'object' } }),
  example: { columnNames: { todo: 'A fazer', in_progress: 'Fazendo', done: 'Feito' } },
});
crud(`${SC}/tasks`, {
  tag: T_SC, name: 'ScrumTask', label: 'task', plural: 'tasks da sprint', schema: sc.taskSchema, filters: sc.taskFilters,
  errors: anySection, example: { sprintId: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e', title: 'Tela de horários', estimateHours: 6 },
});
crud(`${SC}/events`, {
  tag: T_SC, name: 'ScrumEvent', label: 'evento', plural: 'eventos (planning, daily, review, retrospectiva, refinamento)',
  schema: sc.eventSchema, filters: sc.eventFilters, errors: anySection,
  example: { type: 'retrospective', date: '2026-11-13', wentWell: 'Pareamento', toImprove: 'Estimativas', actionItems: 'Planning poker' },
});

// ---------- Kanban ----------
const T_KB = 'Kanban';
const KB = '/projects/{projectId}/kanban';
add('get', KB, {
  tag: T_KB, summary: 'Quadro completo', description: 'Colunas em ordem, cada uma com seus cartões em ordem.',
  response: ref('KanbanBoard'),
});
crud(`${KB}/columns`, {
  tag: T_KB, name: 'KanbanColumn', label: 'coluna', plural: 'colunas',
  schema: kb.columnSchema,
  example: { name: 'Em andamento', wipLimit: 3 },
});
add('post', `${KB}/columns/{id}/move`, {
  tag: T_KB, summary: 'Mover coluna', description: 'Reordena as colunas do quadro e devolve o quadro atualizado.',
  body: kb.moveColumnSchema, response: ref('KanbanBoard'), example: { position: 0 },
});
crud(`${KB}/cards`, {
  tag: T_KB, name: 'KanbanCard', label: 'cartão', plural: 'cartões',
  schema: kb.cardSchema, updateSchema: kb.cardUpdateSchema, filters: kb.cardFilters,
  example: {
    columnId: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e', title: 'Tela de agendamento', priority: 'high',
    dueDate: '2026-11-30', assignee: 'Ana',
  },
});
add('post', `${KB}/cards/{id}/move`, {
  tag: T_KB, summary: 'Mover cartão',
  description: 'Muda o cartão de coluna e/ou posição, reordenando os vizinhos. Devolve o quadro atualizado.',
  body: kb.moveCardSchema, response: ref('KanbanBoard'),
  example: { columnId: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e', position: 0 },
});

// ---------- Schemas de resposta ----------
const tokens = { accessToken: { type: 'string' }, refreshToken: { type: 'string' } };
const fileMeta = {
  fileName: nullable({ type: 'string' }),
  fileMime: nullable({ type: 'string' }),
  fileSize: nullable({ type: 'integer' }),
  fileSha256: nullable({ type: 'string' }),
  fileUploadedAt: nullable(dateTime),
};
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
    enabled: { type: 'boolean', description: 'Liberada para o usuário (todas as seções, em qualquer plano)' },
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
  Ontology: entity(on.ontologySchema, { projectId: uuid, analysis: { type: ['object', 'null'] }, ...fileMeta }),
  OntologySummary: object({
    total: { type: 'integer' },
    withFile: { type: 'integer' },
    published: { type: 'integer' },
    totals: counts,
    byFormat: counts,
    byStatus: counts,
    vocabularies: counts,
    principles: counts,
  }),
  BpmProcess: entity(bpm.processSchema, { projectId: uuid }),
  BpmDiagram: entity(bpm.diagramSchema, { projectId: uuid, metrics: { type: ['object', 'null'] }, ...fileMeta }),
  BpmOverview: object({
    processes: arrayOf(object({
      id: uuid, code: { type: 'string' }, name: { type: 'string' }, parentId: nullable(uuid), level: { type: 'string' },
      status: { type: 'string' }, owner: nullable({ type: 'string' }), sipocComplete: { type: 'boolean' }, diagrams: { type: 'integer' },
    })),
    counts: { type: 'object' },
  }),
  CommonKadsWorksheet: object({
    key: toSchema(ck.worksheetParams).properties.key,
    model: { type: 'string' },
    order: { type: 'integer' },
    fields: arrayOf({ type: 'string' }),
    resource: { type: 'string', description: 'Cadastro que preenche a planilha (planilhas em linhas)' },
    status: toSchema(ck.worksheetUpdateSchema).properties.status,
    content: { type: 'object' },
    notes: nullable({ type: 'string' }),
    updatedAt: nullable(dateTime),
  }),
  CommonKadsOverview: object({
    progress: { type: 'integer', description: '% de planilhas concluídas' },
    worksheets: arrayOf({ type: 'object' }),
    counts,
    gaps: object({
      tasksWithoutAgent: arrayOf({ type: 'string' }),
      knowledgeNotUsed: arrayOf({ type: 'string' }),
      agentsWithoutTask: arrayOf({ type: 'string' }),
      transactionsWithoutAgents: arrayOf({ type: 'string' }),
    }),
  }),
  CkTask: entity(ck.taskSchema, { projectId: uuid }),
  CkKnowledge: entity(ck.knowledgeSchema, { projectId: uuid }),
  CkAgent: entity(ck.agentSchema, { projectId: uuid }),
  CkTransaction: entity(ck.transactionSchema, { projectId: uuid }),
  ContactMessage: object({
    id: uuid, userId: nullable(uuid), name: { type: 'string' }, email: { type: 'string' }, subject: { type: 'string' },
    message: { type: 'string' }, status: { type: 'string', enum: ct.CONTACT_STATUS }, ip: nullable({ type: 'string' }),
    reply: nullable({ type: 'string' }), repliedAt: nullable(dateTime), repliedBy: nullable(uuid),
    createdAt: dateTime, updatedAt: dateTime,
  }),
  FpCount: entity(fp.countSchema, { projectId: uuid, functions: { type: 'integer' }, totalPoints: { type: 'integer' } }),
  FpFunction: entity(fp.functionSchema, {
    countId: uuid, complexity: { type: 'string', enum: ['low', 'average', 'high'] }, points: { type: 'integer' },
  }),
  FpSummary: object({
    count: ref('FpCount'),
    functions: arrayOf(ref('FpFunction')),
    summary: object({
      scope: counts, complexity: counts, contribution: { type: 'object' }, dataPoints: { type: 'integer' },
      transactionPoints: { type: 'integer' }, totalPoints: { type: 'integer' }, byAction: nullable(counts), estimate: { type: 'object' },
    }),
  }),
  ScrumSettings: object({ ...toSchema(sc.settingsSchema, 'output').properties, updatedAt: nullable(dateTime) }),
  ScrumMember: entity(sc.memberSchema, { projectId: uuid }),
  ScrumItem: entity(sc.itemSchema, { projectId: uuid, position: { type: 'integer' }, doneAt: nullable(dateTime) }),
  ScrumSprint: entity(sc.sprintSchema, { projectId: uuid }),
  ScrumTask: entity(sc.taskSchema, { projectId: uuid, position: { type: 'integer' }, doneAt: nullable(dateTime) }),
  ScrumEvent: entity(sc.eventSchema, { projectId: uuid }),
  ScrumOverview: object({
    settings: ref('ScrumSettings'), roles: counts, counts, eventsByType: counts,
    velocity: arrayOf(object({ number: { type: 'integer' }, committed: { type: 'integer' }, done: { type: 'integer' } })),
    averageVelocity: nullable({ type: 'number' }), currentSprint: nullable({ type: 'object' }),
  }),
  KanbanColumn: entity(kb.columnSchema, { projectId: uuid, position: { type: 'integer' } }),
  KanbanCard: entity(kb.cardSchema, {
    projectId: uuid, position: { type: 'integer' },
    // cartões publicados pelo Scrum
    scrumTaskId: nullable(uuid), taskStatus: nullable({ type: 'string' }), sprintId: nullable(uuid),
    sprintNumber: nullable({ type: 'integer' }), itemCode: nullable({ type: 'string' }),
  }),
  KanbanBoard: object({
    columns: arrayOf({ allOf: [ref('KanbanColumn'), object({ cards: arrayOf(ref('KanbanCard')) })] }),
  }),
};

// ---------- Documento ----------
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

## Perfis
Todos os planos (\`free\`, \`standard\`, \`master\`) acessam todas as seções; todo cadastro novo começa \`free\`.
As rotas \`/admin/*\` são exclusivas de quem tem papel \`admin\` **e** plano \`master\`.
`.trim();

let cached;

export function buildOpenApi() {
  cached ??= {
    openapi: '3.1.0',
    info: { title: 'KonekTron API', version: pkg.version, description, contact: { name: 'KonekTron', email: 'konektron@orkneytech-lab.com' } },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'Sistema' },
      { name: T_AUTH, description: 'Cadastro, sessão e senha (RF1, RF2, RF4, RF7)' },
      { name: 'Perfil', description: 'Dados do usuário logado (RF3)' },
      { name: 'Endereços', description: 'Endereços do usuário logado' },
      { name: T_ADMIN, description: 'Somente para papel `admin` com plano `master` (RF5)' },
      { name: T_PROJ, description: 'Projetos `software` ou `data_analysis` e catálogo de seções' },
      { name: T_SA, description: 'Requisitos, histórias de usuário e diagramas. Projetos `software`.' },
      { name: T_DM, description: 'Metodologia CRISP-DM. Projetos `data_analysis`.' },
      { name: T_ON, description: 'Catálogo de ontologias com métricas, vocabulários, princípios e o arquivo (OWL, RDF, Turtle...). Qualquer tipo de projeto.' },
      { name: T_BPM, description: 'Arquitetura de processos com SIPOC e diagnóstico, e diagramas BPMN com upload. Qualquer tipo de projeto.' },
      { name: T_CK, description: 'Planilhas CommonKADS (OM, TM, AM, KM, CM, DM, OTA) e MAS-CommonKADS. Qualquer tipo de projeto.' },
      { name: T_FP, description: 'Contagem IFPUG: funções de dados (ALI/AIE) e de transação (EE/SE/CE), complexidade, PF e estimativas. Projetos `software`.' },
      { name: T_SC, description: 'Scrum: dados gerais, papéis, Product/Sprint Backlog, sprints, tasks e eventos. Qualquer tipo de projeto.' },
      { name: T_CT, description: 'Formulário de contato (público) e caixa de mensagens do admin.' },
      { name: T_KB, description: 'Quadro de tarefas com colunas e cartões. Qualquer tipo de projeto.' },
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
