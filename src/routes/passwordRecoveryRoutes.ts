import { Router } from 'express';
import { requestPasswordResetController, resetPasswordController } from '../controllers/passwordRecoveryController';

const router = Router();

// Rota para solicitar recuperação de senha
router.post('/recover-password', requestPasswordResetController);

// Rota para realizar a atualização da senha
router.post('/reset-password', resetPasswordController);

export default router;
