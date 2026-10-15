import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as C from './commonkads.constants.js';

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{1,20}$/, { error: 'Use até 20 letras, dígitos, ".", "-" ou "_"' })
  .describe('Único no projeto; convertido para maiúsculas (ex.: "T1")');
const name = z.string().trim().min(1).max(200);
const ids = (what) => z.array(z.uuid()).max(200).optional().describe(what);
const text = (max = 10_000) => longText(max);

// ---------- Planilhas ----------
export const WORKSHEET_CONTENT_SCHEMAS = Object.fromEntries(
  C.WORKSHEETS.map((w) => [w.key, z.object(Object.fromEntries((w.fields ?? []).map((f) => [f, text(20_000)])))]),
);

export const worksheetParams = z.object({ key: z.enum(C.WORKSHEET_KEYS) });

export const worksheetUpdateSchema = z.object({
  status: z.enum(C.WORKSHEET_STATUS).optional(),
  notes: text(),
  // validado depois, conforme a planilha (ver commonkads.service)
  content: z.record(z.string(), z.unknown()).optional(),
});

// ---------- OM-3 + TM-1: tarefas ----------
export const taskSchema = z.object({
  code,
  name,
  agentIds: ids('OM-3 "Executada por": agentes (AM-1)'),
  knowledgeIds: ids('OM-3 "Ativo de conhecimento": itens de conhecimento (TM-2)'),
  location: optText(200).describe('OM-3 "Onde?": lugar na estrutura da organização'),
  knowledgeIntensive: z.boolean().nullable().optional(),
  significance: z.number().int().min(1).max(5).nullable().optional().describe('Escala de 1 a 5'),
  // TM-1
  organization: text(),
  goalValue: text(),
  dependencyFlow: text(),
  objectsHandled: text(),
  timingControl: text(),
  knowledgeCompetence: text(),
  resources: text(),
  qualityPerformance: text(),
});

// ---------- OM-4 + TM-2: conhecimento ----------
const entry = z.object({
  applies: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
  bottleneck: z.boolean().optional().describe('Gargalo / a melhorar?'),
});
const group = (keys) => z.object(Object.fromEntries(keys.map((k) => [k, entry.optional()])));
export const characterizationSchema = z.object(
  Object.fromEntries(Object.entries(C.CHARACTERIZATION).map(([g, keys]) => [g, group(keys).optional()])),
);

const check = (what) => ({
  [what]: z.boolean().nullable().optional(),
  [`${what}Notes`]: text(2000),
});

export const knowledgeSchema = z.object({
  name,
  domain: optText(300).describe('TM-2: área em que o conhecimento se insere'),
  ...check('rightForm'),
  ...check('rightPlace'),
  ...check('rightTime'),
  ...check('rightQuality'),
  characterization: characterizationSchema.optional().describe('TM-2: natureza, forma e disponibilidade'),
});

// ---------- AM-1 + MAS-CommonKADS: agentes ----------
export const agentSchema = z.object({
  name,
  kind: z.enum(C.AGENT_KINDS),
  organization: text().describe('Posição na organização (OM-2)'),
  knowledgeIds: ids('Itens de conhecimento do agente (TM-2)'),
  communicatesWithIds: ids('Agentes com quem se comunica'),
  otherCompetences: text(),
  responsibilities: text().describe('Responsabilidades e restrições'),
  // MAS-CommonKADS
  inputParameters: text(),
  activationCondition: text(),
  terminationCondition: text(),
  successCondition: text(),
  failureCondition: text(),
  representationLanguage: optText(200),
  ontology: text(),
  infoEvolution: text(),
  infoEffect: text(),
  infoAssociation: text(),
  aiTechnique: text(),
});

// ---------- CM-1 + CM-2: transações ----------
const short = z.string().trim().max(500).optional();
const informationItem = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(C.ITEM_ROLES),
  form: short.describe('Forma sintática: texto, diagrama, gráfico...'),
  medium: short.describe('Meio: janela, menu, linha de comando, intervenção humana...'),
});
const message = z.object({
  type: z.enum(C.COMMUNICATION_TYPES),
  content: z.string().trim().min(1).max(2000),
  reference: short,
});

export const transactionSchema = z.object({
  code,
  name,
  purpose: text(5000),
  informationObject: optText(500),
  fromTaskId: z.uuid().nullable().optional(),
  toTaskId: z.uuid().nullable().optional(),
  senderAgentId: z.uuid().nullable().optional(),
  receiverAgentId: z.uuid().nullable().optional(),
  communicationPlan: text(5000),
  constraints: text(5000),
  // CM-2
  informationItems: z.array(informationItem).max(50).optional(),
  messages: z.array(message).max(50).optional(),
  messageControl: text(),
});
