import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema } from '#modules/contact/contact.schemas.js';
import { escapeHtml, mailTemplates } from '#services/mailer.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const base = { name: 'Ana Souza', email: ' ANA@Exemplo.com ', subject: 'Plano Master', message: 'Gostaria de saber mais.' };

test('contato: campos obrigatórios e e-mail normalizado', () => {
  assert.equal(contactSchema.parse(base).email, 'ana@exemplo.com');
  assert.equal(contactSchema.safeParse({ ...base, email: 'nao-e-email' }).success, false);
  assert.equal(contactSchema.safeParse({ ...base, message: 'curta' }).success, false);
  assert.equal(contactSchema.safeParse({ ...base, name: '' }).success, false);
});

test('e-mail de contato escapa o HTML enviado pelo visitante', () => {
  assert.equal(escapeHtml('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
  const mail = mailTemplates.contact({ ...base, message: '<img src=x onerror=alert(1)>' });
  assert.ok(!mail.html.includes('<img'));
  assert.ok(mail.html.includes('&lt;img'));
  assert.match(mail.subject, /Plano Master/);
});

test('OpenAPI documenta o contato público e a caixa do admin', () => {
  const { paths } = buildOpenApi();
  assert.deepEqual(paths['/contact'].post.security, []);
  assert.ok(paths['/admin/contact-messages'].get);
  assert.ok(paths['/admin/contact-messages/{id}'].patch);
});
