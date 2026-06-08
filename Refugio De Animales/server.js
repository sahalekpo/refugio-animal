const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const animalesRoutes = require('./routes/animales');
const adoptantesRoutes = require('./routes/adoptantes');
const empleadosRoutes = require('./routes/empleados');
const adopcionesRoutes = require('./routes/adopciones');
const reportesRoutes = require('./routes/reportes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/animales', animalesRoutes);
app.use('/api/adoptantes', adoptantesRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/adopciones', adopcionesRoutes);
app.use('/api/reportes', reportesRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Refugio de Animales corriendo en http://localhost:${PORT}`);
});
