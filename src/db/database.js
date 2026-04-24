const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper para ejecutar queries igual que antes: query(sql, params)
async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function initDatabase() {
  console.log('Conectado a PostgreSQL. Inicializando tablas...');

  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      contrasena_hash VARCHAR(255) NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      rol VARCHAR(20) DEFAULT 'registrado' CHECK (rol IN ('invitado','registrado','admin'))
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS estaciones (
      id_estacion VARCHAR(20) PRIMARY KEY,
      nombre VARCHAR(100),
      lat DECIMAL(10,7),
      lon DECIMAL(10,7)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mediciones (
      id SERIAL PRIMARY KEY,
      id_estacion VARCHAR(20) REFERENCES estaciones(id_estacion) ON DELETE CASCADE,
      fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ica INT,
      contaminante_principal VARCHAR(50)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_estacion_fecha ON mediciones(id_estacion, fecha_hora)`);

  await query(`
    CREATE TABLE IF NOT EXISTS preferencias_usuario (
      id SERIAL PRIMARY KEY,
      usuario_id INT UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estacion_favorita VARCHAR(20),
      umbral_alerta INT DEFAULT 100,
      notificaciones_activas BOOLEAN DEFAULT TRUE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS incidencias (
      id SERIAL PRIMARY KEY,
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      tipo VARCHAR(20) DEFAULT 'otro' CHECK (tipo IN ('dato_incorrecto','problema_tecnico','otro')),
      descripcion TEXT NOT NULL,
      estacion_relacionada VARCHAR(20),
      estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta','en_revision','resuelta')),
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS logs_actividad (
      id SERIAL PRIMARY KEY,
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      accion VARCHAR(255),
      fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
  CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_estacion VARCHAR(20) NOT NULL REFERENCES estaciones(id_estacion) ON DELETE CASCADE,
    fecha_añadido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, id_estacion)
  )
`);

  console.log('Tablas listas.');
}

module.exports = { pool, query, initDatabase };
