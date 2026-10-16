// Cadastra no PagBank a URL que recebe os avisos das assinaturas (pago, atrasado, suspenso, cancelado…).
// É uma preferência da conta, uma por ambiente: rode depois de configurar PAGBANK_TOKEN e API_URL.
//   npm run pagbank:webhook            → grava API_URL/api/v1/billing/webhooks/pagbank
//   npm run pagbank:webhook -- --show  → só mostra a configuração atual
import { env } from '#config/env.js';
import { pagbank } from '#services/pagbank.js';

const url = `${env.API_URL.replace(/\/$/, '')}/api/v1/billing/webhooks/pagbank`;

try {
  if (!process.argv.includes('--show')) {
    if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
      console.error(`❌ O PagBank precisa de uma URL pública com HTTPS; API_URL atual: ${env.API_URL}`);
      console.error('   Em desenvolvimento, exponha a API com um túnel (ex.: ngrok) e ajuste API_URL.');
      process.exit(1);
    }
    await pagbank.setNotificationPreferences({ urls: [url] });
    console.log(`✅ Avisos de assinatura (${env.PAGBANK_ENV}) → ${url}`);
  }
  console.log(JSON.stringify(await pagbank.getNotificationPreferences(), null, 2));
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
