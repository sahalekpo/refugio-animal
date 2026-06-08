const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const phpApi = require('./routes/phpApi');
const { ensureAdminUser } = require('./lib/seedAdmin');

const animalesRoutes = require('./routes/animales');
const adoptantesRoutes = require('./routes/adoptantes');
const empleadosRoutes = require('./routes/empleados');
const adopcionesRoutes = require('./routes/adopciones');
const reportesRoutes = require('./routes/reportes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'refugio-animales-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/api', phpApi);

app.use('/api/animales', animalesRoutes);
app.use('/api/adoptantes', adoptantesRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/adopciones', adopcionesRoutes);
app.use('/api/reportes', reportesRoutes);

app.use(express.static(path.join(__dirname, 'public')));

const paginasPublicas = ['certificado.html', 'usuario.html', 'login.html', 'configurar.html'];
app.get('*', (req, res, next) => {
  const pagina = req.path.replace(/^\//, '');
  if (paginasPublicas.includes(pagina)) {
    return res.sendFile(path.join(__dirname, 'public', pagina));
  }
  if (req.path.startsWith('/api/') || /\.\w+$/.test(req.path)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureAdminUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Refugio de Animales corriendo en http://localhost:${PORT}`);
      console.log('API PHP compatible activa en /api/*.php');
    });
  })
  .catch((err) => {
    console.error('Error al conectar MySQL:', err.message);
    process.exit(1);
  });
