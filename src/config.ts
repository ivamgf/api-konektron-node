import { randomBytes } from 'crypto';

const generateJwtSecret = () => {
  const secret = randomBytes(64).toString('hex');
  console.log('Generated JWT Secret:', secret);
  return secret;
};

// Gera e exibe a chave
generateJwtSecret();

export const JWT_SECRET = process.env.JWT_SECRET || '3f9f4e8b9e2f5d12c7ad3e7b1a54e32a5d08d72ef4a3a9e302e7c12c5d89f3ab';

