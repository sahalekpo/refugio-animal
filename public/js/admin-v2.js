const API_V2 = {
  auth: '/api/auth.php',
  postulaciones: '/api/postulaciones.php',
  visitas: '/api/visitas.php',
  animales: '/api/animales.php',
  adopciones: '/api/adopciones.php',
  empleados: '/api/empleados.php',
  apoyos: '/api/apoyos.php'
};

async function checkAuth() {
  const res = await fetch(`${API_V2.auth}?action=check`, { credentials: 'include' });
  const data = await res.json();
  if (!data.authenticated) {
    window.location.href = 'login.html';
    return false;
  }
  document.getElementById('user-name').textContent = data.user.usuario;
  return true;
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await fetch(`${API_V2.auth}?action=logout`, { method: 'POST', credentials: 'include' });
  window.location.href = 'login.html';
});

const origLoadSection = loadSection;
loadSection = async function (section) {
  switch (section) {
    case 'postulaciones': await loadPostulaciones(); break;
    case 'vacunas': await loadVacunas(); break;
    case 'adoptados': await loadAdoptados(); break;
    case 'visitas': await loadVisitas(); break;
    case 'apoyos': await loadApoyos(); break;
    default: return origLoadSection(section);
  }
};

const origTitles = { ...titles };
Object.assign(titles, {
  postulaciones: ['Postulaciones', 'Encuestas de adoptantes pendientes de revisión'],
  vacunas: ['Control de vacunas', 'Calendario y alertas de vacunación'],
  adoptados: ['Animales Adoptados', 'Gestión de adopciones confirmadas'],
  visitas: ['Visitas de Seguimiento', 'Calendario de visitas al hogar del adoptante'],
  apoyos: ['Apoyos y voluntariado', 'Donaciones, apadrinamientos y solicitudes de voluntarios']
});

async function loadPostulaciones() {
  const rows = await apiFetch(API_V2.postulaciones);
  const pendingByAnimal = {};
  rows.filter(p => p.estado_postulacion === 'Pendiente').forEach(p => {
    pendingByAnimal[p.id_animal] = (pendingByAnimal[p.id_animal] || 0) + 1;
  });
  document.getElementById('tabla-postulaciones').innerHTML = rows.length
    ? rows.map(p => `
      <tr>
        <td>${p.id_postulacion}</td>
        <td><strong>${p.animal}</strong><br><small>${p.nombre_especie}${pendingByAnimal[p.id_animal] > 1 ? ` · ${pendingByAnimal[p.id_animal]} postulaciones` : ''}</small></td>
        <td>${p.nombres} ${p.apellidos}<br><small>${p.cedula}</small></td>
        <td>${p.tipo_vivienda} / Patio: ${p.tiene_patio}</td>
        <td>${p.experiencia_mascotas}</td>
        <td><span class="estado-badge ${p.estado_postulacion === 'Pendiente' ? 'estado-proceso' : ''}">${p.estado_postulacion}</span></td>
        <td>${formatDate(p.fecha_postulacion?.split(' ')[0] || p.fecha_postulacion)}</td>
        <td>
          ${p.estado_postulacion === 'Pendiente' ? `
          <div class="btn-group">
            <button class="btn btn-sm btn-edit" onclick="aprobarPostulacion(${p.id_postulacion})">Aprobar</button>
            <button class="btn btn-sm btn-delete" onclick="rechazarPostulacion(${p.id_postulacion})">Rechazar</button>
            <button class="btn btn-sm btn-secondary" onclick="verEncuesta(${p.id_postulacion})">Ver encuesta</button>
          </div>` : '—'}
        </td>
      </tr>`).join('')
    : emptyRow(8);
}

async function loadAdoptados() {
  const rows = await apiFetch(`${API_V2.animales}?action=adoptados`);
  document.getElementById('tabla-adoptados').innerHTML = rows.length
    ? rows.map(a => `
      <tr>
        <td>${fotoThumb(a.foto, a.nombre_especie)}</td>
        <td><strong>${a.nombre}</strong><br><small>${a.nombre_especie}</small></td>
        <td>${a.adoptante}</td>
        <td>${formatDate(a.fecha_adopcion)}</td>
        <td>${a.frecuencia_visitas || '—'}</td>
        <td>${formatDate(a.proxima_visita)}</td>
        <td>
          <div class="btn-group">
            ${a.certificado_codigo ? `<a class="btn btn-sm btn-edit" href="certificado.html?codigo=${encodeURIComponent(a.certificado_codigo)}" target="_blank">Certificado</a>` : ''}
            <button class="btn btn-sm btn-delete" onclick="deleteAdopcion(${a.id_adopcion})">Eliminar</button>
          </div>
        </td>
      </tr>`).join('')
    : emptyRow(7);
}

async function loadVisitas() {
  const rows = await apiFetch(API_V2.visitas);
  document.getElementById('tabla-visitas').innerHTML = rows.length
    ? rows.map(v => `
      <tr>
        <td>${v.id_visita}</td>
        <td>${v.animal}</td>
        <td>${v.adoptante}</td>
        <td>${formatDate(v.fecha_programada)}</td>
        <td>${v.estado}</td>
        <td>${v.frecuencia_visitas || '—'}</td>
        <td>
          ${v.estado === 'Programada' ? `<button class="btn btn-sm btn-edit" onclick="completarVisita(${v.id_visita})">Marcar realizada</button>` : formatDate(v.fecha_realizada)}
        </td>
      </tr>`).join('')
    : emptyRow(7);
}

async function aprobarPostulacion(id) {
  const empleados = await apiFetch(API_V2.empleados);
  if (!empleados.length) { toast('Registre empleados primero', 'error'); return; }

  const rows = await apiFetch(API_V2.postulaciones);
  const post = rows.find(x => x.id_postulacion == id);
  const correoInfo = post?.correo
    ? `<p class="hint">El adoptante verá el certificado en <strong>usuario.html → Mi solicitud</strong> y también se intentará enviar a: <strong>${post.correo}</strong></p>`
    : `<p class="hint">El adoptante consultará su certificado en el portal con su cédula (<strong>Mi solicitud</strong>). No hay correo registrado.</p>`;

  openModal('Aprobar postulación', `
    <input type="hidden" name="id_postulacion" value="${id}">
    ${correoInfo}
    <div class="form-group">
      <label>Empleado responsable *</label>
      <select name="id_empleado" required>
        ${empleados.map(e => `<option value="${e.id_empleado}">${e.nombres} ${e.apellidos}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Frecuencia de visitas *</label>
      <select name="frecuencia_visitas" required>
        <option value="Semanal">Semanal</option>
        <option value="Quincenal">Quincenal</option>
        <option value="Mensual" selected>Mensual</option>
        <option value="Trimestral">Trimestral</option>
      </select>
    </div>
    <p style="font-size:.85rem;color:var(--text-muted)">El certificado quedará en el portal del adoptante (no se abrirá en su pantalla de admin).</p>
  `, 'aprobar_postulacion');
}

async function rechazarPostulacion(id) {
  if (!confirm('¿Rechazar esta postulación? El animal seguirá visible para otras solicitudes.')) return;
  try {
    const res = await apiFetch(`${API_V2.postulaciones}?action=rechazar`, {
      method: 'POST', body: JSON.stringify({ id_postulacion: id })
    });
    let msg = 'Postulación rechazada';
    if (res.email?.sent) msg += ' y se notificó por correo al postulante.';
    else if (res.email) msg += '. Sin correo válido registrado.';
    toast(msg);
    loadPostulaciones();
    if (typeof loadAlertasPanel === 'function') loadAlertasPanel();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function verEncuesta(id) {
  const rows = await apiFetch(API_V2.postulaciones);
  const p = rows.find(x => x.id_postulacion == id);
  if (!p) return;
  openModal('Encuesta del adoptante', `
    <div class="encuesta-view">
      <p><strong>Motivo:</strong> ${p.motivo_adopcion}</p>
      <p><strong>Tiempo disponible:</strong> ${p.tiempo_disponible || '—'}</p>
      <p><strong>Adultos en hogar:</strong> ${p.adultos_hogar} | <strong>Niños:</strong> ${p.ninos_hogar}</p>
      <p><strong>Otras mascotas:</strong> ${p.otras_mascotas} ${p.detalle_otras_mascotas || ''}</p>
      <p><strong>Acepta visitas:</strong> ${p.acepta_visitas}</p>
      <p><strong>Contacto:</strong> ${p.telefono || '—'} | ${p.correo || '—'}</p>
      <p><strong>Dirección:</strong> ${p.direccion || '—'}</p>
    </div>
  `, 'view_only');
  document.getElementById('modal-submit').style.display = 'none';
}

async function completarVisita(id) {
  const obs = prompt('Observaciones de la visita (opcional):');
  await apiFetch(`${API_V2.visitas}?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ observaciones: obs, estado: 'Realizada', fecha_realizada: todayISO() })
  });
  toast('Visita registrada. Próxima visita programada.');
  loadVisitas();
  loadAdoptados();
}

const origHandleSubmit = handleFormSubmit;
handleFormSubmit = async function (e) {
  if (state.modalType === 'vacuna') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.id_animal = parseInt(body.id_animal, 10);
    try {
      if (state.editId) {
        await apiFetch(`/api/vacunas.php?id=${state.editId}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Vacuna actualizada');
      } else {
        await apiFetch('/api/vacunas.php', { method: 'POST', body: JSON.stringify(body) });
        toast('Vacuna registrada');
      }
      closeModal();
      loadVacunas();
      loadAlertasPanel();
      loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (state.modalType === 'aprobar_postulacion') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.id_empleado = parseInt(body.id_empleado, 10);
    body.id_postulacion = parseInt(body.id_postulacion, 10);
    try {
      const res = await apiFetch(`${API_V2.postulaciones}?action=aprobar`, {
        method: 'POST', body: JSON.stringify(body)
      });
      let msg = 'Adopción aprobada. El animal fue retirado del catálogo';
      if (res.notificacion_aprobada?.message) {
        msg += `. ${res.notificacion_aprobada.message}`;
      } else if (res.email?.sent) {
        msg += ' y se envió el certificado por correo al adoptante.';
      } else if (res.correo_adoptante) {
        msg += `. Indíquele que consulte con su cédula en usuario.html → Mi solicitud.`;
      } else {
        msg += '. Sin correo registrado: el adoptante debe consultar con su cédula en el portal.';
      }
      if (res.rechazados_count > 0) {
        const msgs = (res.notificaciones_rechazo || []).map(n => n.message).filter(Boolean);
        msg += ` Se cancelaron ${res.rechazados_count} postulación(es) adicional(es)`;
        msg += msgs.length ? `: ${msgs[0]}` : '.';
      }
      toast(msg, 'success');
      closeModal();
      loadPostulaciones();
      loadAdoptados();
      loadAdopciones();
      loadAnimales();
      if (typeof loadAlertasPanel === 'function') loadAlertasPanel();
      if (typeof loadDashboard === 'function') loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (state.modalType === 'view_only') {
    e.preventDefault();
    closeModal();
    document.getElementById('modal-submit').style.display = '';
    return;
  }
  return origHandleSubmit(e);
};

const origCloseModal = closeModal;
closeModal = function () {
  document.getElementById('modal-submit').style.display = '';
  origCloseModal();
};

document.getElementById('btn-nueva-adopcion-manual')?.addEventListener('click', () => openAdopcionModal());
document.getElementById('btn-nueva-vacuna')?.addEventListener('click', () => openVacunaModal());

window.aprobarPostulacion = aprobarPostulacion;
window.rechazarPostulacion = rechazarPostulacion;
window.verEncuesta = verEncuesta;
window.completarVisita = completarVisita;
window.loadAdoptados = loadAdoptados;

async function loadApoyos() {
  try {
    const [donaciones, voluntarios] = await Promise.all([
      apiFetch(`${API_V2.apoyos}?action=donaciones`),
      apiFetch(`${API_V2.apoyos}?action=voluntariados`)
    ]);
    document.getElementById('tabla-donaciones').innerHTML = donaciones.length
      ? donaciones.map(d => `
        <tr>
          <td>${d.id_donacion}</td>
          <td>${d.tipo}</td>
          <td><strong>${d.nombres}</strong></td>
          <td>${d.correo || '—'}<br><small>${d.telefono || ''}</small></td>
          <td>${d.monto_sugerido || '—'}</td>
          <td>${d.animal_nombre || '—'}</td>
          <td><span class="estado-badge ${apoyoEstadoClass(d.estado)}">${d.estado}</span></td>
          <td>${formatDate(d.fecha_solicitud?.split(' ')[0] || d.fecha_solicitud)}</td>
          <td>${apoyoDonacionAcciones(d)}</td>
        </tr>`).join('')
      : emptyRow(9, 'Sin solicitudes de apoyo');
    document.getElementById('tabla-voluntariados').innerHTML = voluntarios.length
      ? voluntarios.map(v => `
        <tr>
          <td>${v.id_voluntariado}</td>
          <td><strong>${v.nombres} ${v.apellidos}</strong></td>
          <td>${v.correo}</td>
          <td>${v.disponibilidad}</td>
          <td>${v.areas_interes}</td>
          <td><span class="estado-badge ${apoyoEstadoClass(v.estado)}">${v.estado}</span></td>
          <td>${formatDate(v.fecha_solicitud?.split(' ')[0] || v.fecha_solicitud)}</td>
          <td>${apoyoVoluntarioAcciones(v)}</td>
        </tr>`).join('')
      : emptyRow(8, 'Sin solicitudes de voluntariado');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function apoyoEstadoClass(estado) {
  const map = {
    Nueva: 'estado-proceso',
    Contactada: 'estado-tratamiento',
    Aceptada: 'estado-disponible',
    Activa: 'estado-disponible',
    Rechazada: 'estado-adoptado',
    Cerrada: ''
  };
  return map[estado] || '';
}

function apoyoDonacionAcciones(d) {
  const btns = [];
  if (d.estado === 'Nueva' || d.estado === 'Contactada') {
    btns.push(`<button class="btn btn-sm btn-edit" onclick="aceptarDonacion(${d.id_donacion})">Aceptar</button>`);
    btns.push(`<button class="btn btn-sm btn-delete" onclick="rechazarDonacion(${d.id_donacion})">Rechazar</button>`);
  }
  btns.push(`<button class="btn btn-sm btn-secondary" onclick="eliminarDonacion(${d.id_donacion})">Eliminar</button>`);
  return `<div class="btn-group">${btns.join('')}</div>`;
}

function apoyoVoluntarioAcciones(v) {
  const btns = [];
  if (v.estado === 'Nueva' || v.estado === 'Contactada') {
    btns.push(`<button class="btn btn-sm btn-edit" onclick="aceptarVoluntariado(${v.id_voluntariado})">Aceptar</button>`);
    btns.push(`<button class="btn btn-sm btn-delete" onclick="rechazarVoluntariado(${v.id_voluntariado})">Rechazar</button>`);
  }
  btns.push(`<button class="btn btn-sm btn-secondary" onclick="eliminarVoluntariado(${v.id_voluntariado})">Eliminar</button>`);
  return `<div class="btn-group">${btns.join('')}</div>`;
}

async function gestionarApoyo(action, body, okMsg) {
  const res = await apiFetch(`${API_V2.apoyos}?action=${action}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  let msg = okMsg;
  if (res.email?.sent) msg += ' Se notificó por correo.';
  else if (res.email) msg += ' Sin correo válido para notificar.';
  toast(msg);
  loadApoyos();
}

async function aceptarDonacion(id) {
  if (!confirm('¿Aceptar esta solicitud de donación/apadrinamiento?')) return;
  try {
    await gestionarApoyo('aceptar-donacion', { id_donacion: id }, 'Solicitud aceptada.');
  } catch (err) { toast(err.message, 'error'); }
}

async function rechazarDonacion(id) {
  if (!confirm('¿Rechazar esta solicitud?')) return;
  try {
    await gestionarApoyo('rechazar-donacion', { id_donacion: id }, 'Solicitud rechazada.');
  } catch (err) { toast(err.message, 'error'); }
}

async function eliminarDonacion(id) {
  if (!confirm('¿Eliminar esta solicitud permanentemente?')) return;
  try {
    await apiFetch(`${API_V2.apoyos}?action=donacion&id=${id}`, { method: 'DELETE' });
    toast('Solicitud eliminada');
    loadApoyos();
  } catch (err) { toast(err.message, 'error'); }
}

async function aceptarVoluntariado(id) {
  if (!confirm('¿Aceptar esta solicitud de voluntariado?')) return;
  try {
    await gestionarApoyo('aceptar-voluntariado', { id_voluntariado: id }, 'Voluntariado aceptado.');
  } catch (err) { toast(err.message, 'error'); }
}

async function rechazarVoluntariado(id) {
  if (!confirm('¿Rechazar esta solicitud de voluntariado?')) return;
  try {
    await gestionarApoyo('rechazar-voluntariado', { id_voluntariado: id }, 'Voluntariado rechazado.');
  } catch (err) { toast(err.message, 'error'); }
}

async function eliminarVoluntariado(id) {
  if (!confirm('¿Eliminar esta solicitud permanentemente?')) return;
  try {
    await apiFetch(`${API_V2.apoyos}?action=voluntariado&id=${id}`, { method: 'DELETE' });
    toast('Solicitud eliminada');
    loadApoyos();
  } catch (err) { toast(err.message, 'error'); }
}

window.aceptarDonacion = aceptarDonacion;
window.rechazarDonacion = rechazarDonacion;
window.eliminarDonacion = eliminarDonacion;
window.aceptarVoluntariado = aceptarVoluntariado;
window.rechazarVoluntariado = rechazarVoluntariado;
window.eliminarVoluntariado = eliminarVoluntariado;

(async function bootAdmin() {
  if (!await checkAuth()) return;
  init();
})();
