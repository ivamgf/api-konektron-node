import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as R from './fp.rules.js';

const money = (what) => z.number().min(0).max(1_000_000).nullable().optional().describe(what);

export const countSchema = z.object({
  name: z.string().trim().min(1).max(200),
  countType: z.enum(R.COUNT_TYPES).describe('Tipo de contagem: projeto de desenvolvimento, de melhoria ou aplicação'),
  purpose: longText(5000).describe('Propósito da contagem'),
  scope: longText(10_000).describe('Escopo e fronteira da aplicação'),
  counter: optText(200).describe('Quem fez a contagem'),
  countedAt: z.iso.date().nullable().optional(),
  hoursPerFp: money('Produtividade: horas por PF (para estimar o esforço)'),
  costPerHour: money('Custo da hora (para estimar o custo)'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional().describe('Moeda, ex.: BRL'),
  notes: longText(10_000),
});

const count = (what) => z.number().int().min(0).max(10_000).describe(what);

export const functionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(R.FUNCTION_TYPES).describe('ilf = ALI, eif = AIE, ei = EE, eo = SE, eq = CE'),
  det: count('TD: tipos de dados (campos únicos reconhecidos pelo usuário)'),
  retFtr: count('TR (ALI/AIE): subgrupos de dados · ALR (EE/SE/CE): arquivos referenciados'),
  action: z.enum(R.ACTIONS).nullable().optional().describe('Projeto de melhoria: incluída, alterada ou excluída'),
  description: longText(5000),
});

export const functionFilters = z.object({
  type: z.enum(R.FUNCTION_TYPES).optional(),
  complexity: z.enum(R.COMPLEXITIES).optional(),
});
