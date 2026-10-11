// Projeto de software de demonstração para o front (não roda em produção)
const NAME = 'Demo — Sistema de Agendamento';

export async function seed(knex) {
  if (process.env.NODE_ENV === 'production') return;
  const admin = await knex('users').where({ email: process.env.SEED_ADMIN_EMAIL ?? '' }).first();
  if (!admin) return;
  if (await knex('projects').where({ owner_id: admin.id, name: NAME }).first()) return;

  await knex.transaction(async (trx) => {
    const [project] = await trx('projects')
      .insert({
        owner_id: admin.id,
        type: 'software',
        name: NAME,
        description: 'Projeto de exemplo da seção Análise de Sistemas.',
      })
      .returning('id');

    await trx('system_analyses').insert({
      project_id: project.id,
      goal: 'Permitir que clientes agendem atendimentos sem contato telefônico.',
      scope: 'Agenda web e notificações por e-mail. Pagamentos ficam fora do escopo.',
    });

    const [rf1] = await trx('requirements')
      .insert([
        {
          project_id: project.id,
          code: 'RF1',
          title: 'Agendar atendimento',
          type: 'functional',
          priority: 'must',
          status: 'approved',
          description: 'O cliente escolhe serviço, data e horário disponíveis.',
        },
        {
          project_id: project.id,
          code: 'RNF1',
          title: 'Tempo de resposta',
          type: 'non_functional',
          sub_type: 'desempenho',
          priority: 'should',
          description: '95% das páginas respondem em menos de 2 s.',
        },
      ])
      .returning('id');

    await trx('user_stories').insert({
      project_id: project.id,
      requirement_id: rf1.id,
      code: 'US1',
      title: 'Agendar pelo celular',
      as_a: 'cliente',
      i_want: 'reservar um horário pelo celular',
      so_that: 'eu não precise ligar para a recepção',
      acceptance_criteria: 'Dado um horário livre, quando confirmo, recebo um e-mail com o resumo.',
      story_points: 5,
      priority: 'must',
    });

    await trx('diagrams').insert({
      project_id: project.id,
      title: 'Casos de uso — Agendamento',
      type: 'use_case',
      notation: 'mermaid',
      source: 'flowchart LR\n  Cliente --> (Agendar atendimento)\n  Cliente --> (Cancelar agendamento)',
    });
  });
}
