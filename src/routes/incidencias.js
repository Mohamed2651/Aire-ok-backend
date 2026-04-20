const express = require('express');
const { query } = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  const { tipo, descripcion, estacion_relacionada } = req.body;
  if (!descripcion?.trim()) return res.status(400).json({ error: 'La descripción es obligatoria' });
  try {
    const result = await query(
      'INSERT INTO incidencias (usuario_id, tipo, descripcion, estacion_relacionada) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, tipo ?? 'otro', descripcion.trim(), estacion_relacionada ?? null]
    );
    res.status(201).json({ mensaje: 'Incidencia registrada', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar incidencia' });
  }
});

router.get('/mis', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, e.nombre AS nombre_estacion
       FROM incidencias i
       LEFT JOIN estaciones e ON e.id_estacion = i.estacion_relacionada
       WHERE i.usuario_id = $1
       ORDER BY i.fecha_creacion DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener incidencias' });
  }
});

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT i.*, u.nombre AS nombre_usuario, e.nombre AS nombre_estacion
      FROM incidencias i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN estaciones e ON e.id_estacion = i.estacion_relacionada
      ORDER BY i.fecha_creacion DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener incidencias' });
  }
});

module.exports = router;
