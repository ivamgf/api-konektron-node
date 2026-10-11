// Projeto CRISP-DM de demonstração para o front (não roda em produção)
const PHASES = [
  'business_understanding', 'data_understanding', 'data_preparation',
  'modeling', 'evaluation', 'deployment',
];

export async function seed(knex) {
  if (process.env.NODE_ENV === 'production') return;
  const admin = await knex('users').where({ email: process.env.SEED_ADMIN_EMAIL ?? '' }).first();
  if (!admin) return;
  if (await knex('projects').where({ owner_id: admin.id, name: 'Demo — Previsão de Churn' }).first()) return;

  await knex.transaction(async (trx) => {
    const [project] = await trx('projects')
      .insert({
        owner_id: admin.id,
        type: 'data_analysis',
        name: 'Demo — Previsão de Churn',
        description: 'Projeto de exemplo para prever cancelamento de clientes.',
      })
      .returning('id');

    await trx('crispdm_phases').insert(
      PHASES.map((phase, i) => ({
        project_id: project.id,
        phase,
        status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'not_started',
        content:
          i === 0
            ? JSON.stringify({ background: 'Aumento de 15% na taxa de cancelamento no último ano.' })
            : '{}',
      })),
    );

    await trx('crispdm_objectives').insert([
      { project_id: project.id, type: 'business', description: 'Reduzir churn em 10% em 6 meses', priority: 1 },
      {
        project_id: project.id,
        type: 'data_mining',
        description: 'Classificar clientes com risco de churn nos próximos 30 dias',
        success_criteria: 'Recall >= 0.75 no conjunto de teste',
        priority: 1,
      },
    ]);

    const [dataset] = await trx('crispdm_datasets')
      .insert({
        project_id: project.id,
        name: 'clientes_2025',
        source: 'CRM',
        format: 'csv',
        row_count: 48000,
        column_count: 3,
      })
      .returning('id');

    await trx('crispdm_dataset_fields').insert([
      { dataset_id: dataset.id, name: 'customer_id', data_type: 'categorical', role: 'id' },
      { dataset_id: dataset.id, name: 'tenure_months', data_type: 'numeric', missing_pct: 0.4 },
      { dataset_id: dataset.id, name: 'churned', data_type: 'boolean', role: 'target' },
    ]);
  });
}
