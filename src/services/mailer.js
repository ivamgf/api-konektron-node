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

// Titan, Gmail etc. recusam o login sem senha: avisa já na inicialização, não só quando um e-mail falha
if (transporter && env.SMTP_USER && !env.SMTP_PASSWORD && !env.isTest) {
  logger.warn({ host: env.SMTP_HOST, user: env.SMTP_USER }, 'SMTP_PASSWORD vazio: o envio de e-mails vai falhar (rode npm run mail:test)');
}

// Texto vindo do usuário dentro de um e-mail HTML
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Sem SMTP os e-mails só vão para o log: quem precisa garantir a entrega (ex.: resposta ao contato) confere antes
export const mailEnabled = () => Boolean(transporter);

export async function sendMail({ to, subject, html, replyTo }) {
  if (!transporter) {
    logger.warn({ to, subject, html }, 'SMTP não configurado — e-mail apenas registrado no log');
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html, ...(replyTo && { replyTo }) });
}

export const mailTemplates = {
  activation: (link) => ({
    subject: 'KonekTron — Ative sua conta',
    html: `<p>Bem-vindo ao KonekTron!</p><p><a href="${link}">Clique aqui para ativar sua conta</a>.</p>`,
  }),
  contact: ({ name, email, subject, message }) => ({
    subject: `KonekTron — Contato: ${subject}`,
    html:
      `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt; escreveu pelo formulário de contato:</p>` +
      `<p><strong>${escapeHtml(subject)}</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  }),
  // Resposta da equipe a uma mensagem de contato, citando a mensagem original
  contactReply: ({ name, subject, message, createdAt }, reply) => ({
    subject: `Re: ${subject}`,
    html:
      `<p>Olá, ${escapeHtml(name)}!</p><p style="white-space:pre-wrap">${escapeHtml(reply)}</p>` +
      '<p>Equipe KonekTron</p><hr>' +
      `<p style="color:#666">Em ${new Date(createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, você escreveu:</p>` +
      `<blockquote style="color:#666;white-space:pre-wrap;border-left:3px solid #ccc;margin:0;padding-left:12px">${escapeHtml(message)}</blockquote>`,
  }),
  resetPassword: (link) => ({
    subject: 'KonekTron — Recuperação de senha',
    html: `<p>Recebemos um pedido de nova senha.</p><p><a href="${link}">Criar nova senha</a> (válido por 1 hora).</p>`,
  }),
};
