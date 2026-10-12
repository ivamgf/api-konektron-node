import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '#config/env.js';

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, plan: user.plan }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

// Tokens opacos (refresh, ativação, reset): só o hash vai para o banco
export const generateOpaqueToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
