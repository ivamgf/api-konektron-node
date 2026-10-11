// PM2 na VPS:  pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: 'konektron-api',
      script: 'src/server.js',
      instances: 1,
      max_memory_restart: '400M',
      env_production: { NODE_ENV: 'production' },
      env_homologation: { NODE_ENV: 'homologation' },
    },
  ],
};
