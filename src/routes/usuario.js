const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/preferencias', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM preferencias_usuario WHERE usuario_id = $1', [req.user.id]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

router.put('/preferencias', authMiddleware, async (req, res) => {
  const { estacion_favorita, umbral_alerta, notificaciones_activas } = req.body;
  try {
    await query(
      `INSERT INTO preferencias_usuario (usuario_id, estacion_favorita, umbral_alerta, notificaciones_activas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE SET
         estacion_favorita      = COALESCE($2, preferencias_usuario.estacion_favorita),
         umbral_alerta          = COALESCE($3, preferencias_usuario.umbral_alerta),
         notificaciones_activas = COALESCE($4, preferencias_usuario.notificaciones_activas)`,
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
    await query('UPDATE usuarios SET nombre = $1 WHERE id = $2', [nombre.trim(), req.user.id]);
    res.json({ mensaje: 'Perfil actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

router.put('/cambiar-email', authMiddleware, async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' });
  if (!password) return res.status(400).json({ error: 'Contraseña requerida para confirmar' });
  try {
    const result = await query('SELECT contrasena_hash FROM usuarios WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(password, result.rows[0].contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
    await query('UPDATE usuarios SET email = $1 WHERE id = $2', [email.toLowerCase().trim(), req.user.id]);
    res.json({ mensaje: 'Email actualizado correctamente' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese email ya está en uso' });
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar email' });
  }
});

router.put('/cambiar-password', authMiddleware, async (req, res) => {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) return res.status(400).json({ error: 'Ambas contraseñas son obligatorias' });
  if (password_nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  try {
    const result = await query('SELECT contrasena_hash FROM usuarios WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(password_actual, result.rows[0].contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(password_nueva, 12);
    await query('UPDATE usuarios SET contrasena_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await query('INSERT INTO logs_actividad (usuario_id, accion) VALUES ($1, $2)', [req.user.id, 'cambiar_password']);
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

router.get('/favoritos', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, f.fecha_añadido,
              m.ica, m.contaminante_principal, m.fecha_hora AS ultima_medicion,
              CASE 
                WHEN m.fecha_hora >= NOW() - INTERVAL '3 hours' THEN true
                ELSE false
              END AS datos_frescos
       FROM favoritos f
       JOIN estaciones e ON e.id_estacion = f.id_estacion
       LEFT JOIN mediciones m ON m.id = (
         SELECT id FROM mediciones
         WHERE id_estacion = e.id_estacion
         ORDER BY fecha_hora DESC LIMIT 1
       )
       WHERE f.usuario_id = $1
       ORDER BY f.fecha_añadido DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
});

router.post('/favoritos', authMiddleware, async (req, res) => {
  const { id_estacion } = req.body;
  if (!id_estacion) return res.status(400).json({ error: 'id_estacion es obligatorio' });
  try {
    const existe = await query('SELECT id_estacion FROM estaciones WHERE id_estacion = $1', [id_estacion]);
    if (existe.rows.length === 0) {
      const { obtenerDetalleEstacion } = require('../services/waqiService');
      const detalle = await obtenerDetalleEstacion(id_estacion);
      if (!detalle || !detalle.lat || !detalle.lon) {
        return res.status(404).json({ error: 'Estación no encontrada' });
      }
      await query(
        `INSERT INTO estaciones (id_estacion, nombre, lat, lon)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_estacion) DO NOTHING`,
        [id_estacion, detalle.nombre, detalle.lat, detalle.lon]
      );
    }
    await query(
      'INSERT INTO favoritos (usuario_id, id_estacion) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, id_estacion]
    );
    res.status(201).json({ mensaje: 'Añadido a favoritos' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir favorito' });
  }
});

router.delete('/favoritos/:id_estacion', authMiddleware, async (req, res) => {
  try {
    await query(
      'DELETE FROM favoritos WHERE usuario_id = $1 AND id_estacion = $2',
      [req.user.id, req.params.id_estacion]
    );
    res.json({ mensaje: 'Eliminado de favoritos' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

module.exports = router;