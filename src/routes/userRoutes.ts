import { Router, Request, Response } from 'express';
import { registerUser, confirmUser } from '../controllers/userController';

const router = Router();

/**
 * Rota para o registro de um novo usuário.
 * Chama o controller `registerUser` para tratar a lógica.
 */
router.post('/register', registerUser);

/**
 * Rota para confirmação de usuário.
 * Utiliza o `userId` como parâmetro na URL.
 * Chama o controller `confirmUser` para tratar a lógica.
 */
router.get('/confirm/:userId', confirmUser);

/**
 * Rota básica para verificar o funcionamento do módulo de usuários.
 */
router.get('/', (req: Request, res: Response) => {
  res.send('Respondendo com um recurso de usuários');
});

export default router;
