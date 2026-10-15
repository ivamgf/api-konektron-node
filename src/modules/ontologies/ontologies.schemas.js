import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as C from './ontologies.constants.js';

const count = (what) => z.number().int().min(0).max(1_000_000_000).nullable().optional().describe(what);
const url = z.url().max(1000).nullable().optional();

export const ontologySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: longText(10_000),
  format: z.enum(C.FORMATS).nullable().optional(),
  iri: url.describe('IRI da ontologia (namespace base)'),
  version: optText(50),
  status: z.enum(C.STATUS).optional(),
  domain: optText(200).describe('Domínio de conhecimento modelado'),
  languages: optText(100).describe('Idiomas dos rótulos, ex.: "pt, en"'),
  creators: longText(2000).describe('Autores/criadores, um por linha'),
  license: optText(200).describe('Ex.: CC BY 4.0'),
  keywords: optText(500),
  classCount: count('Quantidade de classes'),
  relationshipCount: count('Quantidade de relacionamentos (propriedades de objeto)'),
  propertyCount: count('Quantidade de propriedades (de dados/atributos)'),
  objectCount: count('Quantidade de objetos (indivíduos/instâncias)'),
  vocabularies: z.array(z.enum(C.VOCABULARIES)).max(C.VOCABULARIES.length).optional(),
  otherVocabularies: optText(500).describe('Outros vocabulários reutilizados'),
  principles: z.array(z.enum(C.PRINCIPLES)).max(C.PRINCIPLES.length).optional(),
  principlesNotes: longText(5000).describe('Como a ontologia atende aos princípios marcados'),
  publicationUrl: url.describe('Onde a ontologia está publicada'),
  repositoryUrl: url.describe('Repositório do código-fonte (ex.: GitHub)'),
  competencyQuestions: longText(20_000).describe('Questões de competência, uma por linha'),
  notes: longText(10_000),
});

export const ontologyFilters = z.object({
  format: z.enum(C.FORMATS).optional(),
  status: z.enum(C.STATUS).optional(),
});
