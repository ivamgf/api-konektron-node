// Confere o SMTP e envia um e-mail de teste: npm run mail:test [-- destino@exemplo.com]
// Sem destino, usa CONTACT_EMAIL (para onde vão as mensagens do formulário de contato).
import nodemailer from 'nodemailer';
import { env } from '#config/env.js';
import { mailTemplates, sendMail } from '#services/mailer.js';

const to = process.argv[2] ?? env.CONTACT_EMAIL;
if (!env.SMTP_HOST) {
  console.error('❌ SMTP_HOST vazio: os e-mails só aparecem no log. Configure SMTP_* no .env.');
  process.exit(1);
}
if (!to) {
  console.error('❌ Informe o destino (npm run mail:test -- email@exemplo.com) ou defina CONTACT_EMAIL.');
  process.exit(1);
}

try {
  await nodemailer
    .createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    })
    .verify();
  console.log(`✅ SMTP ${env.SMTP_HOST}:${env.SMTP_PORT} autenticado como ${env.SMTP_USER}`);
  await sendMail({
    to,
    ...mailTemplates.contact({
      name: 'Teste do KonekTron',
      email: env.SMTP_USER,
      subject: 'Teste de envio',
      message: `E-mail de teste enviado em ${new Date().toLocaleString('pt-BR')} por npm run mail:test.`,
    }),
  });
  console.log(`✅ E-mail de teste enviado para ${to} (remetente: ${env.MAIL_FROM})`);
} catch (err) {
  console.error(`❌ ${err.code ?? ''} ${err.response ?? err.message}`);
  process.exit(1);
}
