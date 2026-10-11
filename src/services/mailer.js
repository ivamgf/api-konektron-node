import nodemailer from 'nodemailer';
import { env } from '#config/env.js';
import { logger } from '#utils/logger.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    })
  : null;

export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    logger.warn({ to, subject, html }, 'SMTP não configurado — e-mail apenas registrado no log');
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
}

export const mailTemplates = {
  activation: (link) => ({
    subject: 'KonekTron — Ative sua conta',
    html: `<p>Bem-vindo ao KonekTron!</p><p><a href="${link}">Clique aqui para ativar sua conta</a>.</p>`,
  }),
  resetPassword: (link) => ({
    subject: 'KonekTron — Recuperação de senha',
    html: `<p>Recebemos um pedido de nova senha.</p><p><a href="${link}">Criar nova senha</a> (válido por 1 hora).</p>`,
  }),
};
