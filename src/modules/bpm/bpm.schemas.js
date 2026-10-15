import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as C from './bpm.constants.js';

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{1,20}$/, { error: 'Use até 20 letras, dígitos, ".", "-" ou "_"' })
  .describe('Único no projeto; convertido para maiúsculas (ex.: "MP1", "P1.2")');
const name = z.string().trim().min(1).max(200);
const lines = (what) => longText(10_000).describe(`${what}, um por linha`);

export const processSchema = z.object({
  code,
  name,
  parentId: z.uuid().nullable().optional().describe('Processo pai na arquitetura (sem ciclos)'),
  level: z.enum(C.PROCESS_LEVELS),
  status: z.enum(C.PROCESS_STATUS).optional(),
  owner: optText(200).describe('Dono do processo'),
  objective: longText(5000),
  description: longText(10_000),
  trigger: longText(2000).describe('Evento que inicia o processo'),
  // SIPOC
  suppliers: lines('Fornecedores (S)'),
  inputs: lines('Entradas (I)'),
  steps: lines('Etapas do processo (P)'),
  outputs: lines('Saídas (O)'),
  customers: lines('Clientes (C)'),
  // diagnóstico
  indicators: lines('Indicadores de desempenho'),
  problems: lines('Problemas identificados'),
  improvements: lines('Oportunidades de melhoria'),
});

export const diagramSchema = z.object({
  title: name,
  processId: z.uuid().nullable().optional(),
  state: z.enum(C.DIAGRAM_STATES).optional().describe('as_is (situação atual) ou to_be (proposta)'),
  notation: z.enum(C.DIAGRAM_NOTATIONS).nullable().optional(),
  version: optText(20),
  tool: optText(100).describe('Ferramenta de modelagem: Bizagi, Camunda Modeler, bpmn.io...'),
  description: longText(10_000),
  url: z.url().max(1000).nullable().optional().describe('Link externo do diagrama'),
});

export const processFilters = z.object({
  level: z.enum(C.PROCESS_LEVELS).optional(),
  status: z.enum(C.PROCESS_STATUS).optional(),
  parentId: z.uuid().optional(),
});

export const diagramFilters = z.object({
  processId: z.uuid().optional(),
  state: z.enum(C.DIAGRAM_STATES).optional(),
});
