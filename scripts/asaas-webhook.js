// Cadastra (ou recria) o webhook do KonekTron no Asaas, apontando para API_URL/api/v1/billing/webhooks/asaas.
//   npm run asaas:webhook
// Requer ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN e API_URL pública (HTTPS). O token vai no header
// asaas-access-token de cada aviso e é conferido pela API. E-mail dos avisos de falha: ASAAS_WEBHOOK_EMAIL
// (padrão: o endereço de MAIL_FROM). Outros webhooks da mesma conta Asaas (outros sistemas) não são tocados.
import { env } from '#config/env.js';
import { callAsaas } from '#services/asaas.js';

const EVENTS = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
];

const url = `${env.API_URL.replace(/\/$/, '')}/api/v1/billing/webhooks/asaas`;
if (!env.ASAAS_WEBHOOK_TOKEN) throw new Error('Defina ASAAS_WEBHOOK_TOKEN (32 a 255 caracteres)');
if (!url.startsWith('https://')) throw new Error(`O Asaas exige HTTPS público; API_URL atual: ${env.API_URL}`);
const email = (process.env.ASAAS_WEBHOOK_EMAIL || env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] || env.MAIL_FROM || '').trim();
if (!email) throw new Error('Defina ASAAS_WEBHOOK_EMAIL ou MAIL_FROM');

const existing = await callAsaas('GET', '/webhooks?limit=100');
for (const w of existing?.data ?? []) {
  if (w.url === url) await callAsaas('DELETE', `/webhooks/${w.id}`);
}
const created = await callAsaas('POST', '/webhooks', {
  name: 'KonekTron',
  url,
  email,
  enabled: true,
  interrupted: false,
  apiVersion: 3,
  authToken: env.ASAAS_WEBHOOK_TOKEN,
  sendType: 'SEQUENTIALLY',
  events: EVENTS,
});
console.log(`Webhook ${created.id} cadastrado em ${url} (${env.ASAAS_API_URL})`);
process.exit(0);
