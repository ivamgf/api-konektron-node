#!/usr/bin/env node

import app from '../src/app'; // Corrige o caminho do módulo
import debug from 'debug';
import http from 'http';

const debugLogger = debug('api-konektron-node:server');

/**
 * Obtém a porta do ambiente e configura no Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Cria o servidor HTTP.
 */
const server = http.createServer(app);

/**
 * Ouve na porta fornecida em todas as interfaces de rede.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normaliza uma porta em número, string ou false.
 */
function normalizePort(val: string): number | string | false {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // Pipe nomeado
    return val;
  }

  if (port >= 0) {
    // Número de porta
    return port;
  }

  return false;
}

/**
 * Tratador de erros para o evento "error" do servidor HTTP.
 */
function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // Lida com erros específicos de escuta
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Tratador do evento "listening" do servidor HTTP.
 * Exibe o endereço e a porta no console como URL para facilitar o acesso.
 */
function onListening(): void {
  const addr = server.address();
  const host = process.env.HOST || 'localhost';
  const protocol = app.get('protocol') || 'http';

  if (addr && typeof addr === 'object') {
    const url = `${protocol}://${host}:${addr.port}`;
    console.log(`Server is running at ${url}`);
    debugLogger(`Listening on ${url}`);
  } else {
    console.log('Server is running, but the address is not available.');
  }
}
