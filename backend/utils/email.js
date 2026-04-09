const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"DeshiChat" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
