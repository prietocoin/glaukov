/**
 * @file server.js
 * @description Punto de entrada principal y orquestador HTTP/Worker de Glaukov Engine.
 * Monta los enrutadores de micro-módulos y arranca los consumidores de colas.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Inicialización de Workers en Segundo Plano (BullMQ)
require('./src/workers/tasasWorker');
require('./src/workers/liquidacion.worker');

// 2. Importación de Enrutadores Modulares
const tasasRoutes = require('./src/modules/tasas/routes/tasasRoutes');
const sociosRoutes = require('./src/modules/socios/routes/sociosRoutes');
const comprobantesRoutes = require('./src/modules/comprobantes/routes/comprobantesRoutes');
const reportesRoutes = require('./src/modules/reportes/routes/reportesRoutes');
const adminRoutes = require('./src/modules/admin/routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos del Dashboard (public/index.html, logos, componentes)
app.use(express.static(path.join(__dirname, 'public')));

// 3. Montaje de Rutas por Dominio de Negocio
app.use('/api/tasas', tasasRoutes);
app.use('/api/socios', sociosRoutes);
app.use('/api/comprobantes', comprobantesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de Salud / Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'Glaukov Engine', timestamp: new Date() });
});

// Servir la SPA del Dashboard en cualquier otra ruta no encontrada
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Glaukov Engine 🦅] Motor activo en puerto ${PORT}`);
  console.log(`[Glaukov Engine] 📊 Dashboard: http://localhost:${PORT}`);
});
