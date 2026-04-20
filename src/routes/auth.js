const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password)
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES ($1, $2, $3) RETURNING id',
      [nombre.trim(), email.toLowerCase().trim(), hash]
    );
    const userId = result.rows[0].id;

    await query('INSERT INTO preferencias_usuario (usuario_id) VALUES ($1)', [userId]);
    await query('INSERT INTO logs_actividad (usuario_id, accion) VALUES ($1, $2)', [userId, 'registro']);

    const token = jwt.sign(
      { id: userId, email, rol: 'registrado' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.status(201).json({
      token,
      usuario: { id: userId, nombre, email, rol: 'registrado' }
    });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

  try {
    const result = await query('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const usuario = result.rows[0];
    const ok = await bcrypt.compare(password, usuario.contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    await query('INSERT INTO logs_actividad (usuario_id, accion) VALUES ($1, $2)', [usuario.id, 'login']);

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.fecha_registro,
              p.estacion_favorita, p.umbral_alerta, p.notificaciones_activas
       FROM usuarios u
       LEFT JOIN preferencias_usuario p ON p.usuario_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
