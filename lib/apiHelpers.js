const ESPECIES_PERMITIDAS = ['Perro', 'Gato'];

function jsonResponse(res, data, code = 200) {
  return res.status(code).json(data);
}

function requireAuth(req, res) {
  if (!req.session?.userId) {
    jsonResponse(res, { error: 'Sesión no válida. Inicie sesión.', redirect: 'login.html' }, 401);
    return false;
  }
  return true;
}

function requireFields(data, fields) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return `Campo obligatorio: ${field}`;
    }
  }
  return null;
}

function normalizeBody(data) {
  const intFields = ['id_especie', 'id_estado', 'id_animal', 'id_adoptante', 'id_empleado', 'id_postulacion', 'edad', 'adultos_hogar', 'ninos_hogar'];
  for (const key of intFields) {
    if (data[key] !== undefined && data[key] !== '' && data[key] !== null) {
      data[key] = parseInt(data[key], 10);
    } else if (data[key] === '') {
      delete data[key];
    }
  }
  return data;
}

async function getEstadoId(pool, nombre) {
  const [rows] = await pool.query('SELECT id_estado FROM estados WHERE nombre_estado = ?', [nombre]);
  return rows[0] ? rows[0].id_estado : 1;
}

async function fotosAnimal(pool, idAnimal) {
  const [rows] = await pool.query(
    'SELECT id_foto, ruta, orden FROM animal_fotos WHERE id_animal = ? ORDER BY orden, id_foto',
    [idAnimal]
  );
  return rows;
}

async function guardarFotosAnimal(pool, idAnimal, rutas) {
  if (!rutas?.length) return;
  let orden = 0;
  for (const ruta of rutas) {
    if (!ruta) continue;
    await pool.query('INSERT INTO animal_fotos (id_animal, ruta, orden) VALUES (?, ?, ?)', [idAnimal, ruta, orden++]);
    if (orden === 1) {
      await pool.query('UPDATE animales SET foto = ? WHERE id_animal = ?', [ruta, idAnimal]);
    }
  }
}

function perfilAnimalDesdeBody(data) {
  const pick = (val, allowed, fallback) => (allowed.includes(val) ? val : fallback);
  return {
    vacunado: pick(data.vacunado ?? 'No', ['Si', 'No'], 'No'),
    esterilizado: pick(data.esterilizado ?? 'No', ['Si', 'No'], 'No'),
    desparasitado: pick(data.desparasitado ?? 'No', ['Si', 'No'], 'No'),
    compatible_ninos: pick(data.compatible_ninos ?? 'Desconocido', ['Si', 'No', 'Desconocido'], 'Desconocido'),
    compatible_mascotas: pick(data.compatible_mascotas ?? 'Desconocido', ['Si', 'No', 'Desconocido'], 'Desconocido'),
    nivel_energia: pick(data.nivel_energia ?? 'Media', ['Baja', 'Media', 'Alta'], 'Media')
  };
}

function calcularProximaVisita(fecha, frecuencia) {
  const d = new Date(fecha);
  switch (frecuencia) {
    case 'Semanal': d.setDate(d.getDate() + 7); break;
    case 'Quincenal': d.setDate(d.getDate() + 14); break;
    case 'Trimestral': d.setMonth(d.getMonth() + 3); break;
    case 'Mensual':
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

async function emitirCertificadoCompleto(codigo) {
  const { emitirCertificadoCompleto: emitir } = require('./certificadoService');
  return emitir(codigo);
}

function notificarPostulacionRechazada(post, animalNombre, motivo = 'manual') {
  const nombre = `${post.nombres || ''} ${post.apellidos || ''}`.trim();
  const correo = post.correo || '';
  const msg = motivo === 'otra_aprobada'
    ? `Se notificó a ${nombre || 'el postulante'} que su postulación por ${animalNombre} no fue seleccionada (otra solicitud fue aprobada).`
    : `Se notificó a ${nombre || 'el postulante'} que su postulación por ${animalNombre} fue rechazada.`;
  return {
    sent: !!correo,
    message: correo ? `${msg} Correo: ${correo}` : `${msg} Sin correo registrado — puede consultar en Mi solicitud con su cédula.`
  };
}

function notificarPostulacionAprobada(post, animalNombre, certificadoCodigo) {
  const nombre = `${post.nombres || ''} ${post.apellidos || ''}`.trim();
  const correo = post.correo || '';
  return {
    sent: !!correo,
    message: correo
      ? `¡Felicitaciones ${nombre}! Adopción de ${animalNombre} aprobada. Certificado: ${certificadoCodigo}. Se enviará aviso a ${correo}.`
      : `¡Felicitaciones ${nombre}! Adopción de ${animalNombre} aprobada. Certificado: ${certificadoCodigo}. Consulte en Mi solicitud con su cédula.`
  };
}

function notificarApoyoAceptado(tipo, row, animalNombre) {
  const nombre = row.nombres || '';
  const correo = row.correo || '';
  const detalle = tipo === 'Apadrinamiento' && animalNombre ? ` para ${animalNombre}` : '';
  return {
    sent: !!correo,
    message: correo
      ? `Solicitud de ${tipo}${detalle} aceptada. Se contactará a ${nombre} en ${correo}.`
      : `Solicitud de ${tipo}${detalle} aceptada para ${nombre}.`
  };
}

function notificarApoyoRechazado(tipo, row, animalNombre) {
  const nombre = row.nombres || '';
  const correo = row.correo || '';
  const detalle = tipo === 'Apadrinamiento' && animalNombre ? ` para ${animalNombre}` : '';
  return {
    sent: !!correo,
    message: correo
      ? `Solicitud de ${tipo}${detalle} rechazada. Se avisará a ${correo}.`
      : `Solicitud de ${tipo}${detalle} rechazada para ${nombre}.`
  };
}

function verifyCaptchaAndBot(req, data) {
  if (data.website) return 'Solicitud bloqueada (antibot).';
  if (!req.session?.captchaVerified ||
      Date.now() - (req.session.captchaVerifiedAt || 0) > 900000) {
    return 'Debe completar la verificación antibot.';
  }
  delete req.session.captchaVerified;
  return null;
}

module.exports = {
  ESPECIES_PERMITIDAS,
  jsonResponse,
  requireAuth,
  requireFields,
  normalizeBody,
  getEstadoId,
  fotosAnimal,
  guardarFotosAnimal,
  perfilAnimalDesdeBody,
  calcularProximaVisita,
  emitirCertificadoCompleto,
  notificarPostulacionRechazada,
  notificarPostulacionAprobada,
  notificarApoyoAceptado,
  notificarApoyoRechazado,
  verifyCaptchaAndBot
};
