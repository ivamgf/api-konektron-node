import { audit } from '#services/auditLog.js';
import { authService } from './auth.service.js';

// Express 5: erros lançados em handlers async vão direto para o errorHandler
export const authController = {
  async register(req, res) {
    const result = await authService.register(req.validated.body);
    await audit({ userId: result.user.id, action: 'auth.register', req });
    res.status(201).json(result);
  },

  async verifyEmail(req, res) {
    await authService.verifyEmail(req.validated.body.token);
    res.json({ message: 'E-mail confirmado' });
  },

  async login(req, res) {
    const result = await authService.login(req.validated.body);
    await audit({ userId: result.user.id, action: 'auth.login', req });
    res.json(result);
  },

  async google(req, res) {
    const result = await authService.googleLogin(req.validated.body);
    await audit({
      userId: result.user.id,
      action: result.created ? 'auth.register_google' : 'auth.login_google',
      req,
    });
    res.status(result.created ? 201 : 200).json(result);
  },

  async refresh(req, res) {
    res.json(await authService.refresh(req.validated.body.refreshToken));
  },

  async logout(req, res) {
    const { refreshToken, allDevices = false } = req.validated.body;
    await authService.logout(req.user.id, refreshToken, { allDevices });
    await audit({ userId: req.user.id, action: 'auth.logout', req });
    res.status(204).end();
  },

  async forgotPassword(req, res) {
    await authService.forgotPassword(req.validated.body.email);
    res.json({ message: 'Se o e-mail estiver cadastrado, você receberá um link.' });
  },

  async resetPassword(req, res) {
    const userId = await authService.resetPassword(req.validated.body);
    await audit({ userId, action: 'auth.password_reset', req });
    res.json({ message: 'Senha atualizada' });
  },

  async me(req, res) {
    res.json(await authService.me(req.user.id));
  },

  async changePassword(req, res) {
    const tokens = await authService.changePassword(req.user.id, req.validated.body);
    await audit({ userId: req.user.id, action: 'auth.password_change', req });
    res.json(tokens); // as demais sessões foram encerradas
  },

  async resendVerification(req, res) {
    await authService.resendVerification(req.user.id);
    res.json({ message: 'Se a conta ainda não foi confirmada, um novo link foi enviado.' });
  },

  async deleteAccount(req, res) {
    await authService.deleteAccount(req.user.id, req.validated.body);
    await audit({ userId: req.user.id, action: 'auth.account_delete', req });
    res.status(204).end();
  },
};
