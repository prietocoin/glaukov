/**
 * @file server.js
 * @description Entrypoint con importaciones seguras de workers.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Carga segura de Workers (evita que un fallo en worker tumbe todo el servidor)
try {
  require('./src/workers/tasas.worker');
  console.log('[Workers ⚙️] tasas.worker iniciado.');
} catch (e) {
  console.warn('[Workers ⚠️] No se pudo cargar tasas.worker:', e.message);
}

try {
  require('./src/workers/liquidacion.worker');
  console.log('[Workers ⚙️] liquidacion.worker iniciado.');
} catch (e) {
  console.warn('[Workers ⚠️] No se pudo cargar liquidacion.worker:', e.message);
}

// 2. Importación de Enrutadores Modulares
const tasasRoutes = require('./src/modules/tasas/routes/tasasRoutes');
const sociosRoutes = require('./src/modules/socios/routes/sociosRoutes');
const comprobantesRoutes = require('./src/modules/comprobantes/routes/comprobantesRoutes');
const reportesRoutes = require('./src/modules/reportes/routes/reportesRoutes');
const adminRoutes = require('./src/modules/admin/routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Montaje de Rutas
app.use('/api/tasas', tasasRoutes);
app.use('/api/socios', sociosRoutes);
app.use('/api/comprobantes', comprobantesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'Glaukov Engine', timestamp: new Date() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Glaukov Engine 🦅] Motor activo en puerto ${PORT}`);
});
