import mockData from './mockData.json';

// Simula a validação de credenciais
export const validateUserCredentials = async (email: string, password: string) => {
  return mockData.users.find(user => user.email === email && user.password === password) || null;
};

// Simula a geração de um token JWT
export const generateToken = (userId: number): string => {
  return `mocked-token-for-user-${userId}`;
};
