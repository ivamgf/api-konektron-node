export const requestPasswordReset = async (email: string): Promise<boolean> => {
    const users = [
      { id: 1, email: 'test@example.com', password: 'password123' },
      { id: 2, email: 'user@example.com', password: 'securepass' },
    ];
  
    const userExists = users.some((user) => user.email === email);
    return userExists;
  };
  
  export const resetPassword = async (resetToken: string, newPassword: string): Promise<boolean> => {
    const validTokens = ['valid-reset-token'];
  
    if (validTokens.includes(resetToken)) {
      return true;
    }
    return false;
  };
  