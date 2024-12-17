import { Router, Request, Response } from 'express';

const router = Router();

// Rota principal
router.get('/', (req: Request, res: Response) => {
  res.render('index', { title: 'Express' });
});
/*
// Rota para erro - renderiza a view 'error.ejs'
router.get('/error', (req: Request, res: Response) => {
  // Exemplo de erro personalizado
  const error = {
    message: 'Este é um erro personalizado!',
    stack: 'Detalhes do stack do erro aqui...',
  };
  res.render('error', {
    message: error.message,
    error: error.stack,
  });
});
*/
export default router;
