import { Router } from 'express';
import { getProfileController } from '../controllers/profileController';
import { updateProfileController } from '../controllers/profileController';

const router = Router();

/**
 * Rota para consultar o perfil de um usuário pelo userId.
 */
router.get('/profile/:userId', getProfileController);

/**
 * Rota para atualizar o perfil de um usuário pelo userId.
 * Utiliza o método PUT para atualizar os dados.
 */
router.put('/profile/:userId', updateProfileController);

export default router;
