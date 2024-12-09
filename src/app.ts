import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import mysql, { Connection, MysqlError } from 'mysql';

// Importa rotas
import indexRouter from './routes/index';
import usersRouter from './routes/users';

const app = express();

// Tipagem para configuração do banco de dados
interface DbConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

// Estender a interface Request para incluir `dbConnection`
declare global {
  namespace Express {
    interface Request {
      dbConnection: Connection;
    }
  }
}

// Configuração do banco de dados sem SSL
const dbConfig: DbConfig = {
  host: 'orkneytech.com.br', // Substitua pelo endereço do servidor
  user: 'orkney10_konektron_admin',
  password: '5oXFn{(Zyl7Z',
  database: 'orkney10_konektron',
  port: 3306,
};

// Cria uma conexão com o banco de dados
const dbConnection: Connection = mysql.createConnection(dbConfig);

// Testa a conexão
dbConnection.connect((err: MysqlError | null) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conexão ao banco de dados MySQL estabelecida!');
  }
});

// Middleware para adicionar a conexão ao objeto de solicitação
app.use((req: Request, res: Response, next: NextFunction) => {
  req.dbConnection = dbConnection;
  next();
});

// Configuração de visualização
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configuração de middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configura rotas
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Lida com erros 404
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// Manipulador de erros
app.use((err: createError.HttpError, req: Request, res: Response, next: NextFunction) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

// Fecha a conexão ao encerrar a aplicação
process.on('SIGINT', () => {
  dbConnection.end((err:any) => {
    if (err) {
      console.error('Erro ao encerrar a conexão com o banco de dados:', err.message);
    }
    console.log('Conexão ao banco de dados encerrada.');
    process.exit(0);
  });
});

export default app;
