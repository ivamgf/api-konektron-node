// Análise rápida de um arquivo de ontologia, sem bibliotecas RDF: identifica o formato, o IRI,
// a versão e os vocabulários usados, e conta as declarações de classes, propriedades e indivíduos.
// As contagens são estimativas (expressões regulares sobre o texto), servem para sugerir valores.
import { extensionOf } from '#shared/files.js';

const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Vocabulário → padrão do namespace
const VOCABULARY_PATTERNS = {
  rdf: new RegExp(esc(NS.rdf)),
  rdfs: new RegExp(esc(NS.rdfs)),
  owl: new RegExp(esc(NS.owl)),
  schema: /https?:\/\/schema\.org\b/,
  rdfa: /http:\/\/www\.w3\.org\/ns\/rdfa#|\b(vocab|typeof|property)="[^"]*"/,
  skos: /http:\/\/www\.w3\.org\/(2004\/02\/skos\/core|2008\/05\/skos-xl)#/,
  dublin_core: /http:\/\/purl\.org\/dc\/(elements\/1\.1|terms)\//,
  foaf: /http:\/\/xmlns\.com\/foaf\/0\.1\//,
  prov: /http:\/\/www\.w3\.org\/ns\/prov#/,
  dcat: /http:\/\/www\.w3\.org\/ns\/dcat#/,
  shacl: /http:\/\/www\.w3\.org\/ns\/shacl#/,
  geo: /http:\/\/www\.w3\.org\/2003\/01\/geo\/wgs84_pos#|http:\/\/www\.opengis\.net\/ont\/geosparql#/,
  vcard: /http:\/\/www\.w3\.org\/2006\/vcard\/ns#/,
  org: /http:\/\/www\.w3\.org\/ns\/org#/,
  sioc: /http:\/\/rdfs\.org\/sioc\/ns#/,
};

export function detectFormat(text, ext) {
  const head = text.slice(0, 5000).trimStart();
  if (ext === 'jsonld' || (/^[[{]/.test(head) && head.includes('@context'))) return 'json_ld';
  if (ext === 'obo' || /^format-version:/m.test(head)) return 'obo';
  if (ext === 'ofn' || /^(Prefix|Ontology)\(/m.test(head)) return 'owl_functional';
  if (ext === 'omn' || /^(Prefix|Ontology|Class):/m.test(head)) return 'manchester';
  if (ext === 'html' || /^<!doctype html|^<html\b/i.test(head)) return 'rdfa';
  if (ext === 'owx' || /<Ontology\b[^>]*xmlns="http:\/\/www\.w3\.org\/2002\/07\/owl#"/.test(head)) return 'owl_xml';
  if (/<([\w-]+:)?RDF\b/.test(head)) return 'rdf_xml';
  if (ext === 'n3') return 'n3';
  if (['nt', 'nq'].includes(ext) || /^<[^>\s]+>\s+<[^>\s]+>\s+\S/.test(head)) return 'n_triples';
  if (['ttl', 'trig'].includes(ext) || /^\s*(@prefix|@base|PREFIX|BASE)\b/im.test(head)) return 'turtle';
  if (head.startsWith('<')) return 'xml';
  return 'other';
}

const emptyCounts = () => ({
  classes: 0, objectProperties: 0, datatypeProperties: 0, annotationProperties: 0, individuals: 0, subClassOf: 0,
});
const countAll = (text, re) => text.match(re)?.length ?? 0;

// Tipos OWL/RDF de uma declaração → contador. Características (owl:TransitiveProperty...) ficam
// de fora: costumam acompanhar a declaração owl:ObjectProperty e contariam a mesma propriedade duas vezes.
const TYPE_TO_COUNT = {
  'owl:Class': 'classes',
  'rdfs:Class': 'classes',
  'owl:ObjectProperty': 'objectProperties',
  'owl:DatatypeProperty': 'datatypeProperties',
  'rdf:Property': 'datatypeProperties',
  'owl:AnnotationProperty': 'annotationProperties',
  'owl:NamedIndividual': 'individuals',
};

// Troca IRIs completos de rdf/rdfs/owl pela forma prefixada (rdf:type, owl:Class...)
function normalizeIris(text) {
  let out = text;
  for (const [prefix, ns] of Object.entries(NS)) {
    out = out
      .replace(new RegExp(`<${esc(ns)}([\\w-]+)>`, 'g'), `${prefix}:$1`)
      .replace(new RegExp(`"${esc(ns)}([\\w-]+)"`, 'g'), `"${prefix}:$1"`)
      .replaceAll(`&${prefix};`, `${prefix}:`);
  }
  return out;
}

function countRdfXml(text) {
  const t = normalizeIris(text).replace(new RegExp(`"(${Object.values(NS).map(esc).join('|')})`, 'g'), (_, ns) =>
    `"${Object.keys(NS).find((k) => NS[k] === ns)}:`,
  );
  const c = emptyCounts();
  for (const [type, key] of Object.entries(TYPE_TO_COUNT)) {
    const [prefix, local] = type.split(':');
    // <owl:Class rdf:about="..."> (declaração com nome; classes anônimas não contam). Sem prefixo,
    // só OWL, o namespace padrão usual
    const element = prefix === 'owl' ? `(?:owl:)?${local}` : `${prefix}:${local}`;
    const named = new Set(
      [...t.matchAll(new RegExp(`<${element}\\b[^>]*\\brdf:(?:about|ID)="([^"]*)"`, 'g'))].map((m) => m[1]),
    );
    c[key] += named.size;
    // <rdf:type rdf:resource="owl:Class"/> dentro de rdf:Description
    c[key] += countAll(t, new RegExp(`<rdf:type\\b[^>]*rdf:resource="${prefix}:${local}"`, 'g'));
  }
  c.subClassOf = countAll(t, /<rdfs:subClassOf\b/g);
  return c;
}

function countOwlXml(text) {
  const c = emptyCounts();
  const keys = { Class: 'classes', ObjectProperty: 'objectProperties', DataProperty: 'datatypeProperties', AnnotationProperty: 'annotationProperties', NamedIndividual: 'individuals' };
  for (const [element, key] of Object.entries(keys)) {
    const re = new RegExp(`<Declaration>\\s*<${element}\\s+(?:abbreviated)?IRI="([^"]+)"`, 'g');
    c[key] = new Set([...text.matchAll(re)].map((m) => m[1])).size;
  }
  c.subClassOf = countAll(text, /<SubClassOf>/g);
  return c;
}

// Turtle, N3, N-Triples: cada "a owl:Class" / "rdf:type owl:Class" é uma declaração
function countTriples(text) {
  const t = normalizeIris(text);
  const c = emptyCounts();
  const term = '(?:[\\w-]*:[\\w-]+|<[^>\\s]*>)';
  const re = new RegExp(`(?:\\ba|rdf:type)\\s+(${term}(?:\\s*,\\s*${term})*)`, 'g');
  for (const [, objects] of t.matchAll(re)) {
    for (const type of objects.split(/\s*,\s*/)) if (TYPE_TO_COUNT[type]) c[TYPE_TO_COUNT[type]] += 1;
  }
  c.subClassOf = countAll(t, /rdfs:subClassOf\b/g);
  return c;
}

function countJsonLd(text) {
  const t = normalizeIris(text);
  const c = emptyCounts();
  for (const [, value] of t.matchAll(/"@type"\s*:\s*(\[[^\]]*\]|"[^"]*")/g)) {
    for (const [, type] of value.matchAll(/"([^"]*)"/g)) if (TYPE_TO_COUNT[type]) c[TYPE_TO_COUNT[type]] += 1;
  }
  c.subClassOf = countAll(t, /"(?:rdfs:)?subClassOf"\s*:/g);
  return c;
}

function countFunctional(text) {
  const c = emptyCounts();
  const keys = { Class: 'classes', ObjectProperty: 'objectProperties', DataProperty: 'datatypeProperties', AnnotationProperty: 'annotationProperties', NamedIndividual: 'individuals' };
  for (const [kind, key] of Object.entries(keys)) c[key] = countAll(text, new RegExp(`Declaration\\(\\s*${kind}\\(`, 'g'));
  c.subClassOf = countAll(text, /\bSubClassOf\(/g);
  return c;
}

function countManchester(text) {
  const c = emptyCounts();
  const keys = { Class: 'classes', ObjectProperty: 'objectProperties', DataProperty: 'datatypeProperties', AnnotationProperty: 'annotationProperties', Individual: 'individuals' };
  for (const [kind, key] of Object.entries(keys)) c[key] = countAll(text, new RegExp(`^\\s*${kind}:`, 'gm'));
  c.subClassOf = countAll(text, /^\s*SubClassOf:/gm);
  return c;
}

function countObo(text) {
  return {
    ...emptyCounts(),
    classes: countAll(text, /^\[Term\]/gm),
    objectProperties: countAll(text, /^\[Typedef\]/gm),
    individuals: countAll(text, /^\[Instance\]/gm),
    subClassOf: countAll(text, /^is_a:/gm),
  };
}

const COUNTERS = {
  rdf_xml: countRdfXml,
  owl_xml: countOwlXml,
  turtle: countTriples,
  n3: countTriples,
  n_triples: countTriples,
  json_ld: countJsonLd,
  owl_functional: countFunctional,
  manchester: countManchester,
  obo: countObo,
};

const first = (text, ...patterns) => {
  for (const re of patterns) {
    const value = re.exec(text)?.[1]?.trim();
    if (value) return value.replace(/^<|>$/g, '');
  }
  return null;
};

function metadata(text, format) {
  const t = format === 'rdf_xml' || format === 'turtle' || format === 'n_triples' || format === 'n3' ? normalizeIris(text) : text;
  const iri = first(
    t,
    /<owl:Ontology\b[^>]*\brdf:about="([^"]+)"/,
    /<Ontology\b[^>]*\bontologyIRI="([^"]+)"/,
    /(<[^>\s]+>)\s+(?:a|rdf:type)\s+owl:Ontology\b/,
    /^Ontology\(\s*<([^>]+)>/m,
    /^Ontology:\s*<([^>]+)>/m,
    /^ontology:\s*(\S+)/m,
  );
  const version = first(
    t,
    /<owl:versionInfo\b[^>]*>([^<]{1,50})</,
    /owl:versionInfo\s+"([^"]{1,50})"/,
    /^data-version:\s*(.{1,50})$/m,
  );
  return { iri: iri && URL.canParse(iri) ? iri : null, version };
}

/**
 * @param {Buffer} buffer
 * @param {string} fileName
 * @returns {{ format, iri, version, vocabularies: string[], counts: object|null, suggested: object }}
 */
export function analyzeOntology(buffer, fileName) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const format = detectFormat(text, extensionOf(fileName));
  const counts = COUNTERS[format]?.(text) ?? null;
  const vocabularies = Object.entries(VOCABULARY_PATTERNS)
    .filter(([key, re]) => (key === 'rdfa' ? format === 'rdfa' && re.test(text) : re.test(text)))
    .map(([key]) => key);
  return {
    format,
    ...metadata(text, format),
    vocabularies,
    counts,
    // valores para os campos da ontologia: relacionamentos = propriedades de objeto (relações entre
    // classes/indivíduos), propriedades = de dados (atributos), objetos = indivíduos (instâncias)
    suggested: counts && {
      classCount: counts.classes,
      relationshipCount: counts.objectProperties,
      propertyCount: counts.datatypeProperties,
      objectCount: counts.individuals,
    },
  };
}
