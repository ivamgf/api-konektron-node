import path from 'node:path';
import express, { Router } from 'express';
// só o caminho dos arquivos: o index do pacote carregaria o bundle do navegador no servidor
import swaggerUiPath from 'swagger-ui-dist/absolute-path.js';
import { buildOpenApi } from './openapi.js';

// Página de documentação (Swagger UI) em /api/v1/docs e especificação em /api/v1/docs/openapi.json.
// Os arquivos do Swagger UI vêm do pacote npm (nada de CDN): funciona offline e dentro da CSP.
const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

// CSP própria da página: a do helmet tem upgrade-insecure-requests, que quebra em http://localhost
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // estilos inline do Swagger UI
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

router.get('/openapi.json', (_req, res) => res.json(buildOpenApi()));

router.get('/', (req, res) => {
  // a página usa URLs relativas, que dependem da barra final
  if (!req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(301, `${req.baseUrl}/`);
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

router.use('/assets', express.static(swaggerUiPath(), { index: false, maxAge: '7d' }));
router.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));

export default router;
