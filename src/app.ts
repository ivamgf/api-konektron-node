import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import mysql, { Connection, MysqlError } from 'mysql';
import authRoutes from './routes/authRoutes';
import { config } from 'dotenv';

// Importa rotas
import indexRouter from './routes/index';
import usersRouter from './routes/userRoutes';

const app = express();

config(); // Carrega as variáveis de ambiente

console.log('Host do banco de dados:', process.env.DB_HOST);
console.log('Usuário do banco de dados:', process.env.DB_USER);

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

// Configuração do banco de dados usando variáveis de ambiente
const dbConfig: DbConfig = {
  host: process.env.DB_HOST || '', // Define um valor padrão vazio se não estiver definido
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  port: Number(process.env.DB_PORT) || 3306, // Converte a porta para número
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
app.use('/auth', authRoutes);

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
