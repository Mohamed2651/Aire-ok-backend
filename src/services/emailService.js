const Brevo = require('@getbrevo/brevo');

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

async function enviarEmailRecuperacion(email, nombre, token) {
  const resetUrl = `aireok://reset-password?token=${token}`;

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.sender = { name: 'Aire-OK', email: 'no-reply@aire-ok.com' };
  sendSmtpEmail.subject = 'Recuperación de contraseña — Aire-OK';
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#4CAF50,#2196F3);padding:32px;text-align:center">
        <h1 style="color:white;margin:0">🌿 Aire-OK</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0">Recuperación de contraseña</p>
      </div>
      <div style="padding:32px">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer tu contraseña. Pulsa el botón para crear una nueva:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${resetUrl}" style="background:#4CAF50;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Restablecer contraseña</a>
        </div>
        <p><strong>Este enlace expira en 1 hora.</strong></p>
        <p>Si no has solicitado este cambio, ignora este email.</p>
      </div>
      <div style="padding:16px 32px;background:#f9f9f9;text-align:center">
        <p style="color:#999;font-size:12px;margin:0">Aire-OK · Calidad del aire en tiempo real</p>
      </div>
    </div>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
}

module.exports = { enviarEmailRecuperacion };