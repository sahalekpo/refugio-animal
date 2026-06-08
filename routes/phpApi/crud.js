const express = require('express');
const pool = require('../../config/db');
const {
  ESPECIES_PERMITIDAS, jsonResponse, requireAuth, requireFields, normalizeBody,
  getEstadoId, fotosAnimal, guardarFotosAnimal, perfilAnimalDesdeBody,
  calcularProximaVisita, emitirCertificadoCompleto, notificarPostulacionRechazada,
  notificarApoyoAceptado, notificarApoyoRechazado, verifyCaptchaAndBot
} = require('../../lib/apiHelpers');

const router = express.Router();

async function assertEspeciePermitida(idEspecie) {
  const [rows] = await pool.query('SELECT nombre_especie FROM especies WHERE id_especie = ?', [idEspecie]);
  if (!rows.length || !ESPECIES_PERMITIDAS.includes(rows[0].nombre_especie)) {
    throw new Error('Solo se permiten perros y gatos');
  }
}

// --- animales.php ---
router.all('/animales.php', async (req, res) => {
  try {
    const action = req.query.action || null;
    const id = req.query.id || null;

    if (action === 'especies' && req.method === 'GET') {
      const [rows] = await pool.query(
        `SELECT * FROM especies WHERE nombre_especie IN (?, ?) ORDER BY nombre_especie`,
        ESPECIES_PERMITIDAS
      );
      return jsonResponse(res, rows);
    }
    if (action === 'estados' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const [rows] = await pool.query('SELECT * FROM estados ORDER BY nombre_estado');
      return jsonResponse(res, rows);
    }
    if (action === 'fotos' && req.method === 'GET' && id) {
      return jsonResponse(res, await fotosAnimal(pool, id));
    }
    if (action === 'disponibles' && req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM vw_animales_disponibles ORDER BY fecha_ingreso DESC');
      for (const r of rows) {
        r.fotos = await fotosAnimal(pool, r.id_animal);
        if (!r.fotos.length && r.foto) r.fotos = [{ ruta: r.foto, orden: 0 }];
      }
      return jsonResponse(res, rows);
    }
    if (action === 'adoptados' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const [rows] = await pool.query('SELECT * FROM vw_animales_adoptados ORDER BY fecha_adopcion DESC');
      return jsonResponse(res, rows);
    }
    if (req.method === 'GET' && id) {
      if (!req.query.public && !requireAuth(req, res)) return;
      const [rows] = await pool.query(`
        SELECT a.*, e.nombre_especie, es.nombre_estado FROM animales a
        INNER JOIN especies e ON a.id_especie = e.id_especie
        INNER JOIN estados es ON a.id_estado = es.id_estado WHERE a.id_animal = ?`, [id]);
      if (!rows.length) return jsonResponse(res, { error: 'Animal no encontrado' }, 404);
      rows[0].fotos = await fotosAnimal(pool, id);
      return jsonResponse(res, rows[0]);
    }
    if (req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const [rows] = await pool.query(`
        SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
               a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado, a.id_especie, a.id_estado
        FROM animales a
        INNER JOIN especies e ON a.id_especie = e.id_especie
        INNER JOIN estados es ON a.id_estado = es.id_estado
        ORDER BY a.fecha_ingreso DESC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['nombre', 'id_especie', 'sexo', 'fecha_ingreso']);
      if (err) return jsonResponse(res, { error: err }, 400);
      await assertEspeciePermitida(data.id_especie);
      const idDisponible = await getEstadoId(pool, 'Disponible');
      const perfil = perfilAnimalDesdeBody(data);
      const [result] = await pool.query(`
        INSERT INTO animales (nombre, id_especie, raza, sexo, edad, fecha_ingreso, descripcion, id_estado, foto,
          vacunado, esterilizado, desparasitado, compatible_ninos, compatible_mascotas, nivel_energia)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.nombre, data.id_especie, data.raza || null, data.sexo, data.edad ?? null,
          data.fecha_ingreso, data.descripcion || null, idDisponible, null,
          perfil.vacunado, perfil.esterilizado, perfil.desparasitado,
          perfil.compatible_ninos, perfil.compatible_mascotas, perfil.nivel_energia]);
      const idAnimal = result.insertId;
      let fotos = data.fotos || [];
      if (data.foto) fotos = [data.foto, ...fotos];
      await guardarFotosAnimal(pool, idAnimal, fotos);
      return jsonResponse(res, { message: 'Animal registrado correctamente', id_animal: idAnimal }, 201);
    }
    if (req.method === 'PUT' && id) {
      if (!requireAuth(req, res)) return;
      const data = normalizeBody({ ...req.body });
      if (data.id_especie) await assertEspeciePermitida(data.id_especie);
      const perfil = perfilAnimalDesdeBody(data);
      await pool.query(`
        UPDATE animales SET nombre=?, id_especie=?, raza=?, sexo=?, edad=?, fecha_ingreso=?, descripcion=?, id_estado=?,
          vacunado=?, esterilizado=?, desparasitado=?, compatible_ninos=?, compatible_mascotas=?, nivel_energia=?
        WHERE id_animal=?`,
        [data.nombre, data.id_especie, data.raza || null, data.sexo, data.edad ?? null,
          data.fecha_ingreso, data.descripcion || null, data.id_estado,
          perfil.vacunado, perfil.esterilizado, perfil.desparasitado,
          perfil.compatible_ninos, perfil.compatible_mascotas, perfil.nivel_energia, id]);
      if (Array.isArray(data.fotos) && data.fotos.length) {
        await pool.query('DELETE FROM animal_fotos WHERE id_animal = ?', [id]);
        await guardarFotosAnimal(pool, id, data.fotos);
      } else if (data.foto) {
        await pool.query('UPDATE animales SET foto = ? WHERE id_animal = ?', [data.foto, id]);
      }
      return jsonResponse(res, { message: 'Animal actualizado correctamente' });
    }
    if (req.method === 'DELETE' && id) {
      if (!requireAuth(req, res)) return;
      await pool.query('DELETE FROM animal_fotos WHERE id_animal = ?', [id]);
      await pool.query('DELETE FROM vacunas WHERE id_animal = ?', [id]);
      await pool.query('DELETE FROM visitas_seguimiento WHERE id_adopcion IN (SELECT id_adopcion FROM adopciones WHERE id_animal = ?)', [id]);
      await pool.query('DELETE FROM adopciones WHERE id_animal = ?', [id]);
      await pool.query('DELETE FROM postulaciones WHERE id_animal = ?', [id]);
      await pool.query('DELETE FROM historial_medico WHERE id_animal = ?', [id]);
      const [result] = await pool.query('DELETE FROM animales WHERE id_animal = ?', [id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Animal no encontrado' }, 404);
      return jsonResponse(res, { message: 'Animal eliminado correctamente' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- adoptantes.php ---
router.all('/adoptantes.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = req.query.id || null;
    if (req.method === 'GET' && id) {
      const [rows] = await pool.query('SELECT * FROM adoptantes WHERE id_adoptante = ?', [id]);
      if (!rows.length) return jsonResponse(res, { error: 'Adoptante no encontrado' }, 404);
      return jsonResponse(res, rows[0]);
    }
    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM adoptantes ORDER BY apellidos, nombres');
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST') {
      const err = requireFields(req.body, ['nombres', 'apellidos', 'cedula']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [result] = await pool.query(`
        INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion) VALUES (?,?,?,?,?,?)`,
        [req.body.nombres, req.body.apellidos, req.body.cedula, req.body.telefono || null, req.body.correo || null, req.body.direccion || null]);
      return jsonResponse(res, { message: 'Adoptante registrado', id: result.insertId }, 201);
    }
    if (req.method === 'PUT' && id) {
      const [result] = await pool.query(`
        UPDATE adoptantes SET nombres=?, apellidos=?, cedula=?, telefono=?, correo=?, direccion=? WHERE id_adoptante=?`,
        [req.body.nombres, req.body.apellidos, req.body.cedula, req.body.telefono, req.body.correo, req.body.direccion, id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Adoptante no encontrado' }, 404);
      return jsonResponse(res, { message: 'Adoptante actualizado correctamente' });
    }
    if (req.method === 'DELETE' && id) {
      const [check] = await pool.query('SELECT id_adopcion FROM adopciones WHERE id_adoptante = ?', [id]);
      if (check.length) return jsonResponse(res, { error: 'No se puede eliminar: el adoptante tiene adopciones registradas' }, 400);
      const [result] = await pool.query('DELETE FROM adoptantes WHERE id_adoptante = ?', [id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Adoptante no encontrado' }, 404);
      return jsonResponse(res, { message: 'Adoptante eliminado correctamente' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return jsonResponse(res, { error: 'Ya existe un adoptante con esa cédula' }, 400);
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- empleados.php ---
router.all('/empleados.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = req.query.id || null;
    if (req.method === 'GET' && id) {
      const [rows] = await pool.query('SELECT * FROM empleados WHERE id_empleado = ?', [id]);
      if (!rows.length) return jsonResponse(res, { error: 'Empleado no encontrado' }, 404);
      return jsonResponse(res, rows[0]);
    }
    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM empleados ORDER BY apellidos, nombres');
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST') {
      const err = requireFields(req.body, ['nombres', 'apellidos']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [result] = await pool.query(`
        INSERT INTO empleados (nombres, apellidos, cargo, telefono, correo) VALUES (?,?,?,?,?)`,
        [req.body.nombres, req.body.apellidos, req.body.cargo || null, req.body.telefono || null, req.body.correo || null]);
      return jsonResponse(res, { message: 'Empleado registrado', id: result.insertId }, 201);
    }
    if (req.method === 'PUT' && id) {
      const [result] = await pool.query(`
        UPDATE empleados SET nombres=?, apellidos=?, cargo=?, telefono=?, correo=? WHERE id_empleado=?`,
        [req.body.nombres, req.body.apellidos, req.body.cargo, req.body.telefono, req.body.correo, id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Empleado no encontrado' }, 404);
      return jsonResponse(res, { message: 'Empleado actualizado correctamente' });
    }
    if (req.method === 'DELETE' && id) {
      const [check] = await pool.query('SELECT id_adopcion FROM adopciones WHERE id_empleado = ?', [id]);
      if (check.length) return jsonResponse(res, { error: 'No se puede eliminar: el empleado tiene adopciones registradas' }, 400);
      const [result] = await pool.query('DELETE FROM empleados WHERE id_empleado = ?', [id]);
      if (result.affectedRows === 0) return jsonResponse(res, { error: 'Empleado no encontrado' }, 404);
      return jsonResponse(res, { message: 'Empleado eliminado correctamente' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

// --- adopciones.php ---
router.all('/adopciones.php', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const action = req.query.action || null;
    const id = req.query.id || null;
    if (req.method === 'GET') {
      const [rows] = await pool.query(`
        SELECT ad.id_adopcion, ad.fecha_adopcion, ad.frecuencia_visitas, ad.proxima_visita,
               ad.certificado_codigo, ad.id_animal, ad.id_adoptante, ad.id_empleado,
               vw.animal, vw.adoptante, vw.empleado
        FROM vw_historial_adopciones vw
        INNER JOIN adopciones ad ON ad.id_adopcion = vw.id_adopcion
        ORDER BY ad.fecha_adopcion DESC`);
      return jsonResponse(res, rows);
    }
    if (req.method === 'POST' && action === 'manual') {
      const data = normalizeBody({ ...req.body });
      const err = requireFields(data, ['id_animal', 'id_adoptante', 'id_empleado', 'fecha_adopcion', 'frecuencia_visitas']);
      if (err) return jsonResponse(res, { error: err }, 400);
      const [animals] = await pool.query(`
        SELECT a.id_animal, es.nombre_estado FROM animales a
        INNER JOIN estados es ON a.id_estado = es.id_estado WHERE a.id_animal = ?`, [data.id_animal]);
      if (!animals.length) return jsonResponse(res, { error: 'Animal no encontrado' }, 404);
      const codigo = `CERT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')}`;
      const proxima = calcularProximaVisita(data.fecha_adopcion, data.frecuencia_visitas);
      const [result] = await pool.query(`
        INSERT INTO adopciones (id_animal, id_adoptante, id_empleado, fecha_adopcion, frecuencia_visitas, certificado_codigo, proxima_visita)
        VALUES (?,?,?,?,?,?,?)`,
        [data.id_animal, data.id_adoptante, data.id_empleado, data.fecha_adopcion, data.frecuencia_visitas, codigo, proxima]);
      await pool.query('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada, estado) VALUES (?,?,?)',
        [result.insertId, proxima, 'Programada']);
      const cert = await emitirCertificadoCompleto(codigo);
      return jsonResponse(res, {
        message: 'Adopción registrada', certificado_codigo: codigo,
        certificado_url: cert.certificado_url, certificado_pdf: cert.pdf_api, email: cert.email
      }, 201);
    }
    if (req.method === 'DELETE' && id) {
      const [ad] = await pool.query('SELECT id_animal FROM adopciones WHERE id_adopcion = ?', [id]);
      if (!ad.length) return jsonResponse(res, { error: 'Adopción no encontrada' }, 404);
      await pool.query('DELETE FROM visitas_seguimiento WHERE id_adopcion = ?', [id]);
      await pool.query('DELETE FROM adopciones WHERE id_adopcion = ?', [id]);
      const idDisponible = await getEstadoId(pool, 'Disponible');
      await pool.query('UPDATE animales SET id_estado = ? WHERE id_animal = ?', [idDisponible, ad[0].id_animal]);
      return jsonResponse(res, { message: 'Adopción eliminada. Animal disponible nuevamente.' });
    }
    jsonResponse(res, { error: 'Método no permitido' }, 405);
  } catch (e) {
    jsonResponse(res, { error: e.message }, 500);
  }
});

module.exports = router;
