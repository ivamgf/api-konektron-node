import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

export const sendConfirmationEmail = async (user: any) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.example.com', // Substituir pelo host SMTP real
    port: 587,
    auth: {
      user: 'your-email@example.com', // Substituir pelo e-mail real
      pass: 'your-email-password', // Substituir pela senha real
    },
  });

  const templatePath = path.join(__dirname, '../views/confirmationEmail.ejs');
  const confirmationUrl = `http://localhost:3000/confirm/${user.id}`;

  const html = await ejs.renderFile(templatePath, { confirmationUrl });

  await transporter.sendMail({
    from: 'no-reply@example.com',
    to: user.email,
    subject: 'Confirmação de Cadastro',
    html,
  });
};
