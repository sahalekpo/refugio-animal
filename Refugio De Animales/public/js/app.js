const API = {
  animales: '/api/animales.php',
  adoptantes: '/api/adoptantes.php',
  empleados: '/api/empleados.php',
  adopciones: '/api/adopciones.php',
  reportes: '/api/reportes.php'
};

const state = {
  especies: [],
  estados: [],
  animales: [],
  adoptantes: [],
  empleados: [],
  modalType: null,
  editId: null,
  animalFotos: []
};

const titles = {
  inicio: ['Panel de Control', 'Resumen general del refugio'],
  animales: ['Gestión de Animales', 'Registrar, consultar, actualizar y eliminar animales'],
  adoptantes: ['Adoptantes', 'Gestión de personas interesadas en adoptar'],
  empleados: ['Empleados', 'Personal del refugio responsable de las adopciones'],
  adopciones: ['Adopciones', 'Registro y consulta del historial de adopciones'],
  reportes: ['Reportes', 'Vistas, funciones y triggers de la base de datos']
};

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.redirect) {
    window.location.href = data.redirect;
    throw new Error('Sesión expirada');
  }
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function setDbStatus(connected, message) {
  const el = document.getElementById('db-status');
  el.className = `topbar-status ${connected ? 'connected' : 'error'}`;
  el.innerHTML = `<span class="status-dot"></span> ${message}`;
}

function estadoClass(nombre) {
  const map = {
    Disponible: 'estado-disponible',
    Adoptado: 'estado-adoptado',
    'En tratamiento': 'estado-tratamiento',
    Reservado: 'estado-reservado',
    'En proceso de adopción': 'estado-proceso'
  };
  return map[nombre] || '';
}

function emptyRow(cols, text = 'No hay registros') {
  return `<tr class="empty-row"><td colspan="${cols}">${text}</td></tr>`;
}

function navigate(section) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${section}`);
  });
  const [title, subtitle] = titles[section];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
  loadSection(section);
}

async function loadSection(section) {
  switch (section) {
    case 'inicio': await loadDashboard(); break;
    case 'animales': await loadAnimales(); break;
    case 'adoptantes': await loadAdoptantes(); break;
    case 'empleados': await loadEmpleados(); break;
    case 'adopciones': await loadAdopciones(); break;
    case 'reportes': await loadReportes(); break;
  }
}

async function loadCatalogos() {
  state.especies = await apiFetch(`${API.animales}?action=especies`);
  try {
    state.estados = await apiFetch(`${API.animales}?action=estados`);
  } catch {
    state.estados = [];
  }
}

async function loadDashboard() {
  const [dashboard, disponibles, historial] = await Promise.all([
    apiFetch(`${API.reportes}?action=dashboard`),
    apiFetch(`${API.reportes}?action=animales-disponibles`),
    apiFetch(`${API.reportes}?action=historial-adopciones`)
  ]);

  document.getElementById('stat-animales').textContent = dashboard.total_animales;
  document.getElementById('stat-disponibles').textContent = dashboard.animales_disponibles;
  document.getElementById('stat-adopciones').textContent = dashboard.total_adopciones;
  document.getElementById('stat-personas').textContent =
    dashboard.total_adoptantes + dashboard.total_empleados;
  const elPost = document.getElementById('stat-postulaciones');
  const elVac = document.getElementById('stat-vacunas-alerta');
  if (elPost) elPost.textContent = dashboard.postulaciones_pendientes ?? 0;
  if (elVac) elVac.textContent = dashboard.vacunas_alertas ?? 0;
  if (typeof loadAlertasPanel === 'function') loadAlertasPanel();

  document.getElementById('home-disponibles').innerHTML = disponibles.length
    ? disponibles.slice(0, 5).map(a => `
        <tr>
          <td><strong>${a.nombre}</strong></td>
          <td>${a.nombre_especie}</td>
          <td>${a.raza || '—'}</td>
          <td>${a.edad ?? '—'}</td>
          <td><span class="estado-badge ${estadoClass(a.nombre_estado)}">${a.nombre_estado}</span></td>
        </tr>`).join('')
    : emptyRow(5);

  document.getElementById('home-adopciones').innerHTML = historial.length
    ? historial.slice(0, 5).map(a => `
        <tr>
          <td><strong>${a.animal}</strong></td>
          <td>${a.adoptante}</td>
          <td>${formatDate(a.fecha_adopcion)}</td>
        </tr>`).join('')
    : emptyRow(3);
}

async function loadAnimales() {
  state.animales = await apiFetch(API.animales);
  document.getElementById('tabla-animales').innerHTML = state.animales.length
    ? state.animales.map(a => `
        <tr>
          <td>${a.id_animal}</td>
          <td>${fotoThumb(a.foto, a.nombre_especie)}</td>
          <td><strong>${a.nombre}</strong></td>
          <td>${a.nombre_especie}</td>
          <td>${a.raza || '—'}</td>
          <td>${a.sexo}</td>
          <td>${a.edad ?? '—'}</td>
          <td>${formatDate(a.fecha_ingreso)}</td>
          <td><span class="estado-badge ${estadoClass(a.nombre_estado)}">${a.nombre_estado}</span></td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-edit" onclick="openAnimalModal(${a.id_animal})">Editar</button>
              <button class="btn btn-sm btn-delete" onclick="deleteAnimal(${a.id_animal})">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')
    : emptyRow(10);
}

async function loadAdoptantes() {
  state.adoptantes = await apiFetch(API.adoptantes);
  document.getElementById('tabla-adoptantes').innerHTML = state.adoptantes.length
    ? state.adoptantes.map(a => `
        <tr>
          <td>${a.id_adoptante}</td>
          <td>${a.nombres}</td>
          <td>${a.apellidos}</td>
          <td>${a.cedula}</td>
          <td>${a.telefono || '—'}</td>
          <td>${a.correo || '—'}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-edit" onclick="openAdoptanteModal(${a.id_adoptante})">Editar</button>
              <button class="btn btn-sm btn-delete" onclick="deleteAdoptante(${a.id_adoptante})">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')
    : emptyRow(7);
}

async function loadEmpleados() {
  state.empleados = await apiFetch(API.empleados);
  document.getElementById('tabla-empleados').innerHTML = state.empleados.length
    ? state.empleados.map(e => `
        <tr>
          <td>${e.id_empleado}</td>
          <td>${e.nombres}</td>
          <td>${e.apellidos}</td>
          <td>${e.cargo || '—'}</td>
          <td>${e.telefono || '—'}</td>
          <td>${e.correo || '—'}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-edit" onclick="openEmpleadoModal(${e.id_empleado})">Editar</button>
              <button class="btn btn-sm btn-delete" onclick="deleteEmpleado(${e.id_empleado})">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')
    : emptyRow(7);
}

async function loadAdopciones() {
  const adopciones = await apiFetch(API.adopciones);
  document.getElementById('tabla-adopciones').innerHTML = adopciones.length
    ? adopciones.map(a => `
        <tr>
          <td>${a.id_adopcion}</td>
          <td><strong>${a.animal}</strong></td>
          <td>${a.adoptante}</td>
          <td>${a.empleado}</td>
          <td>${formatDate(a.fecha_adopcion)}</td>
          <td>${a.frecuencia_visitas || '—'}</td>
          <td>${a.certificado_codigo ? `<a href="certificado.html?codigo=${encodeURIComponent(a.certificado_codigo)}" target="_blank">Ver</a>` : '—'}</td>
          <td>
            <button class="btn btn-sm btn-delete" onclick="deleteAdopcion(${a.id_adopcion})">Eliminar</button>
          </td>
        </tr>`).join('')
    : emptyRow(8);
}

async function loadReportes() {
  const [dashboard, disponibles, historial] = await Promise.all([
    apiFetch(`${API.reportes}?action=dashboard`),
    apiFetch(`${API.reportes}?action=animales-disponibles`),
    apiFetch(`${API.reportes}?action=historial-adopciones`)
  ]);

  document.getElementById('report-total-adopciones').textContent = dashboard.total_adopciones;

  document.getElementById('report-disponibles').innerHTML = disponibles.length
    ? disponibles.map(a => `
        <tr>
          <td>${a.id_animal}</td>
          <td>${a.nombre}</td>
          <td>${a.nombre_especie}</td>
          <td>${a.raza || '—'}</td>
          <td>${a.edad ?? '—'}</td>
          <td><span class="estado-badge ${estadoClass(a.nombre_estado)}">${a.nombre_estado}</span></td>
        </tr>`).join('')
    : emptyRow(6);

  document.getElementById('report-historial').innerHTML = historial.length
    ? historial.map(a => `
        <tr>
          <td>${a.id_adopcion}</td>
          <td>${a.animal}</td>
          <td>${a.adoptante}</td>
          <td>${a.empleado}</td>
          <td>${formatDate(a.fecha_adopcion)}</td>
        </tr>`).join('')
    : emptyRow(5);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function fotoThumb(foto, especie) {
  if (foto) return `<img src="/${foto}" class="table-photo" alt="foto">`;
  const em = { Perro:'🐕', Gato:'🐈' };
  return `<span class="table-photo-emoji">${em[especie] || '🐾'}</span>`;
}

function openModal(title, html, type, editId = null) {
  state.modalType = type;
  state.editId = editId;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-form').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  state.modalType = null;
  state.editId = null;
}

function especiesOptions(selected) {
  return state.especies
    .filter(e => ['Perro', 'Gato'].includes(e.nombre_especie))
    .map(e =>
    `<option value="${e.id_especie}" ${e.id_especie == selected ? 'selected' : ''}>${e.nombre_especie}</option>`
  ).join('');
}

function estadosOptions(selected) {
  return state.estados.map(e =>
    `<option value="${e.id_estado}" ${e.id_estado == selected ? 'selected' : ''}>${e.nombre_estado}</option>`
  ).join('');
}

function renderFotosPreview() {
  const box = document.getElementById('fotos-preview');
  if (!box) return;
  const fotos = state.animalFotos.map(r => ({ ruta: r }));
  box.innerHTML = fotos.length
    ? buildCarousel(fotos, 'modal-carousel') +
      `<div class="fotos-chips">${fotos.map((f, i) =>
        `<span class="foto-chip">${f.ruta.split('/').pop()}
          <button type="button" onclick="quitarFotoAnimal(${i})">×</button></span>`
      ).join('')}</div>`
    : '<p class="hint">Sin fotos. Puede subir varias imágenes.</p>';
  initCarouselsIn(box);
}

function quitarFotoAnimal(idx) {
  state.animalFotos.splice(idx, 1);
  renderFotosPreview();
}
window.quitarFotoAnimal = quitarFotoAnimal;

async function openAnimalModal(id = null) {
  await loadCatalogos();
  let data = {};
  if (id) data = await apiFetch(`${API.animales}?id=${id}`);

  state.animalFotos = (data.fotos || []).map(f => f.ruta);
  if (!state.animalFotos.length && data.foto) state.animalFotos = [data.foto];

  const isEdit = !!id;
  openModal(
    isEdit ? 'Editar Animal' : 'Registrar Animal',
    `
      <div class="form-group">
        <label>Nombre *</label>
        <input name="nombre" required value="${data.nombre || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Especie *</label>
          <select name="id_especie" required>${especiesOptions(data.id_especie)}</select>
        </div>
        <div class="form-group">
          <label>Sexo *</label>
          <select name="sexo" required>
            <option value="Macho" ${data.sexo === 'Macho' ? 'selected' : ''}>Macho</option>
            <option value="Hembra" ${data.sexo === 'Hembra' ? 'selected' : ''}>Hembra</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Raza</label>
          <input name="raza" value="${data.raza || ''}">
        </div>
        <div class="form-group">
          <label>Edad (años)</label>
          <input name="edad" type="number" min="0" value="${data.edad ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Fecha de ingreso *</label>
        <input name="fecha_ingreso" type="date" required value="${data.fecha_ingreso || todayISO()}">
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label>Estado *</label>
        <select name="id_estado" required>${estadosOptions(data.id_estado)}</select>
      </div>` : ''}
      <div class="form-group">
        <label>Fotografías (varias)</label>
        <div id="fotos-preview"></div>
        <input name="foto_file" type="file" accept="image/*" multiple id="animal-fotos-input">
        <p class="hint">Puede seleccionar varias imágenes a la vez (JPG, PNG, WebP).</p>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea name="descripcion" rows="3">${data.descripcion || ''}</textarea>
      </div>
      <h3 class="form-section-title" style="margin-top:1rem">Perfil de salud y comportamiento</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Vacunado</label>
          <select name="vacunado">
            <option value="Si" ${data.vacunado === 'Si' ? 'selected' : ''}>Sí</option>
            <option value="No" ${(data.vacunado || 'No') === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Esterilizado</label>
          <select name="esterilizado">
            <option value="Si" ${data.esterilizado === 'Si' ? 'selected' : ''}>Sí</option>
            <option value="No" ${(data.esterilizado || 'No') === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Desparasitado</label>
          <select name="desparasitado">
            <option value="Si" ${data.desparasitado === 'Si' ? 'selected' : ''}>Sí</option>
            <option value="No" ${(data.desparasitado || 'No') === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nivel de energía</label>
          <select name="nivel_energia">
            <option value="Baja" ${data.nivel_energia === 'Baja' ? 'selected' : ''}>Baja</option>
            <option value="Media" ${(data.nivel_energia || 'Media') === 'Media' ? 'selected' : ''}>Media</option>
            <option value="Alta" ${data.nivel_energia === 'Alta' ? 'selected' : ''}>Alta</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Compatible con niños</label>
          <select name="compatible_ninos">
            <option value="Desconocido" ${(data.compatible_ninos || 'Desconocido') === 'Desconocido' ? 'selected' : ''}>Desconocido</option>
            <option value="Si" ${data.compatible_ninos === 'Si' ? 'selected' : ''}>Sí</option>
            <option value="No" ${data.compatible_ninos === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Compatible con otras mascotas</label>
          <select name="compatible_mascotas">
            <option value="Desconocido" ${(data.compatible_mascotas || 'Desconocido') === 'Desconocido' ? 'selected' : ''}>Desconocido</option>
            <option value="Si" ${data.compatible_mascotas === 'Si' ? 'selected' : ''}>Sí</option>
            <option value="No" ${data.compatible_mascotas === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
      ${!isEdit ? '<p class="hint">El animal se registrará con estado <strong>Disponible</strong>.</p>' : ''}
    `,
    'animal',
    id
  );
  renderFotosPreview();
}

async function openAdoptanteModal(id = null) {
  let data = {};
  if (id) data = await apiFetch(`${API.adoptantes}?id=${id}`);

  openModal(
    id ? 'Editar Adoptante' : 'Registrar Adoptante',
    `
      <div class="form-row">
        <div class="form-group">
          <label>Nombres *</label>
          <input name="nombres" required value="${data.nombres || ''}">
        </div>
        <div class="form-group">
          <label>Apellidos *</label>
          <input name="apellidos" required value="${data.apellidos || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Cédula *</label>
        <input name="cedula" required value="${data.cedula || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Teléfono</label>
          <input name="telefono" value="${data.telefono || ''}">
        </div>
        <div class="form-group">
          <label>Correo</label>
          <input name="correo" type="email" value="${data.correo || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input name="direccion" value="${data.direccion || ''}">
      </div>
    `,
    'adoptante',
    id
  );
}

async function openEmpleadoModal(id = null) {
  let data = {};
  if (id) data = await apiFetch(`${API.empleados}?id=${id}`);

  openModal(
    id ? 'Editar Empleado' : 'Registrar Empleado',
    `
      <div class="form-row">
        <div class="form-group">
          <label>Nombres *</label>
          <input name="nombres" required value="${data.nombres || ''}">
        </div>
        <div class="form-group">
          <label>Apellidos *</label>
          <input name="apellidos" required value="${data.apellidos || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Cargo</label>
        <input name="cargo" value="${data.cargo || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Teléfono</label>
          <input name="telefono" value="${data.telefono || ''}">
        </div>
        <div class="form-group">
          <label>Correo</label>
          <input name="correo" type="email" value="${data.correo || ''}">
        </div>
      </div>
    `,
    'empleado',
    id
  );
}

async function openAdopcionModal() {
  const [animales, adoptantes, empleados] = await Promise.all([
    apiFetch(`${API.animales}?action=disponibles`),
    apiFetch(API.adoptantes),
    apiFetch(API.empleados)
  ]);

  if (!animales.length) {
    toast('No hay animales disponibles para adoptar', 'error');
    return;
  }
  if (!adoptantes.length || !empleados.length) {
    toast('Debe registrar adoptantes y empleados primero', 'error');
    return;
  }

  openModal(
    'Registrar Adopción',
    `
      <div class="form-group">
        <label>Animal *</label>
        <select name="id_animal" required>
          ${animales.map(a => `<option value="${a.id_animal}">${a.nombre} (${a.nombre_especie})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Adoptante *</label>
        <select name="id_adoptante" required>
          ${adoptantes.map(a => `<option value="${a.id_adoptante}">${a.nombres} ${a.apellidos}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Empleado responsable *</label>
        <select name="id_empleado" required>
          ${empleados.map(e => `<option value="${e.id_empleado}">${e.nombres} ${e.apellidos}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Fecha de adopción *</label>
        <input name="fecha_adopcion" type="date" required value="${todayISO()}">
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
      <p style="font-size:0.85rem;color:var(--text-muted)">Se generará certificado legal y primera visita de seguimiento.</p>
    `,
    'adopcion'
  );
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());

  if (body.edad) body.edad = parseInt(body.edad, 10);
  if (body.id_especie) body.id_especie = parseInt(body.id_especie, 10);
  if (body.id_estado) body.id_estado = parseInt(body.id_estado, 10);
  if (body.id_animal) body.id_animal = parseInt(body.id_animal, 10);
  if (body.id_adoptante) body.id_adoptante = parseInt(body.id_adoptante, 10);
  if (body.id_empleado) body.id_empleado = parseInt(body.id_empleado, 10);

  try {
    switch (state.modalType) {
      case 'animal': {
        const input = document.getElementById('animal-fotos-input');
        let nuevas = [...state.animalFotos];
        if (input?.files?.length) {
          const fd = new FormData();
          for (const f of input.files) fd.append('fotos[]', f);
          const up = await fetch('/api/upload.php', { method: 'POST', credentials: 'include', body: fd });
          const upData = await up.json();
          if (!up.ok) throw new Error(upData.error || 'Error al subir fotos');
          nuevas = nuevas.concat(upData.fotos || (upData.foto ? [upData.foto] : []));
        }
        body.fotos = nuevas;
        if (nuevas[0]) body.foto = nuevas[0];
        delete body.foto_file;
        if (state.editId) {
          await apiFetch(`${API.animales}?id=${state.editId}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Animal actualizado');
        } else {
          await apiFetch(API.animales, { method: 'POST', body: JSON.stringify(body) });
          toast('Animal registrado correctamente');
        }
        state.animalFotos = [];
        closeModal();
        loadAnimales();
        break;
      }
      case 'adoptante':
        if (state.editId) {
          await apiFetch(`${API.adoptantes}?id=${state.editId}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Adoptante actualizado');
        } else {
          await apiFetch(API.adoptantes, { method: 'POST', body: JSON.stringify(body) });
          toast('Adoptante registrado');
        }
        closeModal();
        loadAdoptantes();
        break;
      case 'empleado':
        if (state.editId) {
          await apiFetch(`${API.empleados}?id=${state.editId}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Empleado actualizado');
        } else {
          await apiFetch(API.empleados, { method: 'POST', body: JSON.stringify(body) });
          toast('Empleado registrado');
        }
        closeModal();
        loadEmpleados();
        break;
      case 'adopcion':
        await apiFetch(`${API.adopciones}?action=manual`, { method: 'POST', body: JSON.stringify(body) });
        toast('Adopción registrada con certificado.');
        closeModal();
        loadAdopciones();
        if (typeof loadAdoptados === 'function') loadAdoptados();
        break;
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteAnimal(id) {
  if (!confirm('¿Eliminar este animal?')) return;
  try {
    await apiFetch(`${API.animales}?id=${id}`, { method: 'DELETE' });
    toast('Animal eliminado');
    loadAnimales();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteAdoptante(id) {
  if (!confirm('¿Eliminar este adoptante?')) return;
  try {
    await apiFetch(`${API.adoptantes}?id=${id}`, { method: 'DELETE' });
    toast('Adoptante eliminado');
    loadAdoptantes();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteEmpleado(id) {
  if (!confirm('¿Eliminar este empleado?')) return;
  try {
    await apiFetch(`${API.empleados}?id=${id}`, { method: 'DELETE' });
    toast('Empleado eliminado');
    loadEmpleados();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteAdopcion(id) {
  if (!confirm('¿Eliminar esta adopción? El animal volverá a estado Disponible.')) return;
  try {
    await apiFetch(`${API.adopciones}?id=${id}`, { method: 'DELETE' });
    toast('Adopción eliminada');
    loadAdopciones();
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.section));
});

document.getElementById('btn-nuevo-animal').addEventListener('click', () => openAnimalModal());
document.getElementById('btn-nuevo-adoptante').addEventListener('click', () => openAdoptanteModal());
document.getElementById('btn-nuevo-empleado').addEventListener('click', () => openEmpleadoModal());
document.getElementById('btn-nueva-adopcion').addEventListener('click', () => openAdopcionModal());

function dispatchFormSubmit(e) {
  return handleFormSubmit(e);
}
document.getElementById('modal-form').addEventListener('submit', (e) => dispatchFormSubmit(e));
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

window.openAnimalModal = openAnimalModal;
window.openAdoptanteModal = openAdoptanteModal;
window.openEmpleadoModal = openEmpleadoModal;
window.deleteAnimal = deleteAnimal;
window.deleteAdoptante = deleteAdoptante;
window.deleteEmpleado = deleteEmpleado;
window.deleteAdopcion = deleteAdopcion;

async function init() {
  try {
    await loadCatalogos();
    await loadDashboard();
    setDbStatus(true, 'Conectado a MySQL');
  } catch (err) {
    setDbStatus(false, 'Error de conexión');
    toast(err.message || 'Error de conexión', 'error');
  }
}

if (!document.getElementById('btn-logout')) init();
