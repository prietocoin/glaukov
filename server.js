require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Inicializar Worker de Tasas (Consumidor BullMQ)
require('./src/workers/tasas.worker');

// 2. Rutas del módulo Atenea
const ateneaRoutes = require('./src/modules/atenea/routes/atenea.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Montaje de APIs
app.use('/api/v1/atenea', ateneaRoutes);

// Estado del servicio
app.get('/', (req, res) => {
  res.json({
    app: 'Glaukov Engine 🦅',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Glaukov 🦅] Motor activo en puerto ${PORT}`);
  console.log(`[Glaukov] 📊 Atenea API: http://localhost:${PORT}/api/v1/atenea`);
});
