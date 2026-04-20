const axios = require('axios');
const { pool } = require('../db/database');

const WAQI_BASE = 'https://api.waqi.info';
const SPAIN_BOUNDS = '27.6,-18.2,43.8,4.4';

function nivelICA(aqi) {
  if (aqi === null || aqi === undefined || aqi === '-') return { nivel: 'sin_datos', color: '#9E9E9E' };
  const v = parseInt(aqi);
  if (v <= 50)  return { nivel: 'bueno',                    color: '#4CAF50' };
  if (v <= 100) return { nivel: 'moderado',                 color: '#FFEB3B' };
  if (v <= 150) return { nivel: 'no_saludable_sensibles',   color: '#FF9800' };
  if (v <= 200) return { nivel: 'no_saludable',             color: '#F44336' };
  if (v <= 300) return { nivel: 'muy_no_saludable',         color: '#9C27B0' };
  return         { nivel: 'peligroso',                      color: '#7B0000' };
}

function parsearEstacion(item) {
  const aqi = item.aqi !== '-' ? parseInt(item.aqi) : null;
  return {
    id_estacion: String(item.uid),
    nombre: item.station?.name ?? 'Estación desconocida',
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    ica: aqi,
    ...nivelICA(aqi),
    ultima_actualizacion: item.station?.time ?? null
  };
}

function parsearDetalle(data) {
  const aqi = data.aqi !== '-' ? parseInt(data.aqi) : null;
  const iaqi = data.iaqi ?? {};
  return {
    id_estacion: String(data.idx),
    nombre: data.city?.name ?? 'Estación desconocida',
    lat: data.city?.geo?.[0] ?? null,
    lon: data.city?.geo?.[1] ?? null,
    ica: aqi,
    ...nivelICA(aqi),
    contaminantes: {
      pm25: iaqi.pm25?.v ?? null,
      pm10: iaqi.pm10?.v ?? null,
      no2:  iaqi.no2?.v  ?? null,
      o3:   iaqi.o3?.v   ?? null,
      so2:  iaqi.so2?.v  ?? null,
      co:   iaqi.co?.v   ?? null
    },
    temperatura: iaqi.t?.v ?? null,
    humedad:     iaqi.h?.v ?? null,
    dominante:   data.dominentpol ?? null,
    ultima_actualizacion: data.time?.iso ?? null,
    forecast: data.forecast?.daily ?? null
  };
}

async function obtenerEstacionesEspana() {
  const url = `${WAQI_BASE}/map/bounds/?latlng=${SPAIN_BOUNDS}&token=${process.env.WAQI_TOKEN}`;
  const response = await axios.get(url, { timeout: 15000 });
  if (response.data.status !== 'ok') throw new Error(response.data.data);
  return response.data.data.map(parsearEstacion);
}

async function obtenerDetalleEstacion(uid) {
  const url = `${WAQI_BASE}/feed/@${uid}/?token=${process.env.WAQI_TOKEN}`;
  const response = await axios.get(url, { timeout: 10000 });
  if (response.data.status !== 'ok') throw new Error(response.data.data);
  return parsearDetalle(response.data.data);
}

async function obtenerEstacionCercana(lat, lon) {
  const url = `${WAQI_BASE}/feed/geo:${lat};${lon}/?token=${process.env.WAQI_TOKEN}`;
  const response = await axios.get(url, { timeout: 10000 });
  if (response.data.status !== 'ok') throw new Error(response.data.data);
  return parsearDetalle(response.data.data);
}

async function buscarEstacion(query) {
  const url = `${WAQI_BASE}/search/?keyword=${encodeURIComponent(query)}&token=${process.env.WAQI_TOKEN}`;
  const response = await axios.get(url, { timeout: 10000 });
  if (response.data.status !== 'ok') return [];
  return response.data.data.map(item => ({
    uid:    item.uid,
    nombre: item.station?.name ?? '',
    aqi:    item.aqi !== '-' ? parseInt(item.aqi) : null,
    lat:    item.station?.geo?.[0] ?? null,
    lon:    item.station?.geo?.[1] ?? null
  }));
}

async function sincronizarEstacionesEspana() {
  console.log('Sincronizando estaciones de España desde WAQI...');
  const estaciones = await obtenerEstacionesEspana();
  let actualizadas = 0;

  for (const e of estaciones) {
    if (!e.lat || !e.lon) continue;
    try {
      await pool.execute(
        `INSERT INTO estaciones (id_estacion, nombre, lat, lon)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), lat=VALUES(lat), lon=VALUES(lon)`,
        [e.id_estacion, e.nombre, e.lat, e.lon]
      );
      if (e.ica !== null) {
        await pool.execute(
          `INSERT INTO mediciones (id_estacion, fecha_hora, ica, contaminante_principal)
           VALUES (?, NOW(), ?, 'AQI')`,
          [e.id_estacion, e.ica]
        );
      }
      actualizadas++;
    } catch (_) {}
  }

  console.log(`WAQI: ${actualizadas} estaciones sincronizadas.`);
  return actualizadas;
}

module.exports = {
  obtenerEstacionesEspana,
  obtenerDetalleEstacion,
  obtenerEstacionCercana,
  buscarEstacion,
  sincronizarEstacionesEspana,
  nivelICA
};
