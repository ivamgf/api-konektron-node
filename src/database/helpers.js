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
