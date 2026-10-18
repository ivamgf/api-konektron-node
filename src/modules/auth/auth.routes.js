import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '#config/env.js';
import { validate } from '#middlewares/validate.js';
import { authenticate } from '#middlewares/authenticate.js';
import { authController as c } from './auth.controller.js';
import * as s from './auth.schemas.js';

const router = Router();
const strict = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
});

router.post('/register', strict, validate({ body: s.registerSchema }), c.register);
router.post('/verify-email', validate({ body: s.tokenSchema }), c.verifyEmail);
router.post('/login', strict, validate({ body: s.loginSchema }), c.login);
router.post('/google', strict, validate({ body: s.googleSchema }), c.google); // UC002 A1
router.post('/refresh', validate({ body: s.refreshSchema }), c.refresh);
router.post('/logout', authenticate, validate({ body: s.logoutSchema }), c.logout);
router.post('/forgot-password', strict, validate({ body: s.forgotSchema }), c.forgotPassword);
router.post('/reset-password', strict, validate({ body: s.resetSchema }), c.resetPassword);

// Conta do usuário logado
router.get('/me', authenticate, c.me);
router.delete('/me', authenticate, strict, validate({ body: s.deleteAccountSchema }), c.deleteAccount);
router.post(
  '/change-password',
  authenticate,
  strict,
  validate({ body: s.changePasswordSchema }),
  c.changePassword,
);
router.post('/resend-verification', authenticate, strict, c.resendVerification);

export default router;
