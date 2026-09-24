require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Inicializar Worker de Tasas (Consumidor BullMQ para WhatsApp)
require('./src/jobs/tasas.worker'); // ✅ Ruta corregida a src/jobs/

// 2. Cargar enrutador modular de Atenea
const ateneaRoutes = require('./src/modules/atenea/routes/atenea.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del Dashboard (public/index.html, logos, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Montaje de APIs del módulo Atenea
app.use('/api/v1/atenea', ateneaRoutes);

// Compatibilidad con rutas directas (/api/comprobantes, /api/directorio, etc.)
app.use('/api', ateneaRoutes);

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
