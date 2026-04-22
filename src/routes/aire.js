const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const {
  obtenerDetalleEstacion,
  obtenerEstacionCercana,
  buscarEstacion,
  sincronizarEstacionesEspana
} = require('../services/waqiService');

const router = express.Router();

// GET /api/aire/estaciones
router.get('/estaciones', async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*,
             m.ica, m.contaminante_principal, m.fecha_hora AS ultima_medicion,
             CASE 
               WHEN m.fecha_hora >= NOW() - INTERVAL '3 hours' THEN true
               ELSE false
             END AS datos_frescos
      FROM estaciones e
      LEFT JOIN mediciones m ON m.id = (
        SELECT id FROM mediciones
        WHERE id_estacion = e.id_estacion
        ORDER BY fecha_hora DESC LIMIT 1
      )
      ORDER BY e.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estaciones' });
  }
});

// GET /api/aire/estacion/:uid
router.get('/estacion/:uid', async (req, res) => {
  try {
    const detalle = await obtenerDetalleEstacion(req.params.uid);
    res.json(detalle);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo obtener el detalle de la estación' });
  }
});

// GET /api/aire/cercana?lat=40.41&lon=-3.70
router.get('/cercana', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Parámetros lat y lon requeridos' });
  try {
    const estacion = await obtenerEstacionCercana(parseFloat(lat), parseFloat(lon));
    res.json(estacion);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo obtener la estación cercana' });
  }
});

// GET /api/aire/buscar?q=barcelona
router.get('/buscar', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Mínimo 2 caracteres' });
  try {
    const resultados = await buscarEstacion(q.trim());
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Error en la búsqueda' });
  }
});

// GET /api/aire/historial/:uid?dias=7
router.get('/historial/:uid', authMiddleware, async (req, res) => {
  const dias = Math.min(parseInt(req.query.dias) || 7, 30);
  try {
    const result = await query(
      `SELECT DATE(fecha_hora) AS fecha,
              ROUND(AVG(ica))  AS ica_medio,
              MAX(ica)         AS ica_max,
              MIN(ica)         AS ica_min
       FROM mediciones
       WHERE id_estacion = $1
         AND fecha_hora >= NOW() - INTERVAL '1 day' * $2
         AND ica IS NOT NULL
       GROUP BY DATE(fecha_hora)
       ORDER BY fecha`,
      [req.params.uid, dias]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// POST /api/aire/sincronizar
router.post('/sincronizar', authMiddleware, async (req, res) => {
  try {
    const total = await sincronizarEstacionesEspana();
    res.json({ mensaje: 'Sincronización completada', estaciones_actualizadas: total });
  } catch (err) {
    res.status(502).json({ error: 'Error: ' + err.message });
  }
});

router.get('/estacion/:uid', async (req, res) => {
  try {
    const detalle = await obtenerDetalleEstacion(req.params.uid);
    if (!detalle.nombre) {
      return res.status(404).json({ error: 'Estación no encontrada' });
    }
    res.json(detalle);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo obtener el detalle de la estación' });
  }
});

module.exports = router;
