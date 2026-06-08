const express = require('express');
const pool = require('../../config/db');
const {
  ESPECIES_PERMITIDAS, jsonResponse, requireAuth, requireFields, normalizeBody,
  calcularProximaVisita, emitirCertificadoCompleto, notificarPostulacionRechazada,
  notificarPostulacionAprobada, notificarApoyoAceptado, notificarApoyoRechazado, verifyCaptchaAndBot
} = require('../../lib/apiHelpers');
const { runDbMigrations } = require('../../lib/dbMigrations');

const router = express.Router();

// --- postulaciones.php ---
router.all('/postulaciones.php', async (req, res) => {
  try {
    const action = req.query.action || '';
    if (req.method === 'GET' && action === 'public') {
      const [rows] = await pool.query(`
        SELECT p.*, a.nombre AS animal, e.nombre_especie FROM postulaciones p
        INNER JOIN animales a ON p.id_animal = a.id_animal
        INNER JOIN especies e ON a.id_especie = e.id_especie
        WHERE p.estado_postulacion = 'Pendiente' ORDER BY p.fecha_postulacion DESC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const [rows] = await pool.query(`
        SELECT p.*, a.nombre AS animal, e.nombre_especie, es.nombre_estado FROM postulaciones p
        INNER JOIN animales a ON p.id_animal = a.id_animal
        INNER JOIN especies e ON a.id_especie = e.id_especie
        INNER JOIN estados es ON a.id_estado = es.id_estado
        ORDER BY p.fecha_postulacion DESC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST' && action === 'postular') {
      const captchaErr = verifyCaptchaAndBot(req, req.body);
      if (captchaErr) return jsonResponse(res, { error: captchaErr }, 403);
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['id_animal', 'nombres', 'apellidos', 'cedula', 'tipo_vivienda', 'tiene_patio', 'experiencia_mascotas', 'otras_mascotas', 'motivo_adopcion', 'acepta_visitas']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [animals] = await pool.query(`
        SELECT a.id_animal, a.nombre, es.nombre_estado, e.nombre_especie FROM animales a
        INNER JOIN estados es ON a.id_estado = es.id_estado
        INNER JOIN especies e ON a.id_especie = e.id_especie WHERE a.id_animal = ?`, [data.id_animal]);
      const animal = animals[0];
      if (!animal) return jsonResponse(res, { error: 'Animal no encontrado' }, 404);
      if (!ESPECIES_PERMITIDAS.includes(animal.nombre_especie)) return jsonResponse(res, { error: 'Solo se pueden adoptar perros y gatos' }, 400);
      if (animal.nombre_estado !== 'Disponible') return jsonResponse(res, { error: 'Este animal ya no está disponible para postulación' }, 400);
      await pool.query(`
        INSERT INTO postulaciones (id_animal, nombres, apellidos, cedula, telefono, correo, direccion,
          tipo_vivienda, tiene_patio, adultos_hogar, ninos_hogar, experiencia_mascotas, otras_mascotas,
          detalle_otras_mascotas, motivo_adopcion, tiempo_disponible, acepta_visitas)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [data.id_animal, data.nombres, data.apellidos, data.cedula, data.telefono || null, data.correo || null,
          data.direccion || null, data.tipo_vivienda, data.tiene_patio, data.adultos_hogar || 0, data.ninos_hogar || 0,
          data.experiencia_mascotas, data.otras_mascotas, data.detalle_otras_mascotas || null,
          data.motivo_adopcion, data.tiempo_disponible || null, data.acepta_visitas]);
      return jsonResponse(res, {
        message: 'Postulación enviada. Varias personas pueden postularse por el mismo animal; le notificaremos cuando se resuelva.',
        estado: 'Pendiente'
      }, 201);
    }
    if (req.method === 'POST' && action === 'aprobar') {
      if (!requireAuth(req, res)) return;
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['id_postulacion', 'id_empleado', 'frecuencia_visitas']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [posts] = await pool.query(`
        SELECT p.*, a.nombre AS animal FROM postulaciones p
        INNER JOIN animales a ON p.id_animal = a.id_animal WHERE p.id_postulacion = ?`, [data.id_postulacion]);
      const post = posts[0];
      if (!post) return jsonResponse(res, { error: 'Postulación no encontrada' }, 404);
      if (post.estado_postulacion !== 'Pendiente') return jsonResponse(res, { error: 'Esta postulación ya fue procesada' }, 400);
      const [existe] = await pool.query('SELECT id_adopcion FROM adopciones WHERE id_animal = ?', [post.id_animal]);
      if (existe.length) return jsonResponse(res, { error: 'Este animal ya tiene una adopción registrada' }, 400);
      const [otrasPendientes] = await pool.query(`
        SELECT * FROM postulaciones WHERE id_animal = ? AND id_postulacion != ? AND estado_postulacion = 'Pendiente'`,
        [post.id_animal, data.id_postulacion]);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [adoptantes] = await conn.query('SELECT id_adoptante FROM adoptantes WHERE cedula = ?', [post.cedula]);
        let idAdoptante;
        if (adoptantes.length) {
          idAdoptante = adoptantes[0].id_adoptante;
          await conn.query('UPDATE adoptantes SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=? WHERE id_adoptante=?',
            [post.nombres, post.apellidos, post.telefono, post.correo, post.direccion, idAdoptante]);
        } else {
          const [ins] = await conn.query('INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion) VALUES (?,?,?,?,?,?)',
            [post.nombres, post.apellidos, post.cedula, post.telefono, post.correo, post.direccion]);
          idAdoptante = ins.insertId;
        }
        const codigo = `CERT-${new Date().getFullYear()}-${String(data.id_postulacion).padStart(5, '0')}`;
        const fecha = new Date().toISOString().slice(0, 10);
        const proxima = calcularProximaVisita(fecha, data.frecuencia_visitas);
        const [adIns] = await conn.query(`
          INSERT INTO adopciones (id_animal, id_adoptante, id_empleado, fecha_adopcion, frecuencia_visitas, certificado_codigo, proxima_visita)
          VALUES (?,?,?,?,?,?,?)`,
          [post.id_animal, idAdoptante, data.id_empleado, fecha, data.frecuencia_visitas, codigo, proxima]);
        await conn.query('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada, estado) VALUES (?,?,?)',
          [adIns.insertId, proxima, 'Programada']);
        await conn.query("UPDATE postulaciones SET estado_postulacion = 'Aprobada' WHERE id_postulacion = ?", [data.id_postulacion]);
        await conn.query("UPDATE postulaciones SET estado_postulacion = 'Rechazada' WHERE id_animal = ? AND id_postulacion != ? AND estado_postulacion = 'Pendiente'",
          [post.id_animal, data.id_postulacion]);
        await conn.commit();
        const cert = await emitirCertificadoCompleto(codigo);
        const notificacionAprobada = notificarPostulacionAprobada(post, post.animal, codigo);
        const notificacionesRechazo = otrasPendientes.map((otra) =>
          notificarPostulacionRechazada(otra, post.animal, 'otra_aprobada')
        );
        return jsonResponse(res, {
          message: 'Adopción aprobada. El animal fue retirado del catálogo. Se notificó al adoptante y a las postulaciones canceladas.',
          certificado_codigo: codigo,
          portal_adoptante: 'usuario.html#mi-solicitud',
          correo_adoptante: post.correo || null,
          email: cert.email,
          notificacion_aprobada: notificacionAprobada,
          notificaciones_rechazo: notificacionesRechazo,
          rechazados_count: otrasPendientes.length
        }, 201);
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
    if (req.method === 'POST' && action === 'rechazar') {
      if (!requireAuth(req, res)) return;
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['id_postulacion']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [posts] = await pool.query(`
        SELECT p.*, a.nombre AS animal FROM postulaciones p
        INNER JOIN animales a ON p.id_animal = a.id_animal WHERE p.id_postulacion = ?`, [data.id_postulacion]);
      const post = posts[0];
      if (!post) return jsonResponse(res, { error: 'Postulación no encontrada' }, 404);
      if (post.estado_postulacion !== 'Pendiente') return jsonResponse(res, { error: 'Esta postulación ya fue procesada' }, 400);
      await pool.query("UPDATE postulaciones SET estado_postulacion = 'Rechazada' WHERE id_postulacion = ?", [data.id_postulacion]);
      const email = notificarPostulacionRechazada(post, post.animal, 'manual');
      return jsonResponse(res, {
        message: 'Postulación rechazada. El animal sigue disponible para otras solicitudes.',
        email
      });
    }
    jsonResponse(res, { error: 'Acción no válida' }, 400);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- vacunas.php ---
router.all('/vacunas.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = req.query.id || null;
    if (req.method === 'GET') {
      const [rows] = await pool.query(`
        SELECT v.*, a.nombre AS animal, e.nombre_especie FROM vacunas v
        INNER JOIN animales a ON v.id_animal = a.id_animal
        INNER JOIN especies e ON a.id_especie = e.id_especie ORDER BY v.fecha_proxima ASC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST') {
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['id_animal', 'nombre_vacuna', 'fecha_proxima']);
      if (err) return jsonResponse(res, { error: err }, 400);
      await pool.query(`
        INSERT INTO vacunas (id_animal, nombre_vacuna, fecha_aplicada, fecha_proxima, observaciones, estado) VALUES (?,?,?,?,?,?)`,
        [data.id_animal, data.nombre_vacuna, data.fecha_aplicada || null, data.fecha_proxima, data.observaciones || null, data.estado || 'Pendiente']);
      return jsonResponse(res, { message: 'Vacuna registrada' }, 201);
    }
    if (req.method === 'PUT' && id) {
      const data = req.body;
      await pool.query(`
        UPDATE vacunas SET nombre_vacuna=?, fecha_aplicada=?, fecha_proxima=?, observaciones=?, estado=? WHERE id_vacuna=?`,
        [data.nombre_vacuna, data.fecha_aplicada || null, data.fecha_proxima, data.observaciones || null, data.estado || 'Pendiente', id]);
      return jsonResponse(res, { message: 'Vacuna actualizada' });
    }
    if (req.method === 'DELETE' && id) {
      await pool.query('DELETE FROM vacunas WHERE id_vacuna = ?', [id]);
      return jsonResponse(res, { message: 'Vacuna eliminada' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- visitas.php ---
router.all('/visitas.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = req.query.id || null;
    if (req.method === 'GET') {
      const [rows] = await pool.query(`
        SELECT v.*, ad.certificado_codigo, an.nombre AS animal,
               CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante, ad.frecuencia_visitas
        FROM visitas_seguimiento v
        INNER JOIN adopciones ad ON v.id_adopcion = ad.id_adopcion
        INNER JOIN animales an ON ad.id_animal = an.id_animal
        INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
        ORDER BY v.fecha_programada ASC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'PUT' && id) {
      const data = req.body;
      await pool.query(`
        UPDATE visitas_seguimiento SET fecha_realizada=?, observaciones=?, estado=? WHERE id_visita=?`,
        [data.fecha_realizada || new Date().toISOString().slice(0, 10), data.observaciones || null, data.estado || 'Realizada', id]);
      if ((data.estado || '') === 'Realizada') {
        const [visita] = await pool.query('SELECT id_adopcion FROM visitas_seguimiento WHERE id_visita = ?', [id]);
        if (visita.length) {
          const [ad] = await pool.query('SELECT frecuencia_visitas FROM adopciones WHERE id_adopcion = ?', [visita[0].id_adopcion]);
          if (ad.length) {
            const proxima = calcularProximaVisita(data.fecha_realizada || new Date().toISOString().slice(0, 10), ad[0].frecuencia_visitas || 'Mensual');
            await pool.query('UPDATE adopciones SET proxima_visita = ? WHERE id_adopcion = ?', [proxima, visita[0].id_adopcion]);
            await pool.query('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada) VALUES (?,?)', [visita[0].id_adopcion, proxima]);
          }
        }
      }
      return jsonResponse(res, { message: 'Visita actualizada' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- apoyos.php ---
router.all('/apoyos.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    await runDbMigrations();
    const action = req.query.action || '';
    const id = parseInt(req.query.id || req.body?.id_donacion || req.body?.id_voluntariado || 0, 10);

    if (req.method === 'GET' && action === 'donaciones') {
      const [rows] = await pool.query(`
        SELECT d.*, a.nombre AS animal_nombre FROM donaciones d
        LEFT JOIN animales a ON d.id_animal = a.id_animal ORDER BY d.fecha_solicitud DESC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'GET' && action === 'voluntariados') {
      const [rows] = await pool.query('SELECT * FROM voluntariados ORDER BY fecha_solicitud DESC');
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST' && action === 'aceptar-donacion') {
      const donId = parseInt(req.body.id_donacion || req.query.id || 0, 10);
      const [rows] = await pool.query('SELECT d.*, a.nombre AS animal_nombre FROM donaciones d LEFT JOIN animales a ON d.id_animal = a.id_animal WHERE d.id_donacion = ?', [donId]);
      const row = rows[0];
      if (!row) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      if (!['Nueva', 'Contactada'].includes(row.estado)) return jsonResponse(res, { error: 'Esta solicitud ya fue procesada' }, 400);
      await pool.query("UPDATE donaciones SET estado = 'Aceptada' WHERE id_donacion = ?", [donId]);
      const tipo = row.tipo === 'Apadrinamiento' ? 'Apadrinamiento' : 'Donacion';
      return jsonResponse(res, { message: 'Solicitud aceptada.', email: notificarApoyoAceptado(tipo, row, row.animal_nombre) });
    }
    if (req.method === 'POST' && action === 'rechazar-donacion') {
      const donId = parseInt(req.body.id_donacion || req.query.id || 0, 10);
      const [rows] = await pool.query('SELECT * FROM donaciones WHERE id_donacion = ?', [donId]);
      if (!rows.length) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      if (!['Nueva', 'Contactada'].includes(rows[0].estado)) return jsonResponse(res, { error: 'Esta solicitud ya fue procesada' }, 400);
      await pool.query("UPDATE donaciones SET estado = 'Rechazada' WHERE id_donacion = ?", [donId]);
      const rowRech = rows[0];
      const tipoRech = rowRech.tipo === 'Apadrinamiento' ? 'Apadrinamiento' : 'Donacion';
      const [animalRow] = rowRech.id_animal
        ? await pool.query('SELECT nombre FROM animales WHERE id_animal = ?', [rowRech.id_animal])
        : [[]];
      return jsonResponse(res, {
        message: 'Solicitud rechazada.',
        email: notificarApoyoRechazado(tipoRech, rowRech, animalRow[0]?.nombre)
      });
    }
    if (req.method === 'POST' && action === 'aceptar-voluntariado') {
      const volId = parseInt(req.body.id_voluntariado || req.query.id || 0, 10);
      const [rows] = await pool.query('SELECT * FROM voluntariados WHERE id_voluntariado = ?', [volId]);
      if (!rows.length) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      if (!['Nueva', 'Contactada'].includes(rows[0].estado)) return jsonResponse(res, { error: 'Esta solicitud ya fue procesada' }, 400);
      await pool.query("UPDATE voluntariados SET estado = 'Activa' WHERE id_voluntariado = ?", [volId]);
      return jsonResponse(res, { message: 'Voluntariado aceptado.', email: notificarApoyoAceptado('Voluntariado', rows[0]) });
    }
    if (req.method === 'POST' && action === 'rechazar-voluntariado') {
      const volId = parseInt(req.body.id_voluntariado || req.query.id || 0, 10);
      const [rows] = await pool.query('SELECT * FROM voluntariados WHERE id_voluntariado = ?', [volId]);
      if (!rows.length) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      if (!['Nueva', 'Contactada'].includes(rows[0].estado)) return jsonResponse(res, { error: 'Esta solicitud ya fue procesada' }, 400);
      await pool.query("UPDATE voluntariados SET estado = 'Rechazada' WHERE id_voluntariado = ?", [volId]);
      return jsonResponse(res, { message: 'Voluntariado rechazado.', email: notificarApoyoRechazado('Voluntariado', rows[0]) });
    }
    if (req.method === 'DELETE' && action === 'donacion') {
      const [result] = await pool.query('DELETE FROM donaciones WHERE id_donacion = ?', [id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      return jsonResponse(res, { message: 'Solicitud eliminada' });
    }
    if (req.method === 'DELETE' && action === 'voluntariado') {
      const [result] = await pool.query('DELETE FROM voluntariados WHERE id_voluntariado = ?', [id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Solicitud no encontrada' }, 404);
      return jsonResponse(res, { message: 'Solicitud eliminada' });
    }
    jsonResponse(res, { error: 'Acción no válida' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

module.exports = router;
