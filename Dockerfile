# Imagem de produção da API (EasyPanel / Docker na VPS HostGator)
FROM node:24.21.0-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependências primeiro: a camada só é refeita quando o package-lock muda
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

USER node
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3333}/api/v1/health" > /dev/null || exit 1

# Aplica as migrations pendentes e sobe a API
CMD ["npm", "run", "start:prod"]
