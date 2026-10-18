import { OAuth2Client } from 'google-auth-library';
import { env } from '#config/env.js';
import { AppError } from '#utils/AppError.js';

// Login com Google (Google Identity Services): o app recebe do Google um ID token (JWT assinado)
// e a API só confere a assinatura, o destinatário e a validade. Não usa client secret.
const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export const googleEnabled = () => Boolean(client);

// Devolve { googleId, email } de um ID token válido, com e-mail verificado pelo Google
export async function verifyGoogleCredential(credential) {
  if (!client) throw new AppError('Login com Google não está habilitado', 503);

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Credencial do Google inválida ou expirada', 401);
  }
  if (!payload?.sub || !payload.email) {
    throw new AppError('Credencial do Google inválida ou expirada', 401);
  }
  if (!payload.email_verified) {
    throw new AppError('O e-mail desta conta Google não foi verificado', 401);
  }

  return { googleId: payload.sub, email: payload.email.trim().toLowerCase() };
}
