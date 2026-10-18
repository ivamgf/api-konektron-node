# Imagem de produção da API (build direto na VPS a partir da branch main).
# O contexto é a raiz do repositório; as exclusões ficam em Dockerfile.dockerignore, ao lado deste arquivo.
#   docker build -f .github/workflows/Dockerfile -t konektron-api .
#   docker run -d --name konektron-api --env-file .env -p 3333:3333 --restart unless-stopped konektron-api
FROM node:24.21.0-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3333 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Dependências primeiro: a camada só é refeita quando o package-lock muda
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null || exit 1

# Aplica as migrations pendentes e sobe a API. O exec deixa o node como PID 1,
# para receber o SIGTERM do `docker stop` e encerrar as conexões sem cortar requisições.
CMD ["sh", "-c", "node_modules/.bin/knex migrate:latest && exec node src/server.js"]
