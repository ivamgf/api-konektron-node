import { Router, Request, Response } from 'express';
import { registerUser, confirmUser, changePassword } from '../controllers/userController';

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

/**
* Basic route to check the operation of the users module.
*/
router.get('/', (req: Request, res: Response) => {
  res.send('Respondendo com um recurso de usuários');
});

export default router;
