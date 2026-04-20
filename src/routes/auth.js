const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/database');
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
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES (?, ?, ?)',
      [nombre.trim(), email.toLowerCase().trim(), hash]
    );
    await pool.execute('INSERT INTO preferencias_usuario (usuario_id) VALUES (?)', [result.insertId]);
    await pool.execute('INSERT INTO logs_actividad (usuario_id, accion) VALUES (?, ?)', [result.insertId, 'registro']);

    const token = jwt.sign(
      { id: result.insertId, email, rol: 'registrado' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.status(201).json({
      token,
      usuario: { id: result.insertId, nombre, email, rol: 'registrado' }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
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
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const usuario = rows[0];
    const ok = await bcrypt.compare(password, usuario.contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    await pool.execute('INSERT INTO logs_actividad (usuario_id, accion) VALUES (?, ?)', [usuario.id, 'login']);

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.rol, u.fecha_registro,
              p.estacion_favorita, p.umbral_alerta, p.notificaciones_activas
       FROM usuarios u
       LEFT JOIN preferencias_usuario p ON p.usuario_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
