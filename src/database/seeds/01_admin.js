import bcrypt from 'bcryptjs';

// Admin inicial: defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env
export async function seed(knex) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não definidos — admin não criado.');
    return;
  }
  if (await knex('users').where({ email }).first()) return;

  const [user] = await knex('users')
    .insert({
      email,
      password_hash: await bcrypt.hash(password, 12),
      role: 'admin',
      plan: 'master',
      terms_accepted: true,
      email_verified_at: knex.fn.now(),
    })
    .returning('id');
  await knex('profiles').insert({ user_id: user.id, nickname: 'Admin', locale: 'pt-BR' });
}
