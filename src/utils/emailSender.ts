import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

// Configuração do transporte de e-mail
const transporter = nodemailer.createTransport({
  host: 'mail.orkneytech.com.br', // Substituir pelo host SMTP real
  port: 465,
  secure: false,
  auth: {
    user: 'orkneytech@orkneytech.com.br', // Substituir pelo e-mail real
    pass: '@Ivam202301170', // Substituir pela senha real
  },
  
});

// Função para enviar o e-mail de confirmação de cadastro
export const sendConfirmationEmail = async (user: any): Promise<void> => {
  const templatePath = path.join(__dirname, '../views/confirmationEmail.ejs');
  const confirmationUrl = `http://localhost:3000/confirm/${user.idUser}`;

  const html = await ejs.renderFile(templatePath, { confirmationUrl });

  await transporter.sendMail({
    from: 'no-reply@example.com',
    to: user.email,
    subject: 'Confirmação de Cadastro',
    html,
  });
};

// Função para enviar o e-mail de recuperação de senha
export const sendRecoveryEmail = async (userEmail: string, resetToken: string): Promise<void> => {
  const templatePath = path.join(__dirname, '../views/recoveryEmail.ejs');
  const recoveryUrl = `http://localhost:3000/reset-password/${resetToken}`;

  const html = await ejs.renderFile(templatePath, { recoveryUrl });

  await transporter.sendMail({
    from: 'no-reply@example.com',
    to: userEmail,
    subject: 'Recuperação de Senha',
    html,
  });
};


