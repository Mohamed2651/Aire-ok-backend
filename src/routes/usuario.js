const express = require('express');
const { pool } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/preferencias', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM preferencias_usuario WHERE usuario_id = ?', [req.user.id]);
    res.json(rows[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

router.put('/preferencias', authMiddleware, async (req, res) => {
  const { estacion_favorita, umbral_alerta, notificaciones_activas } = req.body;
  try {
    await pool.execute(
      `INSERT INTO preferencias_usuario (usuario_id, estacion_favorita, umbral_alerta, notificaciones_activas)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         estacion_favorita      = COALESCE(VALUES(estacion_favorita), estacion_favorita),
         umbral_alerta          = COALESCE(VALUES(umbral_alerta), umbral_alerta),
         notificaciones_activas = COALESCE(VALUES(notificaciones_activas), notificaciones_activas)`,
      [req.user.id, estacion_favorita ?? null, umbral_alerta ?? null, notificaciones_activas ?? null]
    );
    res.json({ mensaje: 'Preferencias actualizadas' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar preferencias' });
  }
});

router.put('/perfil', authMiddleware, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    await pool.execute('UPDATE usuarios SET nombre = ? WHERE id = ?', [nombre.trim(), req.user.id]);
    res.json({ mensaje: 'Perfil actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

module.exports = router;
