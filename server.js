require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Inicializar Worker de Tasas (Consumidor BullMQ)
require('./src/workers/tasas.worker');

// 2. Rutas del módulo Atenea
const ateneaRoutes = require('./src/modules/atenea/routes/atenea.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del Dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Montaje de APIs
app.use('/api/v1/atenea', ateneaRoutes);

// Servir la interfaz del Dashboard en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Glaukov 🦅] Motor activo en puerto ${PORT}`);
  console.log(`[Glaukov] 📊 Dashboard: http://localhost:${PORT}`);
});
