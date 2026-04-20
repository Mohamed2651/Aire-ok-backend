const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const conn = await pool.getConnection();
  try {
    console.log('Conectado a MySQL. Inicializando tablas...');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rol ENUM('invitado','registrado','admin') DEFAULT 'registrado'
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS estaciones (
        id_estacion VARCHAR(20) PRIMARY KEY,
        nombre VARCHAR(100),
        lat DECIMAL(10,7),
        lon DECIMAL(10,7)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS mediciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_estacion VARCHAR(20),
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        ica INT,
        contaminante_principal VARCHAR(50),
        FOREIGN KEY (id_estacion) REFERENCES estaciones(id_estacion) ON DELETE CASCADE,
        INDEX idx_estacion_fecha (id_estacion, fecha_hora)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS preferencias_usuario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL UNIQUE,
        estacion_favorita VARCHAR(20),
        umbral_alerta INT DEFAULT 100,
        notificaciones_activas BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS incidencias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT,
        tipo ENUM('dato_incorrecto','problema_tecnico','otro') DEFAULT 'otro',
        descripcion TEXT NOT NULL,
        estacion_relacionada VARCHAR(20),
        estado ENUM('abierta','en_revision','resuelta') DEFAULT 'abierta',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS logs_actividad (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT,
        accion VARCHAR(255),
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    console.log('Tablas listas.');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDatabase };
