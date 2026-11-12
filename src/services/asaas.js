import { env } from '#config/env.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';

/**
 * Cliente da API v3 do Asaas (assinaturas Standard e Master). A chave vai no header access_token e nunca
 * sai da API. A mesma conta Asaas pode atender outros sistemas: tudo o que o KonekTron cria leva o prefixo
 * EXTERNAL_PREFIX no externalReference, e o webhook ignora o que não for daqui.
 */
export const EXTERNAL_PREFIX = 'konektron:';
export const asaasEnabled = () => Boolean(env.ASAAS_API_KEY);
export const asaasSandbox = () => env.ASAAS_API_URL.includes('sandbox');

export class AsaasError extends Error {
  constructor(status, errors) {
    super(errors.map((e) => e.description).filter(Boolean).join(' ') || `Asaas respondeu ${status}`);
    this.name = 'AsaasError';
    this.status = status;
    this.errors = errors;
  }
}

const TIMEOUT_MS = 20_000;

async function callOnce(method, path, body) {
  if (!asaasEnabled()) throw new AppError('A cobrança on-line ainda não está ativa', 503);
  const url = env.ASAAS_API_URL.replace(/\/$/, '') + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        access_token: env.ASAAS_API_KEY,
        'User-Agent': 'konektron-api',
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AsaasError(0, [{ description: `Sem resposta do Asaas (${err.name})` }]);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  logger.debug({ method, path, status: res.status }, 'Asaas');
  if (res.ok) return json;
  logger.warn({ status: res.status, path, errors: json?.errors }, 'Asaas recusou a chamada');
  throw new AsaasError(res.status, json?.errors ?? [{ description: text.slice(0, 200) }]);
}

/**
 * Chamada ao Asaas: devolve o JSON ou lança AsaasError. Leituras, cancelamentos e atualizações de um
 * registro (POST /recurso/{id}) são repetidos uma vez em falha temporária; criações nunca (não duplicar cobrança).
 */
export async function callAsaas(method, path, body) {
  const retriable = method !== 'POST' || /^\/(customers|subscriptions)\/[^/]+$/.test(path);
  try {
    return await callOnce(method, path, body);
  } catch (err) {
    const transient = err instanceof AsaasError && (err.status === 0 || err.status >= 500);
    if (!retriable || !transient) throw err;
    await new Promise((r) => setTimeout(r, env.isTest ? 0 : 1_500));
    return callOnce(method, path, body);
  }
}

/** Converte a falha do Asaas num erro amigável para o app */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof AsaasError) {
    if (err.errors.some((e) => e.code === 'not_allowed_ip')) {
      return new AppError('O servidor de pagamentos recusou a conexão (IP não autorizado no Asaas)', 502);
    }
    if (err.status === 400) return new AppError(err.message || 'Dados recusados pelo Asaas', 422, err.errors);
  }
  logger.error({ err }, 'Falha na chamada ao Asaas');
  return new AppError('Não foi possível falar com o servidor de pagamentos. Tente de novo em instantes.', 502);
}

export const asaas = {
  createCustomer: (d) => callAsaas('POST', '/customers', { ...d, notificationDisabled: false }),
  updateCustomer: (id, d) => callAsaas('POST', `/customers/${id}`, d),
  // billingType UNDEFINED: o cliente escolhe Pix, boleto ou cartão na fatura
  createSubscription: (d) => callAsaas('POST', '/subscriptions', { billingType: 'UNDEFINED', cycle: 'MONTHLY', ...d }),
  cancelSubscription: (id) => callAsaas('DELETE', `/subscriptions/${id}`),
  subscriptionPayments: async (id) => (await callAsaas('GET', `/subscriptions/${id}/payments?limit=100`))?.data ?? [],
  refundPayment: (id) => callAsaas('POST', `/payments/${id}/refund`, {}),
};

/** Data de hoje (ou de `date`) no fuso de Brasília, no formato do Asaas (AAAA-MM-DD) */
export const asaasDate = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** CPF (11 dígitos) ou CNPJ (14 dígitos) com os dígitos verificadores corretos */
export function validCpfCnpj(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{11}$|^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (base, weights) => {
    const s = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  if (d.length === 11) {
    const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    return dv(d, p1) === Number(d[9]) && dv(d, [11, ...p1]) === Number(d[10]);
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(d, p1) === Number(d[12]) && dv(d, [6, ...p1]) === Number(d[13]);
}
