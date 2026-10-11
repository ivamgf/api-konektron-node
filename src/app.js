import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from '#config/env.js';
import { logger } from '#utils/logger.js';
import { errorHandler, notFound } from '#middlewares/errorHandler.js';
import routes from './routes.js';

// Reaproveita o X-Request-Id do proxy só se for curto e seguro (vai para logs e audit_logs)
const REQUEST_ID = /^[\w.:-]{1,100}$/;

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do Nginx na VPS
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = REQUEST_ID.test(incoming ?? '') ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
  }),
);

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);
