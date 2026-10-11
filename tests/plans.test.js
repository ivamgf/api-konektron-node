import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, SECTIONS } from '#config/plans.js';

test('plano free só acessa system-analysis', () => {
  const user = { role: 'client', plan: 'free' };
  assert.ok(canAccessSection(user, SECTIONS.SYSTEM_ANALYSIS));
  assert.ok(!canAccessSection(user, SECTIONS.CRISP_DM));
});

test('plano standard inclui CRISP-DM', () => {
  assert.ok(canAccessSection({ role: 'client', plan: 'standard' }, SECTIONS.CRISP_DM));
});

test('admin acessa tudo', () => {
  for (const s of Object.values(SECTIONS)) assert.ok(canAccessSection({ role: 'admin', plan: 'free' }, s));
});
