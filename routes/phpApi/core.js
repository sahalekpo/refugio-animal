const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../config/db');
const {
  ESPECIES_PERMITIDAS, jsonResponse, requireAuth, requireFields, normalizeBody,
  getEstadoId, fotosAnimal, guardarFotosAnimal, perfilAnimalDesdeBody,
  calcularProximaVisita, emitirCertificadoCompleto, notificarPostulacionRechazada,
  notificarApoyoAceptado, notificarApoyoRechazado, verifyCaptchaAndBot
} = require('../../lib/apiHelpers');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `animal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}${ext.toLowerCase()}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype));
  }
});

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash.replace(/^\$2y\$/, '$2a$'));
}

async function assertEspeciePermitida(idEspecie) {
  const [rows] = await pool.query('SELECT nombre_especie FROM especies WHERE id_especie = ?', [idEspecie]);
  if (!rows.length || !ESPECIES_PERMITIDAS.includes(rows[0].nombre_especie)) {
    throw new Error('Solo se permiten perros y gatos');
  }
}

// --- auth.php ---
router.all('/auth.php', async (req, res) => {
  try {
    const action = req.query.action || '';
    if (req.method === 'GET' && action === 'check') {
      if (req.session?.userId) {
        return jsonResponse(res, { authenticated: true, user: req.session.user });
      }
      return jsonResponse(res, { authenticated: false });
    }
    if (req.method === 'POST' && action === 'login') {
      const err = requireFields(req.body, ['usuario', 'contrasena']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [users] = await pool.query('SELECT * FROM usuarios WHERE usuario = ?', [req.body.usuario]);
      const user = users[0];
      if (!user || !verifyPassword(req.body.contrasena, user.contrasena)) {
        return jsonResponse(res, { error: 'Usuario o contraseña incorrectos' }, 401);
      }
      req.session.userId = user.id_usuario;
      req.session.user = { id: user.id_usuario, usuario: user.usuario, rol: user.rol };
      return jsonResponse(res, { message: 'Sesión iniciada', user: req.session.user });
    }
    if (req.method === 'POST' && action === 'logout') {
      req.session.destroy(() => jsonResponse(res, { message: 'Sesión cerrada' }));
      return;
    }
    jsonResponse(res, { error: 'Acción no válida' }, 400);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- reportes.php ---
router.all('/reportes.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const action = req.query.action || 'dashboard';
    if (action === 'dashboard') {
      let total = 0;
      try {
        const [[row]] = await pool.query('SELECT fn_total_adopciones() AS total');
        total = row.total;
      } catch {
        const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM adopciones');
        total = row.total;
      }
      const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM animales');
      const [[d]] = await pool.query(`SELECT COUNT(*) AS n FROM animales a INNER JOIN estados e ON a.id_estado=e.id_estado WHERE e.nombre_estado='Disponible'`);
      const [[ad]] = await pool.query('SELECT COUNT(*) AS n FROM adoptantes');
      const [[em]] = await pool.query('SELECT COUNT(*) AS n FROM empleados');
      const [[po]] = await pool.query("SELECT COUNT(*) AS n FROM postulaciones WHERE estado_postulacion='Pendiente'");
      const [[va]] = await pool.query("SELECT COUNT(*) AS n FROM vacunas WHERE fecha_proxima <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) AND estado != 'Aplicada'");
      return jsonResponse(res, {
        total_adopciones: total,
        total_animales: a.n,
        animales_disponibles: d.n,
        total_adoptantes: ad.n,
        total_empleados: em.n,
        postulaciones_pendientes: po.n,
        vacunas_alertas: va.n
      });
    }
    if (action === 'animales-disponibles') {
      const [rows] = await pool.query('SELECT * FROM vw_animales_disponibles');
      return jsonResponse(res, rows);
    }
    if (action === 'historial-adopciones') {
      const [rows] = await pool.query('SELECT * FROM vw_historial_adopciones ORDER BY fecha_adopcion DESC');
      return jsonResponse(res, rows);
    }
    jsonResponse(res, { error: 'Acción no válida' }, 400);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- alertas.php ---
router.all('/alertas.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const [[{ n: postulaciones }]] = await pool.query("SELECT COUNT(*) AS n FROM postulaciones WHERE estado_postulacion = 'Pendiente'");
    const [vacunas] = await pool.query(`
      SELECT v.*, a.nombre AS animal FROM vacunas v
      INNER JOIN animales a ON v.id_animal = a.id_animal
      WHERE v.fecha_proxima <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) AND v.estado != 'Aplicada'
      ORDER BY v.fecha_proxima ASC LIMIT 20`);
    const [visitas] = await pool.query(`
      SELECT v.id_visita, v.fecha_programada, an.nombre AS animal,
             CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante
      FROM visitas_seguimiento v
      INNER JOIN adopciones ad ON v.id_adopcion = ad.id_adopcion
      INNER JOIN animales an ON ad.id_animal = an.id_animal
      INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
      WHERE v.estado = 'Programada' AND v.fecha_programada <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY v.fecha_programada ASC LIMIT 15`);
    jsonResponse(res, {
      postulaciones_pendientes: postulaciones,
      vacunas_proximas: vacunas,
      visitas_proximas: visitas,
      total_alertas: postulaciones + vacunas.length + visitas.length
    });
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- publico.php ---
router.all('/publico.php', async (req, res) => {
  try {
    const action = req.query.action || '';
    if (req.method === 'GET' && action === 'animales') {
      const [rows] = await pool.query(`
        SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
               a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado,
               a.vacunado, a.esterilizado, a.desparasitado,
               a.compatible_ninos, a.compatible_mascotas, a.nivel_energia
        FROM animales a
        INNER JOIN especies e ON a.id_especie = e.id_especie
        INNER JOIN estados es ON a.id_estado = es.id_estado
        WHERE es.nombre_estado = 'Disponible' AND e.nombre_especie IN ('Perro', 'Gato')
        ORDER BY a.fecha_ingreso DESC`);
      const hoy = new Date();
      for (const r of rows) {
        r.fotos = await fotosAnimal(pool, r.id_animal);
        if (!r.fotos.length && r.foto) r.fotos = [{ ruta: r.foto, orden: 0 }];
        const ingreso = new Date(r.fecha_ingreso);
        r.dias_ingreso = Math.floor((hoy - ingreso) / 86400000);
        r.es_nuevo = r.dias_ingreso <= 30;
        r.tiene_fotos = r.fotos.length > 0;
        r.destacado = r.es_nuevo || r.tiene_fotos;
      }
      let destacados = rows.filter((x) => x.destacado);
      destacados = destacados.length ? destacados.slice(0, 8) : rows.slice(0, 6);
      let nuevos = rows.filter((x) => x.es_nuevo);
      if (!nuevos.length) nuevos = rows.slice(0, Math.min(6, rows.length));
      return jsonResponse(res, { todos: rows, destacados, nuevos, total: rows.length });
    }
    if (req.method === 'GET' && action === 'adoptados') {
      const [rows] = await pool.query(`
        SELECT a.id_animal, a.nombre, a.descripcion, a.foto, a.raza,
               e.nombre_especie, ad.fecha_adopcion
        FROM animales a
        INNER JOIN especies e ON a.id_especie = e.id_especie
        INNER JOIN estados es ON a.id_estado = es.id_estado
        INNER JOIN adopciones ad ON ad.id_animal = a.id_animal
        WHERE es.nombre_estado = 'Adoptado' AND e.nombre_especie IN ('Perro', 'Gato')
        ORDER BY ad.fecha_adopcion DESC LIMIT 12`);
      for (const r of rows) {
        r.fotos = await fotosAnimal(pool, r.id_animal);
        if (!r.fotos.length && r.foto) r.fotos = [{ ruta: r.foto, orden: 0 }];
      }
      return jsonResponse(res, rows);
    }
    if (req.method === 'GET' && action === 'hero-imagenes') {
      const images = [];
      const heroDir = path.join(__dirname, '../../public/img/hero');
      if (fs.existsSync(heroDir)) {
        for (const f of fs.readdirSync(heroDir)) {
          if (/\.(jpg|jpeg|png|webp|gif)$/i.test(f)) images.push(`img/hero/${f}`);
        }
      }
      images.sort();
      if (images.length < 3) {
        const [rows] = await pool.query(`
          SELECT DISTINCT COALESCE(af.ruta, a.foto) AS ruta FROM animales a
          LEFT JOIN animal_fotos af ON af.id_animal = a.id_animal
          INNER JOIN estados es ON a.id_estado = es.id_estado
          WHERE (af.ruta IS NOT NULL OR a.foto IS NOT NULL)
          ORDER BY a.fecha_ingreso DESC LIMIT 12`);
        for (const r of rows) {
          if (r.ruta && !images.includes(r.ruta)) images.push(r.ruta);
        }
      }
      return jsonResponse(res, { imagenes: images });
    }
    if (req.method === 'GET' && action === 'stats') {
      const [[d]] = await pool.query(`SELECT COUNT(*) AS n FROM animales a INNER JOIN estados e ON a.id_estado=e.id_estado WHERE e.nombre_estado='Disponible'`);
      const [[ad]] = await pool.query(`SELECT COUNT(*) AS n FROM animales a INNER JOIN estados e ON a.id_estado=e.id_estado WHERE e.nombre_estado='Adoptado'`);
      const [[t]] = await pool.query('SELECT COUNT(*) AS n FROM animales');
      const [[p]] = await pool.query('SELECT COUNT(*) AS n FROM postulaciones');
      return jsonResponse(res, { disponibles: d.n, adoptados: ad.n, total_animales: t.n, postulaciones: p.n });
    }
    if (req.method === 'GET' && action === 'info') {
      const [rows] = await pool.query('SELECT * FROM refugio_info WHERE id = 1');
      return jsonResponse(res, rows[0] || {});
    }
    if (req.method === 'GET' && action === 'mi-solicitud') {
      const cedula = (req.query.cedula || '').trim();
      if (!cedula) return jsonResponse(res, { error: 'Ingrese su número de cédula' }, 400);
      const [rows] = await pool.query(`
        SELECT p.id_postulacion, p.estado_postulacion, p.fecha_postulacion,
               p.nombres, p.apellidos, a.nombre AS animal, e.nombre_especie,
               ad.certificado_codigo, ad.fecha_adopcion, ad.proxima_visita
        FROM postulaciones p
        INNER JOIN animales a ON p.id_animal = a.id_animal
        INNER JOIN especies e ON a.id_especie = e.id_especie
        LEFT JOIN adopciones ad ON ad.id_animal = p.id_animal
        WHERE p.cedula = ? ORDER BY p.fecha_postulacion DESC`, [cedula]);
      for (const r of rows) {
        if (r.estado_postulacion === 'Aprobada' && r.certificado_codigo) {
          const cod = String(r.certificado_codigo).trim();
          r.certificado_codigo = cod;
          r.certificado_url = `certificado.html?codigo=${encodeURIComponent(cod)}`;
          r.certificado_pdf = `api/certificado_pdf.php?codigo=${encodeURIComponent(cod)}`;
          r.certificado_link = `${r.certificado_url}`;
        }
      }
      return jsonResponse(res, { cedula, postulaciones: rows });
    }
    if (req.method === 'POST' && action === 'donacion') {
      const err = requireFields(req.body, ['nombres', 'tipo']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const tipo = ['Donacion', 'Apadrinamiento'].includes(req.body.tipo) ? req.body.tipo : 'Donacion';
      const idAnimal = req.body.id_animal ? parseInt(req.body.id_animal, 10) : null;
      await pool.query(`
        INSERT INTO donaciones (tipo, nombres, correo, telefono, monto_sugerido, id_animal, mensaje)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tipo, req.body.nombres.trim(), req.body.correo || null, req.body.telefono || null,
          req.body.monto_sugerido || null, tipo === 'Apadrinamiento' ? idAnimal : null, req.body.mensaje || null]);
      return jsonResponse(res, { message: tipo === 'Apadrinamiento' ? 'Solicitud de apadrinamiento recibida. Nos pondremos en contacto pronto.' : 'Gracias por tu interés en apoyar al refugio. Te contactaremos pronto.' }, 201);
    }
    if (req.method === 'POST' && action === 'voluntariado') {
      const err = requireFields(req.body, ['nombres', 'apellidos', 'correo', 'disponibilidad', 'areas_interes']);
      if (err) return jsonResponse(res, { error: err }, 400);
      await pool.query(`
        INSERT INTO voluntariados (nombres, apellidos, correo, telefono, disponibilidad, areas_interes, experiencia, mensaje)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.body.nombres.trim(), req.body.apellidos.trim(), req.body.correo.trim(),
          req.body.telefono || null, req.body.disponibilidad.trim(), req.body.areas_interes.trim(),
          req.body.experiencia || null, req.body.mensaje || null]);
      return jsonResponse(res, { message: '¡Gracias por ofrecer tu tiempo! Revisaremos tu solicitud y te contactaremos.' }, 201);
    }
    jsonResponse(res, { error: 'Acción no válida' }, 400);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- captcha.php ---
router.all('/captcha.php', (req, res) => {
  if (req.method === 'GET') {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    req.session.captchaAnswer = a + b;
    req.session.captchaTime = Date.now();
    return jsonResponse(res, { pregunta: `¿Cuánto es ${a} + ${b}?`, token: Math.random().toString(16).slice(2, 18) });
  }
  if (req.method === 'POST') {
    const answer = parseInt(req.body.respuesta ?? -1, 10);
    const expected = req.session.captchaAnswer;
    const time = req.session.captchaTime || 0;
    if (!expected || Date.now() - time > 600000) {
      return jsonResponse(res, { valid: false, error: 'Captcha expirado. Recargue e intente de nuevo.' }, 400);
    }
    if (answer !== expected) {
      return jsonResponse(res, { valid: false, error: 'Respuesta incorrecta del antibot.' }, 400);
    }
    req.session.captchaVerified = true;
    req.session.captchaVerifiedAt = Date.now();
    delete req.session.captchaAnswer;
    return jsonResponse(res, { valid: true });
  }
  jsonResponse(res, { error: 'Método no permitido' }, 405);
});

// --- upload.php ---
router.post('/upload.php', (req, res) => {
  if (!requireAuth(req, res)) return;
  upload.any()(req, res, (err) => {
    if (err) return jsonResponse(res, { error: err.message }, 400);
    const uploaded = (req.files || []).map((f) => `uploads/${f.filename}`);
    if (!uploaded.length) return jsonResponse(res, { error: 'No se recibieron imágenes válidas' }, 400);
    jsonResponse(res, { fotos: uploaded, foto: uploaded[0], message: `${uploaded.length} imagen(es) subida(s)` });
  });
});

module.exports = router;
