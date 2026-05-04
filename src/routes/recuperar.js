const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { enviarEmailRecuperacion } = require('../services/emailService');

const router = express.Router();

// POST /api/auth/recuperar
// Recibe el email, genera token y envía el correo
router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const result = await query(
      'SELECT id, nombre, email FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Siempre respondemos OK aunque no exista el email — seguridad
    if (result.rows.length === 0) {
      return res.json({ mensaje: 'Si el email existe recibirás un correo en breve' });
    }

    const usuario = result.rows[0];

    // Invalidar tokens anteriores del usuario
    await query(
      'UPDATE reset_tokens SET usado = TRUE WHERE usuario_id = $1 AND usado = FALSE',
      [usuario.id]
    );

    // Generar token aleatorio seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      'INSERT INTO reset_tokens (usuario_id, token, expira_en) VALUES ($1, $2, $3)',
      [usuario.id, token, expira]
    );

    // Enviar email
    await enviarEmailRecuperacion(usuario.email, usuario.nombre, token);

    res.json({ mensaje: 'Si el email existe recibirás un correo en breve' });
  } catch (err) {
    console.error('Error en recuperar:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// POST /api/auth/reset-password
// Recibe el token y la nueva contraseña
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    // Verificar que el token existe, no está usado y no ha expirado
    const result = await query(
      `SELECT rt.*, u.email FROM reset_tokens rt
       JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token = $1 AND rt.usado = FALSE AND rt.expira_en > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const resetToken = result.rows[0];
    const hash = await bcrypt.hash(password, 12);

    // Actualizar contraseña
    await query(
      'UPDATE usuarios SET contrasena_hash = $1 WHERE id = $2',
      [hash, resetToken.usuario_id]
    );

    // Marcar token como usado
    await query(
      'UPDATE reset_tokens SET usado = TRUE WHERE id = $1',
      [resetToken.id]
    );

    await query(
      'INSERT INTO logs_actividad (usuario_id, accion) VALUES ($1, $2)',
      [resetToken.usuario_id, 'reset_password']
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en reset-password:', err);
    res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
});

module.exports = router;