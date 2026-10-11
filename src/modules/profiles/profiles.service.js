import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';

const FIELDS = [
  'fullName', 'nickname', 'avatarUrl', 'phoneMobile', 'phoneLandline',
  'company', 'department', 'jobTitle', 'birthDate', 'locale',
];

export const profilesService = {
  async get(userId) {
    const profile = await db('profiles').where({ userId }).first('id', ...FIELDS);
    if (!profile) throw AppError.notFound('Perfil');
    const socialNetworks = await db('social_networks')
      .where({ profileId: profile.id })
      .orderBy('createdAt')
      .select('id', 'network', 'url');
    const { id: _id, ...rest } = profile;
    return { ...rest, socialNetworks };
  },

  async update(userId, { socialNetworks, ...data }) {
    await db.transaction(async (trx) => {
      const profile = await trx('profiles').where({ userId }).first('id');
      if (!profile) throw AppError.notFound('Perfil');

      if (Object.keys(data).length) await trx('profiles').where({ id: profile.id }).update(data);

      if (socialNetworks) {
        // Substitui a lista inteira: simples e previsível para o front
        await trx('social_networks').where({ profileId: profile.id }).del();
        if (socialNetworks.length) {
          await trx('social_networks').insert(
            socialNetworks.map((n) => ({ ...n, profileId: profile.id })),
          );
        }
      }
    });
    return this.get(userId);
  },
};
