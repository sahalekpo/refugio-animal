const API_ALERTS = { alertas: '/api/alertas.php', vacunas: '/api/vacunas.php' };

async function loadAlertasPanel() {
  try {
    const data = await apiFetch(API_ALERTS.alertas);
    const badge = document.getElementById('nav-alert-badge');
    if (badge) {
      badge.textContent = data.total_alertas || 0;
      badge.style.display = data.total_alertas > 0 ? 'inline-flex' : 'none';
    }

    const post = document.getElementById('alertas-postulaciones');
    const vac = document.getElementById('alertas-vacunas');
    const vis = document.getElementById('alertas-visitas');
    if (!post) return;

    post.innerHTML = data.postulaciones_pendientes > 0
      ? `<div class="alert-item alert-warn">
          <strong>${data.postulaciones_pendientes}</strong> postulación(es) pendiente(s) de revisión.
          <button class="btn btn-sm btn-primary" onclick="navigate('postulaciones')">Revisar</button>
        </div>`
      : '<p class="alert-empty">Sin postulaciones pendientes.</p>';

    vac.innerHTML = data.vacunas_proximas?.length
      ? data.vacunas_proximas.map(v => `
          <div class="alert-item alert-info">
            <strong>${v.animal}</strong> — ${v.nombre_vacuna}
            <span class="alert-date">Próxima: ${formatDate(v.fecha_proxima)}</span>
          </div>`).join('')
      : '<p class="alert-empty">No hay vacunas próximas (14 días).</p>';

    vis.innerHTML = data.visitas_proximas?.length
      ? data.visitas_proximas.map(v => `
          <div class="alert-item alert-info">
            <strong>${v.animal}</strong> — ${v.adoptante}
            <span class="alert-date">${formatDate(v.fecha_programada)}</span>
          </div>`).join('')
      : '<p class="alert-empty">Sin visitas en los próximos 7 días.</p>';
  } catch (e) {
    console.warn('Alertas:', e.message);
  }
}

async function loadVacunas() {
  const rows = await apiFetch(API_ALERTS.vacunas);
  document.getElementById('tabla-vacunas').innerHTML = rows.length
    ? rows.map(v => `
      <tr>
        <td>${v.animal}</td>
        <td>${v.nombre_vacuna}</td>
        <td>${formatDate(v.fecha_aplicada)}</td>
        <td>${formatDate(v.fecha_proxima)}</td>
        <td><span class="estado-badge ${v.estado === 'Vencida' ? 'estado-adoptado' : 'estado-proceso'}">${v.estado}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-edit" onclick="openVacunaModal(${v.id_vacuna})">Editar</button>
            <button class="btn btn-sm btn-delete" onclick="deleteVacuna(${v.id_vacuna})">Eliminar</button>
          </div>
        </td>
      </tr>`).join('')
    : emptyRow(6);
}

async function openVacunaModal(id = null) {
  const animales = await apiFetch('/api/animales.php');
  let data = {};
  if (id) {
    const all = await apiFetch(API_ALERTS.vacunas);
    data = all.find(x => x.id_vacuna == id) || {};
  }
  openModal(id ? 'Editar vacuna' : 'Registrar vacuna', `
    <div class="form-group">
      <label>Animal *</label>
      <select name="id_animal" required>
        ${animales.map(a => `<option value="${a.id_animal}" ${a.id_animal == data.id_animal ? 'selected' : ''}>${a.nombre} (${a.nombre_especie})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nombre vacuna *</label>
      <input name="nombre_vacuna" required value="${data.nombre_vacuna || ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha aplicada</label>
        <input name="fecha_aplicada" type="date" value="${data.fecha_aplicada || ''}">
      </div>
      <div class="form-group">
        <label>Próxima dosis *</label>
        <input name="fecha_proxima" type="date" required value="${data.fecha_proxima || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Estado</label>
      <select name="estado">
        ${['Pendiente','Aplicada','Vencida'].map(s => `<option ${data.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Observaciones</label>
      <textarea name="observaciones" rows="2">${data.observaciones || ''}</textarea>
    </div>
  `, 'vacuna', id);
}

async function deleteVacuna(id) {
  if (!confirm('¿Eliminar registro de vacuna?')) return;
  await apiFetch(`${API_ALERTS.vacunas}?id=${id}`, { method: 'DELETE' });
  toast('Vacuna eliminada');
  loadVacunas();
  loadAlertasPanel();
}

window.openVacunaModal = openVacunaModal;
window.deleteVacuna = deleteVacuna;
window.loadVacunas = loadVacunas;
window.loadAlertasPanel = loadAlertasPanel;
