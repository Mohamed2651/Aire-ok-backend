const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function enviarEmailRecuperacion(email, nombre, token) {
  const resetUrl = `aireok://reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Aire-OK 🌿" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Recuperación de contraseña — Aire-OK',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4CAF50, #2196F3); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; }
          .body { padding: 32px; }
          .body p { color: #333; line-height: 1.6; }
          .btn { display: block; width: fit-content; margin: 24px auto; padding: 14px 32px; background: #4CAF50; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
          .footer { padding: 16px 32px; background: #f9f9f9; text-align: center; }
          .footer p { color: #999; font-size: 12px; margin: 0; }
          .token-box { background: #f0f0f0; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 14px; color: #555; word-break: break-all; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 Aire-OK</h1>
            <p>Recuperación de contraseña</p>
          </div>
          <div class="body">
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Pulsa el botón de abajo para crear una nueva contraseña:</p>
            <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <div class="token-box">${resetUrl}</div>
            <p><strong>Este enlace expira en 1 hora.</strong></p>
            <p>Si no has solicitado este cambio, ignora este email — tu contraseña no cambiará.</p>
          </div>
          <div class="footer">
            <p>Aire-OK · Calidad del aire en tiempo real</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
}

module.exports = { enviarEmailRecuperacion };