import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import { PRIORITIES } from '#modules/system-analysis/systemAnalysis.constants.js';

// Visão de Sistema — especificação de requisitos (UML) e BDD de um projeto `software`
export const USE_CASE_STATUS = ['draft', 'reviewed', 'approved'];
export const FLOW_KINDS = ['main', 'alternative', 'exception'];
export const RELATION_TYPES = ['include', 'extend'];
export const GHERKIN_LANGS = ['pt-BR', 'en', 'es'];

const code = (example) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{1,20}$/, { error: 'Use até 20 letras, dígitos, ".", "-" ou "_"' })
    .describe(`Único no projeto; convertido para maiúsculas (ex.: ${example})`);
const name = z.string().trim().min(1).max(200);

export const specUpdateSchema = z.object({
  responsible: optText(200),
  organization: optText(200),
  purpose: longText(10_000),
  productPerspective: longText(10_000),
  userCharacteristics: longText(10_000),
  constraints: longText(10_000),
  assumptions: longText(10_000),
  references: longText(10_000),
});

export const stakeholderSchema = z.object({
  code: code('"P1"'),
  name,
  role: optText(200),
  interest: longText(5000),
  responsibility: longText(5000),
});

export const glossarySchema = z.object({
  code: code('"C1"'),
  term: name,
  definition: z.string().trim().min(1).max(5000),
  synonyms: longText(2000),
  relationships: longText(2000),
});

export const useCaseSchema = z.object({
  code: code('"UC001"'),
  name: name.describe('Começa com um verbo: "Abrir conta"'),
  generalUseCaseId: z.uuid().nullable().optional().describe('Caso de uso geral (generalização)'),
  primaryActor: z.string().trim().min(1).max(200),
  secondaryActors: longText(2000).describe('Um ator por linha'),
  summary: longText(5000),
  preconditions: longText(5000).describe('Uma condição por linha'),
  postconditions: longText(5000).describe('Uma condição por linha'),
  restrictions: longText(10_000).describe('Restrições/validações, uma por linha'),
  requirementIds: z.array(z.uuid()).max(100).optional().describe('Requisitos que o caso de uso atende (rastreabilidade)'),
  priority: z.enum(PRIORITIES).nullable().optional(),
  status: z.enum(USE_CASE_STATUS).optional(),
});

const step = z.object({
  actor: z.string().trim().max(1000).optional().default(''),
  system: z.string().trim().max(1000).optional().default(''),
}).refine((s) => s.actor || s.system, { error: 'O passo precisa de uma ação do ator ou do sistema' });

export const flowSchema = z.object({
  kind: z.enum(FLOW_KINDS),
  title: name,
  position: z.number().int().min(0).optional(),
  steps: z.array(step).max(50),
});

export const relationSchema = z.object({
  fromUseCaseId: z.uuid().describe('Caso de uso base (que inclui ou é estendido)'),
  toUseCaseId: z.uuid().describe('Caso de uso incluído / que estende'),
  type: z.enum(RELATION_TYPES),
  extensionPoint: optText(200),
  condition: longText(2000),
});

export const scenarioSchema = z.object({
  title: name,
  userStoryId: z.uuid().nullable().optional().describe('Funcionalidade (história de usuário)'),
  useCaseId: z.uuid().nullable().optional(),
  tags: optText(200).describe('Ex.: "@login @smoke"'),
  given: longText(5000).describe('Um passo por linha, sem a palavra-chave'),
  when: longText(5000),
  then: longText(5000),
  examples: longText(5000).describe('Tabela "| campo | valor |"; com exemplos vira Esquema do Cenário'),
  position: z.number().int().min(0).optional(),
});

export const scenarioFilters = z.object({
  userStoryId: z.uuid().optional(),
  useCaseId: z.uuid().optional(),
});

export const langQuery = z.object({ lang: z.enum(GHERKIN_LANGS).optional() });

// Importação a partir de um projeto da Análise de Sistemas (o próprio ou outro projeto software)
const part = (what) => z.boolean().optional().describe(`${what} (padrão: true)`);
export const importSchema = z.object({
  sourceProjectId: z.uuid().describe('Projeto de origem; o próprio projeto só gera os rascunhos'),
  lang: z.enum(GHERKIN_LANGS).optional().describe('Idioma dos textos gerados (ator padrão, título do cenário)'),
  dryRun: z.boolean().optional().describe('true = só mostra o que seria criado, sem gravar'),
  analysis: part('Preencher objetivo/escopo vazios com os da origem'),
  requirements: part('Copiar requisitos (códigos existentes são mantidos)'),
  userStories: part('Copiar histórias de usuário'),
  diagrams: part('Copiar diagramas'),
  systemView: part('Copiar a Visão de Sistema da origem (definições, stakeholders, glossário, casos de uso, cenários BDD)'),
  generateUseCases: part('Gerar um caso de uso por requisito funcional sem caso de uso'),
  generateStakeholders: part('Gerar stakeholders a partir dos papéis "Como ..." das histórias'),
});
