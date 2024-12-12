// src/routes/userRoutes.ts
import { Router } from 'express';
import { deleteUserController } from '../controllers/userController';

const router = Router();

// Rota para deletar um usuário
router.delete('/delete/:userId', deleteUserController);

export default router;
