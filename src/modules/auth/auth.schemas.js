import { z } from 'zod';

const email = z.email({ error: 'E-mail inválido' }).transform((s) => s.trim().toLowerCase());
const password = z.string().min(8, { error: 'Mínimo de 8 caracteres' }).max(128); // R1 (UC001)
const samePassword = [
  (d) => d.password === d.confirmPassword,
  { error: 'Senhas estão diferentes', path: ['confirmPassword'] }, // R2 (UC001)
];

export const registerSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'Você deve aceitar os Termos de Uso' }),
  })
  .refine(...samePassword);

export const loginSchema = z.object({ email, password: z.string().min(1) });
export const tokenSchema = z.object({ token: z.string().min(10) });
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ token: z.string().min(10), password, confirmPassword: z.string() })
  .refine(...samePassword);

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
  allDevices: z.boolean().optional(),
});

// Login com Google: `credential` é o ID token devolvido pelo botão do Google.
// acceptTerms só é exigido quando o login cria uma conta nova.
export const googleSchema = z.object({
  credential: z.string().min(100, { error: 'Credencial do Google inválida' }),
  acceptTerms: z.boolean().optional(),
});

// currentPassword fica opcional para contas só Google definirem a primeira senha;
// o serviço exige a atual quando a conta já tem senha.
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).optional(), password, confirmPassword: z.string() })
  .refine(...samePassword)
  .refine((d) => d.password !== d.currentPassword, {
    error: 'A nova senha deve ser diferente da atual',
    path: ['password'],
  });

// Com senha local, confirma com a senha; conta só Google confirma digitando o próprio e-mail.
export const deleteAccountSchema = z
  .object({ password: z.string().min(1).optional(), confirmEmail: email.optional() })
  .refine((d) => d.password || d.confirmEmail, {
    error: 'Informe a senha (ou o e-mail, em conta só Google)',
    path: ['password'],
  });
