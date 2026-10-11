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

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), password, confirmPassword: z.string() })
  .refine(...samePassword)
  .refine((d) => d.password !== d.currentPassword, {
    error: 'A nova senha deve ser diferente da atual',
    path: ['password'],
  });

export const deleteAccountSchema = z.object({ password: z.string().min(1) });
