import { Router } from 'express';
import { getProfileController } from '../controllers/profileController';

const router = Router();

/**
 * Rota para consultar o perfil de um usuário pelo userId.
 */
router.get('/profile/:userId', getProfileController);

export default router;
