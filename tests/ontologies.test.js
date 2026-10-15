import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTIONS } from '#config/plans.js';
import { analyzeOntology, detectFormat } from '#modules/ontologies/ontology.analyzer.js';
import { ontologySchema } from '#modules/ontologies/ontologies.schemas.js';
import { ontologiesService } from '#modules/ontologies/ontologies.service.js';
import { extensionOf, readFileName } from '#shared/files.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const RDF_XML = `<?xml version="1.0"?>
<!DOCTYPE rdf:RDF [ <!ENTITY owl "http://www.w3.org/2002/07/owl#" > ]>
<rdf:RDF xmlns="https://ex.com/agenda#" xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:skos="http://www.w3.org/2004/02/skos/core#" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <owl:Ontology rdf:about="https://ex.com/agenda"><owl:versionInfo>1.2</owl:versionInfo></owl:Ontology>
  <owl:Class rdf:about="https://ex.com/agenda#Cliente"/>
  <owl:Class rdf:about="https://ex.com/agenda#Atendimento"><rdfs:subClassOf rdf:resource="https://ex.com/agenda#Evento"/></owl:Class>
  <owl:Class rdf:about="https://ex.com/agenda#Evento"/>
  <owl:Class><owl:unionOf rdf:parseType="Collection"/></owl:Class>
  <owl:ObjectProperty rdf:about="https://ex.com/agenda#agenda">
    <rdf:type rdf:resource="&owl;TransitiveProperty"/>
  </owl:ObjectProperty>
  <owl:DatatypeProperty rdf:about="https://ex.com/agenda#data"/>
  <owl:AnnotationProperty rdf:about="https://ex.com/agenda#nota"/>
  <owl:NamedIndividual rdf:about="https://ex.com/agenda#ana"/>
  <rdf:Description rdf:about="https://ex.com/agenda#Sala"><rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Class"/></rdf:Description>
</rdf:RDF>`;

const TURTLE = `@prefix : <https://ex.com/agenda#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <https://schema.org/> .
<https://ex.com/agenda> a owl:Ontology ; owl:versionInfo "2.0" .
:Cliente a owl:Class ; rdfs:subClassOf schema:Person .
:Atendimento rdf:type owl:Class .
:agenda a owl:ObjectProperty , owl:TransitiveProperty .
:data a owl:DatatypeProperty .
:ana a owl:NamedIndividual , :Cliente .
`;

test('Ontologias: implementada, plano Master', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.ONTOLOGIES));
  assert.ok(canAccessSection({ role: 'client', plan: 'master' }, SECTIONS.ONTOLOGIES));
  assert.ok(!canAccessSection({ role: 'client', plan: 'standard' }, SECTIONS.ONTOLOGIES));
});

test('analisador: RDF/XML com IRI, versão, vocabulários e contagens sem duplicar', () => {
  const a = analyzeOntology(Buffer.from(RDF_XML), 'agenda.owl');
  assert.equal(a.format, 'rdf_xml');
  assert.equal(a.iri, 'https://ex.com/agenda');
  assert.equal(a.version, '1.2');
  // 3 classes nomeadas + 1 por rdf:type (a anônima não conta); a característica transitiva não duplica
  assert.deepEqual(a.counts, {
    classes: 4, objectProperties: 1, datatypeProperties: 1, annotationProperties: 1, individuals: 1, subClassOf: 1,
  });
  assert.deepEqual(a.suggested, { classCount: 4, relationshipCount: 1, propertyCount: 1, objectCount: 1 });
  for (const v of ['rdf', 'rdfs', 'owl', 'skos', 'dublin_core']) assert.ok(a.vocabularies.includes(v), v);
  assert.ok(!a.vocabularies.includes('schema'));
});

test('analisador: Turtle e N-Triples', () => {
  const t = analyzeOntology(Buffer.from(TURTLE), 'agenda.ttl');
  assert.equal(t.format, 'turtle');
  assert.equal(t.iri, 'https://ex.com/agenda');
  assert.equal(t.version, '2.0');
  assert.equal(t.counts.classes, 2);
  assert.equal(t.counts.objectProperties, 1);
  assert.equal(t.counts.datatypeProperties, 1);
  assert.equal(t.counts.individuals, 1);
  assert.ok(t.vocabularies.includes('schema'));

  const nt = '<https://ex.com/a#C> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .\n';
  const n = analyzeOntology(Buffer.from(nt), 'a.nt');
  assert.equal(n.format, 'n_triples');
  assert.equal(n.counts.classes, 1);
});

test('analisador: formatos reconhecidos pelo conteúdo e arquivos que não são ontologia', () => {
  assert.equal(detectFormat('<Ontology xmlns="http://www.w3.org/2002/07/owl#" ontologyIRI="x">', 'owl'), 'owl_xml');
  assert.equal(detectFormat('{ "@context": "https://schema.org" }', 'json'), 'json_ld');
  assert.equal(detectFormat('format-version: 1.2\n', 'txt'), 'obo');
  assert.equal(detectFormat('Prefix(:=<x#>)\nOntology(<x>)', 'owl'), 'owl_functional');
  const obo = analyzeOntology(Buffer.from('format-version: 1.2\n[Term]\nid: A\n[Term]\nid: B\nis_a: A\n[Typedef]\nid: r\n'), 'x.obo');
  assert.equal(obo.counts.classes, 2);
  assert.equal(obo.counts.objectProperties, 1);
  assert.equal(obo.counts.subClassOf, 1);
  const other = analyzeOntology(Buffer.from('apenas texto'), 'x.json');
  assert.equal(other.counts, null);
  assert.equal(other.suggested, null);
});

test('upload preenche só o que está vazio', () => {
  const row = { format: null, iri: null, version: '9', classCount: 10, relationshipCount: null, propertyCount: null, objectCount: null, vocabularies: ['foaf'] };
  const { update, analysis } = ontologiesService.onUpload(Buffer.from(RDF_XML), { name: 'agenda.owl', row });
  assert.equal(update.format, 'rdf_xml');
  assert.equal(update.iri, 'https://ex.com/agenda');
  assert.equal(update.version, undefined); // já preenchida
  assert.equal(update.classCount, undefined); // digitada pelo usuário
  assert.equal(update.relationshipCount, 1);
  assert.ok(JSON.parse(update.vocabularies).includes('foaf'));
  assert.equal(JSON.parse(update.analysis).format, analysis.format);
});

test('schema: título obrigatório, contagens inteiras, vocabulários e princípios do catálogo', () => {
  const base = { title: 'Agenda' };
  assert.equal(ontologySchema.safeParse(base).success, true);
  assert.equal(ontologySchema.safeParse({ ...base, classCount: -1 }).success, false);
  assert.equal(ontologySchema.safeParse({ ...base, classCount: 1.5 }).success, false);
  assert.equal(ontologySchema.safeParse({ ...base, vocabularies: ['skos', 'schema'], principles: ['fair', 'care'] }).success, true);
  assert.equal(ontologySchema.safeParse({ ...base, vocabularies: ['inventado'] }).success, false);
  assert.equal(ontologySchema.safeParse({ ...base, publicationUrl: 'nao-e-url' }).success, false);
  assert.equal(ontologySchema.safeParse({ title: ' ' }).success, false);
});

test('arquivos: nome sem caminho nem caracteres de controle, extensão em minúsculas', () => {
  const req = (v) => ({ get: () => v });
  assert.equal(readFileName(req(encodeURIComponent('C:\\docs\\Agenda Ç.OWL'))), 'Agenda Ç.OWL');
  assert.equal(readFileName(req('../../etc/passwd')), 'passwd');
  assert.equal(readFileName(req('a\u0000b"c.ttl')), 'abc.ttl');
  assert.equal(extensionOf('Agenda.OWL'), 'owl');
  assert.equal(extensionOf('sem-extensao'), '');
});

test('OpenAPI documenta o catálogo e o upload binário', () => {
  const { paths } = buildOpenApi();
  const base = '/projects/{projectId}/ontologies';
  for (const p of ['', '/summary', '/{id}', '/{id}/file']) assert.ok(paths[`${base}${p}`], p || '/');
  const put = paths[`${base}/{id}/file`].put;
  assert.ok(put.requestBody.content['application/octet-stream']);
  assert.ok(put.parameters.some((p) => p.in === 'header' && p.name === 'X-File-Name'));
  assert.ok(paths[`${base}/{id}/file`].get.responses[200].content['application/octet-stream']);
});
