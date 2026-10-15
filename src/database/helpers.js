// Utilitários usados pelas migrations
export const createUpdatedAtFunction = (knex) =>
  knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

export const addUpdatedAtTrigger = (knex, table) =>
  knex.raw(
    `CREATE TRIGGER trg_${table}_updated_at BEFORE UPDATE ON ${table}
     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
  );

export const uuidPk = (knex, t) => t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

// Metadados de um arquivo anexado (o conteúdo fica numa tabela à parte; ver shared/files.js)
export const fileColumns = (t) => {
  t.string('file_name', 255);
  t.string('file_mime', 100);
  t.bigInteger('file_size');
  t.string('file_sha256', 64);
  t.timestamp('file_uploaded_at', { useTz: true });
};

// Conteúdo do arquivo, uma linha por registro, apagada junto com ele
export const fileBlobTable = (knex, table, column, references) =>
  knex.schema.createTable(table, (t) => {
    t.uuid(column).primary().references(references).onDelete('CASCADE');
    t.binary('data').notNullable(); // bytea
  });
