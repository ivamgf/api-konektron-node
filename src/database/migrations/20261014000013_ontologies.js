import { addUpdatedAtTrigger, fileBlobTable, fileColumns, uuidPk } from '../helpers.js';

// Seção "Ontologias" (qualquer tipo de projeto, plano Master): catálogo de ontologias com
// métricas, vocabulários, princípios (FAIR, CARE...) e o arquivo publicado (OWL, RDF, Turtle...).
export async function up(knex) {
  await knex.schema.createTable('ontologies', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('format', 20); // rdf_xml, owl_xml, turtle, json_ld...
    t.string('iri', 1000);
    t.string('version', 50);
    t.string('status', 20).notNullable().defaultTo('draft');
    t.string('domain', 200);
    t.string('languages', 100);
    t.text('creators');
    t.string('license', 200);
    t.string('keywords', 500);
    t.integer('class_count');
    t.integer('relationship_count'); // propriedades de objeto
    t.integer('property_count'); // propriedades de dados
    t.integer('object_count'); // indivíduos
    t.jsonb('vocabularies').notNullable().defaultTo('[]');
    t.string('other_vocabularies', 500);
    t.jsonb('principles').notNullable().defaultTo('[]');
    t.text('principles_notes');
    t.string('publication_url', 1000);
    t.string('repository_url', 1000);
    t.text('competency_questions');
    t.text('notes');
    t.jsonb('analysis'); // última análise do arquivo
    fileColumns(t);
    t.timestamps(true, true);
    t.index('project_id');
  });
  await fileBlobTable(knex, 'ontology_files', 'ontology_id', 'ontologies.id');
  await addUpdatedAtTrigger(knex, 'ontologies');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('ontology_files');
  await knex.schema.dropTableIfExists('ontologies');
}
