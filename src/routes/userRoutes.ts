// userRouter.ts
import { Router, Request, Response } from 'express';
import { registerUser, confirmUser, changePassword, queryUsers } from '../controllers/userController';
import { login } from '../controllers/authController'; // Importe a função de login

const router = Router();

/**
* Route for registering a new user.
* Calls the `registerUser` controller to handle the logic.
*/
router.post('/register', registerUser);

/**
* Route for user confirmation.
* Uses `userId` as a parameter in the URL.
* Calls the `confirmUser` controller to handle the logic.
*/
router.get('/confirm/:userId', confirmUser);

/** Update password */
router.put('/password/:userId', changePassword);

/** Rota para consultar usuários */
router.get('/users/:userId?', queryUsers);

router.get('/', (req, res) => {
  res.send('Respondendo com um recurso de usuários');
});

/** Login Route */
router.post('/login', login); // Adiciona a rota de login aqui

/**
* Basic route to check the operation of the users module.
*/
router.get('/', (req: Request, res: Response) => {
  res.send('Respondendo com um recurso de usuários');
});

export default router;
