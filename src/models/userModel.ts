interface User {
    id: number;
    email: string;
    password: string; // Deve estar criptografada
  }
  
  // Simula o banco de dados
  const users: User[] = [
    { id: 1, email: 'test@example.com', password: '$2b$10$abc123hashedpassword' } // Substitua por um hash real
  ];
  
  export const getUserByEmail = async (email: string): Promise<User | null> => {
    const user = users.find((user) => user.email === email);
    return user || null;
  };
  