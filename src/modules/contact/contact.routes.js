import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '#config/env.js';
import { db } from '#database/connection.js';
import { authenticate, optionalAuth } from '#middlewares/authenticate.js';
import { requireMasterAdmin } from '#middlewares/authorize.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { mailEnabled, mailTemplates, sendMail } from '#services/mailer.js';
import { idParams } from '#shared/schemas.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';
import * as s from './contact.schemas.js';

// Formulário de contato (público) e caixa de mensagens do admin
export const contactRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: 'Muitas mensagens em pouco tempo; tente de novo em alguns minutos' },
});

contactRouter.post('/', limiter, optionalAuth, validate({ body: s.contactSchema }), async (req, res) => {
  const { website, ...data } = req.validated.body;
  // robô preencheu a armadilha: responde como sucesso, sem gravar nem enviar
  if (website) return res.status(202).json({ message: 'Mensagem recebida' });

  const [row] = await db('contact_messages')
    .insert({ ...data, userId: req.user?.id ?? null, ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 500) ?? null })
    .returning(['id', 'createdAt']);

  if (env.CONTACT_EMAIL) {
    // falha de SMTP não perde a mensagem: ela já está no banco, visível ao admin
    sendMail({ to: env.CONTACT_EMAIL, replyTo: data.email, ...mailTemplates.contact(data) }).catch((err) =>
      logger.error({ err, contactId: row.id }, 'Falha ao enviar o e-mail de contato'),
    );
  }
  res.status(201).json({ id: row.id, createdAt: row.createdAt, message: 'Mensagem recebida' });
});

export const contactAdminRouter = Router();
contactAdminRouter.use(authenticate, requireMasterAdmin);

contactAdminRouter.get('/', validate({ query: s.contactListQuery }), async (req, res) => {
  const { page, pageSize, status } = req.validated.query;
  const q = db('contact_messages');
  if (status) q.where({ status });
  const [[{ total }], data, counts] = await Promise.all([
    q.clone().count({ total: '*' }),
    q.clone().orderBy('createdAt', 'desc').limit(pageSize).offset((page - 1) * pageSize),
    db('contact_messages').select('status').count({ n: '*' }).groupBy('status'),
  ]);
  res.json({
    data,
    page,
    pageSize,
    total: Number(total),
    byStatus: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
  });
});

contactAdminRouter.patch('/:id', validate({ params: idParams, body: s.contactUpdateSchema }), async (req, res) => {
  const [row] = await db('contact_messages').where({ id: req.validated.params.id }).update(req.validated.body).returning('*');
  if (!row) throw AppError.notFound('Mensagem');
  res.json(row);
});

// Responde pela plataforma: o e-mail sai do SMTP do sistema para o remetente e a resposta fica registrada
contactAdminRouter.post('/:id/reply', validate({ params: idParams, body: s.contactReplySchema }), async (req, res) => {
  const msg = await db('contact_messages').where({ id: req.validated.params.id }).first();
  if (!msg) throw AppError.notFound('Mensagem');
  if (!mailEnabled()) throw new AppError('Envio de e-mail não configurado (SMTP_HOST vazio)', 503);

  const reply = req.validated.body.message;
  try {
    await sendMail({ to: msg.email, replyTo: env.CONTACT_EMAIL, ...mailTemplates.contactReply(msg, reply) });
  } catch (err) {
    // ex.: senha do SMTP errada (535); a mensagem continua sem resposta
    logger.error({ err, contactId: msg.id }, 'Falha ao enviar a resposta do contato');
    throw new AppError(`O servidor de e-mail recusou o envio: ${err.response ?? err.message}`, 502);
  }
  const [row] = await db('contact_messages')
    .where({ id: msg.id })
    .update({ status: 'answered', reply, repliedAt: db.fn.now(), repliedBy: req.user.id })
    .returning('*');
  await audit({ userId: req.user.id, action: 'admin.contact_reply', description: `${msg.id} → ${msg.email}`, req });
  res.json(row);
});

contactAdminRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const n = await db('contact_messages').where({ id: req.validated.params.id }).del();
  if (!n) throw AppError.notFound('Mensagem');
  res.status(204).end();
});
