require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDatabase } = require('./db/database');
const { sincronizarEstacionesEspana } = require('./services/waqiService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/aire',        require('./routes/aire'));
app.use('/api/usuario',     require('./routes/usuario'));
app.use('/api/incidencias', require('./routes/incidencias'));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

async function start() {
  try {
    await initDatabase();

    try {
      await sincronizarEstacionesEspana();
    } catch (e) {
      console.warn('Sincronización inicial WAQI fallida (normal con token demo):', e.message);
    }

    cron.schedule('0 * * * *', async () => {
      console.log('Cron: sincronizando estaciones...');
      try { await sincronizarEstacionesEspana(); }
      catch (e) { console.error('Error en cron:', e.message); }
    });

    app.listen(PORT, () => {
      console.log(`\nAire-OK API corriendo en http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('Error fatal al iniciar:', err);
    process.exit(1);
  }
}

start();
