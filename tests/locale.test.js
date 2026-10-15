import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateProfileSchema } from '#modules/profiles/profiles.schemas.js';
import { PHASES } from '#modules/crisp-dm/crispdm.constants.js';

test('perfil aceita português, inglês e espanhol', () => {
  for (const locale of ['pt-BR', 'en', 'es']) assert.equal(updateProfileSchema.safeParse({ locale }).success, true, locale);
  assert.equal(updateProfileSchema.safeParse({ locale: 'fr' }).success, false);
});

test('fases do CRISP-DM têm nome nos três idiomas', () => {
  for (const p of PHASES) assert.deepEqual(Object.keys(p.label).sort(), ['en', 'es', 'pt-BR']);
});
