const API = {
  publico: '/api/publico.php',
  postulaciones: '/api/postulaciones.php',
  captcha: '/api/captcha.php'
};

/** Imágenes de respaldo si no hay fotos en img/hero ni en la BD */
const HERO_FALLBACK = [
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1920&q=80',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1920&q=80',
  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1920&q=80',
  'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1920&q=80'
];

let animales = [];
let catalogo = { todos: [], destacados: [], nuevos: [] };
let adoptados = [];
let captchaOk = false;
let heroInterval = null;
let heroImagenes = [];
let heroSlideIdx = 0;

const especieEmoji = { Perro:'🐕', Gato:'🐈' };
const ESPECIES_PERMITIDAS = ['Perro', 'Gato'];
let refugioInfo = {};

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function imgUrl(ruta) {
  if (!ruta) return '';
  if (ruta.startsWith('http')) return ruta;
  return '/' + ruta.replace(/^\//, '');
}

function initHeroCarousel(imagenes) {
  const bg = document.getElementById('hero-bg');
  if (!bg) return;

  heroImagenes = (imagenes?.length ? imagenes : HERO_FALLBACK).slice(0, 8);
  heroSlideIdx = 0;

  bg.innerHTML = heroImagenes.map((src, i) =>
    `<div class="hero-bg-slide${i === 0 ? ' active' : ''}" data-idx="${i}" style="background-image:url('${imgUrl(src)}')"></div>`
  ).join('');

  const slides = bg.querySelectorAll('.hero-bg-slide');
  if (slides.length < 2) {
    syncAboutWithHero(0);
    return;
  }

  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    slides[heroSlideIdx].classList.remove('active');
    heroSlideIdx = (heroSlideIdx + 1) % slides.length;
    slides[heroSlideIdx].classList.add('active');
    syncAboutWithHero(heroSlideIdx);
  }, 5500);

  syncAboutWithHero(0);
}

function buildFilmstrip(imagenes) {
  const list = (imagenes?.length ? imagenes : HERO_FALLBACK).map(imgUrl);
  const html = list.map(src => `<img src="${src}" alt="" loading="lazy">`).join('');
  const strip = document.getElementById('about-filmstrip');
  if (strip) strip.innerHTML = html + html;
}

function syncAboutWithHero(idx) {
  if (!heroImagenes.length) return;
  const main = document.getElementById('about-photo-main');
  const thumbA = document.getElementById('about-thumb-a');
  const thumbB = document.getElementById('about-thumb-b');
  const n = heroImagenes.length;

  const mainSrc = imgUrl(heroImagenes[idx % n]);
  const srcA = imgUrl(heroImagenes[(idx + 1) % n]);
  const srcB = imgUrl(heroImagenes[(idx + 2) % n]);

  if (main) main.style.backgroundImage = `url('${mainSrc}')`;
  if (thumbA) thumbA.style.backgroundImage = `url('${srcA}')`;
  if (thumbB) thumbB.style.backgroundImage = `url('${srcB}')`;
}

function aplicarFotosSecciones(imagenes) {
  buildFilmstrip(imagenes);
  syncAboutWithHero(heroSlideIdx);
}

function initPillarCards() {
  document.querySelectorAll('.pillar-card').forEach((card, i) => {
    card.addEventListener('mouseenter', () => {
      document.querySelectorAll('.pillar-card').forEach(c => c.classList.remove('active-pillar'));
      card.classList.add('active-pillar');
      if (heroImagenes.length) {
        syncAboutWithHero((heroSlideIdx + i) % heroImagenes.length);
      }
    });
    card.addEventListener('click', () => {
      if (heroImagenes.length) {
        heroSlideIdx = (heroSlideIdx + i) % heroImagenes.length;
        document.querySelectorAll('.hero-bg-slide').forEach((s, j) => {
          s.classList.toggle('active', j === heroSlideIdx);
        });
        syncAboutWithHero(heroSlideIdx);
      }
    });
  });

  document.getElementById('about-thumb-a')?.addEventListener('click', () => {
    if (heroImagenes.length) {
      heroSlideIdx = (heroSlideIdx + 1) % heroImagenes.length;
      document.querySelectorAll('.hero-bg-slide').forEach((s, j) =>
        s.classList.toggle('active', j === heroSlideIdx));
      syncAboutWithHero(heroSlideIdx);
    }
  });
  document.getElementById('about-thumb-b')?.addEventListener('click', () => {
    if (heroImagenes.length) {
      heroSlideIdx = (heroSlideIdx + 2) % heroImagenes.length;
      document.querySelectorAll('.hero-bg-slide').forEach((s, j) =>
        s.classList.toggle('active', j === heroSlideIdx));
      syncAboutWithHero(heroSlideIdx);
    }
  });
}

async function cargarHeroImagenes() {
  try {
    const data = await apiFetch(`${API.publico}?action=hero-imagenes`);
    initHeroCarousel(data.imagenes);
    aplicarFotosSecciones(data.imagenes);
  } catch {
    initHeroCarousel(HERO_FALLBACK);
    aplicarFotosSecciones(HERO_FALLBACK);
  }
}

async function cargarStats() {
  try {
    const s = await apiFetch(`${API.publico}?action=stats`);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-disponibles', s.disponibles);
    set('bar-disponibles', s.disponibles);
    set('bar-adoptados', s.adoptados);
    set('hero-stat-adoptados', s.adoptados);
    set('hero-stat-total', s.total_animales);
    set('hero-stat-postulaciones', s.postulaciones);
    animarContadores();
  } catch (_) {}
}

function animarContadores() {
  document.querySelectorAll('[id^="hero-stat-"], .bridge-stat-num[id]').forEach(el => {
    const target = parseInt(el.textContent, 10);
    if (isNaN(target) || target === 0) return;
    let n = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const tick = () => {
      n += step;
      if (n >= target) { el.textContent = target; return; }
      el.textContent = n;
      requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  });
}

function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function fotosDeAnimal(a) {
  if (a.fotos?.length) return a.fotos.map(f => f.ruta || f);
  if (a.foto) return [a.foto];
  return [];
}

function emoji(especie) { return especieEmoji[especie] || '🐾'; }

function animalPhoto(a, id = 'card') {
  const fotos = fotosDeAnimal(a);
  if (fotos.length) {
    const items = fotos.map(r => ({ ruta: r }));
    return `<div class="animal-card-media">${buildCarousel(items, `carousel-${id}-${a.id_animal}`)}</div>`;
  }
  return `<div class="animal-card-image">${emoji(a.nombre_especie)}</div>`;
}

function diasDesde(fecha) {
  if (!fecha) return 999;
  const d = new Date(fecha);
  const hoy = new Date();
  return Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
}

function whatsappNumero(tel) {
  const digits = (tel || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('57')) return digits;
  if (digits.length === 10 && digits.startsWith('3')) return '57' + digits;
  return digits;
}

function urlAnimal(id) {
  return `${location.origin}${location.pathname}#animal-${id}`;
}

function badgesSalud(a) {
  const items = [];
  if (a.vacunado === 'Si') items.push('<span class="badge-salud badge-salud--ok">💉 Vacunado</span>');
  if (a.esterilizado === 'Si') items.push('<span class="badge-salud badge-salud--ok">✂️ Esterilizado</span>');
  if (a.desparasitado === 'Si') items.push('<span class="badge-salud badge-salud--ok">🛡️ Desparasitado</span>');
  if (a.compatible_ninos === 'Si') items.push('<span class="badge-salud badge-salud--info">👶 Bueno con niños</span>');
  if (a.compatible_ninos === 'No') items.push('<span class="badge-salud badge-salud--warn">👶 No recomendado con niños</span>');
  if (a.compatible_mascotas === 'Si') items.push('<span class="badge-salud badge-salud--info">🐾 Bueno con otras mascotas</span>');
  if (a.compatible_mascotas === 'No') items.push('<span class="badge-salud badge-salud--warn">🐾 Mejor solo en casa</span>');
  if (a.nivel_energia) {
    const icon = { Baja: '🐢', Media: '🐾', Alta: '⚡' }[a.nivel_energia] || '🐾';
    items.push(`<span class="badge-salud badge-salud--info">${icon} Energía ${a.nivel_energia.toLowerCase()}</span>`);
  }
  return items.length ? `<div class="badges-salud">${items.join('')}</div>` : '';
}

function perfilMiniBadges(a) {
  const mini = [];
  if (a.vacunado === 'Si') mini.push('💉');
  if (a.esterilizado === 'Si') mini.push('✂️');
  return mini.length ? `<span class="animal-mini-salud" title="Perfil de salud">${mini.join(' ')}</span>` : '';
}

function shareButtonsHTML(a) {
  const url = encodeURIComponent(urlAnimal(a.id_animal));
  const text = encodeURIComponent(`¡Mira a ${a.nombre}! Está en adopción en nuestro refugio 🐾 ${decodeURIComponent(url)}`);
  return `
    <div class="share-buttons">
      <a class="btn-share btn-share--wa" href="https://wa.me/?text=${text}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn-share btn-share--fb" href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener">Facebook</a>
      <button type="button" class="btn-share btn-share--copy" onclick="copiarEnlaceAnimal(${a.id_animal})">Copiar enlace</button>
    </div>`;
}

function copiarEnlaceAnimal(id) {
  const url = urlAnimal(id);
  navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado al portapapeles'))
    .catch(() => toast('No se pudo copiar. Comparte manualmente: ' + url, 'error'));
}
window.copiarEnlaceAnimal = copiarEnlaceAnimal;

function emptyStateHTML(icon, title, msg, btnHtml = '') {
  return `<div class="empty-state">
    <span class="empty-state-icon">${icon}</span>
    <h3>${title}</h3>
    <p>${msg}</p>${btnHtml}
  </div>`;
}
function badgesAnimal(a) {
  const tags = [];
  if (a.es_nuevo) tags.push('<span class="badge badge-nuevo">Nuevo</span>');
  if (a.destacado && !a.es_nuevo) tags.push('<span class="badge badge-star">Destacado</span>');
  if (a.tiene_fotos) tags.push('<span class="badge badge-foto">Con fotos</span>');
  return tags.join('');
}

function cardAnimalHTML(a, variant = 'grid') {
  const compact = variant === 'scroll';
  return `
    <article class="animal-card ${compact ? 'animal-card--compact' : ''}" data-id="${a.id_animal}">
      <div class="animal-card-badges">${badgesAnimal(a)}</div>
      ${animalPhoto(a, variant + '-' + a.id_animal)}
      <div class="animal-card-body">
        <h3>${a.nombre} ${perfilMiniBadges(a)}</h3>
        <p class="animal-meta">${a.nombre_especie}${a.raza ? ' · ' + a.raza : ''}</p>
        <div class="animal-tags">
          <span class="tag">${a.sexo}</span>
          ${a.edad != null ? `<span class="tag">${a.edad} años</span>` : ''}
          <span class="tag tag-disponible">Disponible</span>
        </div>
        ${compact ? '' : `<p class="animal-desc">${(a.descripcion || '').slice(0, 90)}${a.descripcion?.length > 90 ? '…' : ''}</p>`}
        <div class="animal-card-actions">
          <button class="btn btn-outline btn-sm" onclick="verDetalle(${a.id_animal})">Ver más</button>
          <button class="btn btn-primary btn-sm" onclick="abrirPostulacion(${a.id_animal})">Postularme ❤️</button>
        </div>
      </div>
    </article>`;
}

function renderScrollRow(containerId, lista) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = emptyStateHTML('🐾', 'Sin mascotas aquí', 'No hay animales en esta categoría por ahora.', '<a href="#animales" class="btn btn-outline btn-sm" style="margin-top:1rem">Ver todos</a>');
    return;
  }
  el.innerHTML = `<div class="animals-scroll-track">${lista.map(a => cardAnimalHTML(a, 'scroll')).join('')}</div>`;
  initCarouselsIn(el);
  initScrollButtons(el);
}

function initScrollButtons(wrap) {
  const track = wrap.querySelector('.animals-scroll-track');
  if (!track || track.scrollWidth <= track.clientWidth) return;

  const prev = document.createElement('button');
  prev.className = 'scroll-btn scroll-btn-prev';
  prev.type = 'button';
  prev.innerHTML = '‹';
  prev.onclick = () => track.scrollBy({ left: -320, behavior: 'smooth' });

  const next = document.createElement('button');
  next.className = 'scroll-btn scroll-btn-next';
  next.type = 'button';
  next.innerHTML = '›';
  next.onclick = () => track.scrollBy({ left: 320, behavior: 'smooth' });

  wrap.classList.add('has-scroll-btns');
  wrap.appendChild(prev);
  wrap.appendChild(next);
}

function renderAnimales(lista) {
  const grid = document.getElementById('animals-grid');
  if (!lista.length) {
    const msg = document.getElementById('filtro-especie')?.value
      ? 'No hay mascotas de ese tipo disponibles en este momento.'
      : 'No hay perros ni gatos disponibles ahora. ¡Vuelve pronto!';
    grid.innerHTML = emptyStateHTML('🏠', 'Catálogo vacío', msg);
    return;
  }
  grid.innerHTML = lista.map(a => cardAnimalHTML(a, 'grid')).join('');
  initCarouselsIn(grid);
}

function renderHistorias() {
  const grid = document.getElementById('historias-grid');
  if (!grid) return;

  if (!adoptados.length) {
    grid.innerHTML = emptyStateHTML(
      '🏠',
      'Próximamente más historias',
      'Aún no hay adopciones publicadas. Sé el primero en dar un hogar.',
      '<a href="#animales" class="btn btn-primary btn-sm" style="margin-top:1rem">Ver quién espera hogar</a>'
    );
    return;
  }

  grid.innerHTML = adoptados.map(a => {
    const fotos = fotosDeAnimal(a);
    const imgStyle = fotos[0] ? `style="background-image:url('${imgUrl(fotos[0])}')"` : '';
    const imgContent = fotos[0] ? '' : emoji(a.nombre_especie);
    const desc = a.descripcion
      ? a.descripcion.slice(0, 130) + (a.descripcion.length > 130 ? '…' : '')
      : `Encontró hogar el ${formatDate(a.fecha_adopcion)}. ¡Gracias a quienes adoptan con responsabilidad!`;

    return `
      <article class="historia-card historia-card--real">
        <div class="historia-img" ${imgStyle}>${imgContent}</div>
        <div class="historia-body">
          <span class="historia-badge">Adoptado ✓</span>
          <h3>${a.nombre} · ${a.nombre_especie}</h3>
          <p class="historia-fecha">Adopción: ${formatDate(a.fecha_adopcion)}</p>
          <p>${desc}</p>
        </div>
      </article>`;
  }).join('');
}

async function cargarHistorias() {
  try {
    adoptados = await apiFetch(`${API.publico}?action=adoptados`);
    renderHistorias();
  } catch {
    document.getElementById('historias-grid').innerHTML =
      '<p class="error-msg">No se pudieron cargar las historias.</p>';
  }
}

function initCatalogTabs() {
  document.querySelectorAll('.catalog-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      document.querySelectorAll('.catalog-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.catalog-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === id);
      });
    });
  });
}

function aplicarFiltros() {
  const texto = document.getElementById('buscar').value.toLowerCase();
  const especie = document.getElementById('filtro-especie').value;
  const orden = document.getElementById('filtro-orden').value;

  let lista = animales.filter(a => {
    const t = !texto || a.nombre.toLowerCase().includes(texto) ||
      a.nombre_especie.toLowerCase().includes(texto) ||
      (a.raza && a.raza.toLowerCase().includes(texto));
    return t && (!especie || a.nombre_especie === especie);
  });

  if (orden === 'nombre') {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (orden === 'edad') {
    lista.sort((a, b) => (a.edad ?? 99) - (b.edad ?? 99));
  } else {
    lista.sort((a, b) => new Date(b.fecha_ingreso) - new Date(a.fecha_ingreso));
  }

  renderAnimales(lista);
}

function llenarFiltroEspecies() {
  document.getElementById('filtro-especie').innerHTML =
    '<option value="">Perros y gatos</option>' +
    ESPECIES_PERMITIDAS.map(e => `<option value="${e}">${e}</option>`).join('');
}

function filtrar() { aplicarFiltros(); }

async function cargarAnimales() {
  const grid = document.getElementById('animals-grid');
  try {
    const data = await apiFetch(`${API.publico}?action=animales`);
    catalogo = data;
    animales = data.todos || [];

    const total = data.total ?? animales.length;
    document.getElementById('stat-disponibles').textContent = total;
    const barDisp = document.getElementById('bar-disponibles');
    if (barDisp) barDisp.textContent = total;

    const countEl = document.getElementById('catalog-count');
    if (countEl) countEl.textContent = `${total} mascota${total !== 1 ? 's' : ''} esperando hogar`;

    llenarFiltroEspecies();
    llenarSelectApadrinamiento();
    renderScrollRow('scroll-destacados', data.destacados || []);
    renderScrollRow('scroll-nuevos', data.nuevos || []);
    aplicarFiltros();
  } catch (err) {
    grid.innerHTML = `<div class="error-msg">No se pudo conectar.<br><small>${err.message}</small></div>`;
  }
}

function buscarAnimal(id) {
  return animales.find(x => x.id_animal == id)
    || catalogo.destacados?.find(x => x.id_animal == id)
    || catalogo.nuevos?.find(x => x.id_animal == id);
}

async function cargarRefugio() {
  try {
    const info = await apiFetch(`${API.publico}?action=info`);
    refugioInfo = info || {};
    if (!info.nombre) return;
    document.getElementById('header-nombre').textContent = info.nombre;
    document.getElementById('footer-nombre').textContent = info.nombre;
    if (info.descripcion) {
      document.getElementById('hero-descripcion').textContent = info.descripcion;
      document.getElementById('about-descripcion').textContent = info.descripcion;
      document.getElementById('footer-descripcion').textContent = info.descripcion.slice(0, 120) + '…';
    }
    if (info.mision) document.getElementById('about-mision').textContent = info.mision;
    if (info.correo) {
      const el = document.getElementById('footer-correo');
      el.textContent = info.correo;
      el.href = `mailto:${info.correo}`;
      const cEl = document.getElementById('contacto-correo');
      if (cEl) { cEl.textContent = info.correo; cEl.href = `mailto:${info.correo}`; }
    }
    if (info.telefono) {
      document.getElementById('footer-telefono').textContent = info.telefono;
      const tEl = document.getElementById('contacto-telefono');
      if (tEl) tEl.textContent = info.telefono;
    }
    if (info.direccion) {
      document.getElementById('footer-direccion').textContent = info.direccion;
      const dEl = document.getElementById('contacto-direccion');
      if (dEl) dEl.textContent = info.direccion;
    }
    if (info.horario) {
      document.getElementById('footer-horario').textContent = info.horario;
      const hEl = document.getElementById('contacto-horario');
      if (hEl) hEl.textContent = info.horario;
    }
    document.title = `Adopta — ${info.nombre}`;
    setupWhatsApp(info);
    setupMapa(info);
  } catch (_) { /* datos por defecto en HTML */ }
}

function setupWhatsApp(info) {
  const wa = whatsappNumero(info.whatsapp || info.telefono);
  const float = document.getElementById('whatsapp-float');
  const btnContacto = document.getElementById('btn-whatsapp-contacto');
  if (!wa) {
    float?.setAttribute('hidden', '');
    return;
  }
  const msg = encodeURIComponent('Hola, me gustaría información sobre adopciones en el refugio.');
  const href = `https://wa.me/${wa}?text=${msg}`;
  if (float) { float.href = href; float.removeAttribute('hidden'); }
  if (btnContacto) btnContacto.href = href;
}

function setupMapa(info) {
  const direccion = info.direccion || 'Refugio de Animales Colombia';
  const iframe = document.getElementById('mapa-embed');
  const btnMaps = document.getElementById('btn-maps');
  const q = encodeURIComponent(direccion);
  if (iframe) iframe.src = `https://maps.google.com/maps?q=${q}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  if (btnMaps) btnMaps.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function llenarSelectApadrinamiento() {
  const sel = document.getElementById('donacion-animal');
  if (!sel) return;
  if (!animales.length) {
    sel.innerHTML = '<option value="">No hay animales disponibles</option>';
    return;
  }
  sel.innerHTML = animales.map(a =>
    `<option value="${a.id_animal}">${a.nombre} (${a.nombre_especie})</option>`
  ).join('');
}

async function cargarCaptcha() {
  const data = await apiFetch(API.captcha);
  document.getElementById('captcha-pregunta').textContent = data.pregunta;
  captchaOk = false;
}

function verDetalle(id) {
  const a = buscarAnimal(id);
  if (!a) return;
  const fotos = fotosDeAnimal(a);
  const media = fotos.length
    ? buildCarousel(fotos.map(r => ({ ruta: r })), `carousel-detalle-${id}`)
    : `<div class="detalle-hero">${emoji(a.nombre_especie)}</div>`;

  document.getElementById('detalle-contenido').innerHTML = `
    <div class="detalle-media">${media}</div>
    <div class="detalle-body">
      <h2>${a.nombre}</h2>
      <p class="animal-meta">${a.nombre_especie}${a.raza ? ' · ' + a.raza : ''}</p>
      ${badgesSalud(a)}
      <div class="detalle-perfil-grid">
        <div><strong>Vacunación</strong>${a.vacunado === 'Si' ? 'Al día' : 'Pendiente / parcial'}</div>
        <div><strong>Esterilización</strong>${a.esterilizado === 'Si' ? 'Sí' : 'No'}</div>
        <div><strong>Desparasitado</strong>${a.desparasitado === 'Si' ? 'Sí' : 'No'}</div>
        <div><strong>Energía</strong>${a.nivel_energia || 'Media'}</div>
        <div><strong>Con niños</strong>${a.compatible_ninos || 'Desconocido'}</div>
        <div><strong>Con otras mascotas</strong>${a.compatible_mascotas || 'Desconocido'}</div>
      </div>
      <div class="detalle-info">
        <div><strong>Sexo</strong>${a.sexo}</div>
        <div><strong>Edad</strong>${a.edad != null ? a.edad + ' años' : 'No registrada'}</div>
        <div><strong>Ingreso</strong>${formatDate(a.fecha_ingreso)}</div>
        <div><strong>Estado</strong><span class="tag tag-disponible">Disponible</span></div>
      </div>
      <p class="detalle-desc">${a.descripcion || 'Sin descripción adicional.'}</p>
      ${shareButtonsHTML(a)}
      <button class="btn btn-primary btn-block" onclick="cerrarDetalle(); abrirPostulacion(${a.id_animal})">
        Quiero postularme para adoptar ❤️
      </button>
    </div>`;
  document.getElementById('modal-detalle').classList.add('active');
  history.replaceState(null, '', urlAnimal(id));
  initCarouselsIn(document.getElementById('detalle-contenido'));
}

function cerrarDetalle() {
  document.getElementById('modal-detalle').classList.remove('active');
  if (location.hash.startsWith('#animal-')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

async function abrirPostulacion(id) {
  const a = buscarAnimal(id);
  if (!a) return;
  document.getElementById('post-id-animal').value = id;
  document.getElementById('post-resumen').innerHTML = `
    <strong>${a.nombre}</strong> (${a.nombre_especie}) — Al enviar, quedará <em>en proceso de adopción</em> y saldrá del listado público.`;
  document.getElementById('form-postulacion').reset();
  document.getElementById('post-id-animal').value = id;
  document.getElementById('captcha-respuesta').value = '';
  document.getElementById('website').value = '';
  await cargarCaptcha();
  document.getElementById('modal-postulacion').classList.add('active');
}

function cerrarPostulacion() { document.getElementById('modal-postulacion').classList.remove('active'); }

function formatDate(str) {
  if (!str) return '—';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}

document.getElementById('form-postulacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  body.adultos_hogar = parseInt(body.adultos_hogar || 0, 10);
  body.ninos_hogar = parseInt(body.ninos_hogar || 0, 10);
  body.id_animal = parseInt(body.id_animal, 10);

  try {
    const cap = await apiFetch(API.captcha, {
      method: 'POST',
      body: JSON.stringify({ respuesta: parseInt(document.getElementById('captcha-respuesta').value, 10) })
    });
    if (!cap.valid) throw new Error('Verificación antibot incorrecta');

    await apiFetch(`${API.postulaciones}?action=postular`, {
      method: 'POST', body: JSON.stringify(body)
    });

    if (body.cedula) {
      sessionStorage.setItem('refugio_cedula', body.cedula);
      document.getElementById('consulta-cedula').value = body.cedula;
    }

    cerrarPostulacion();
    cerrarDetalle();
    document.getElementById('exito-postulacion').classList.add('active');
    await cargarAnimales();
    await cargarHistorias();
  } catch (err) {
    toast(err.message, 'error');
    await cargarCaptcha();
  }
});

document.getElementById('cerrar-exito').addEventListener('click', () => {
  document.getElementById('exito-postulacion').classList.remove('active');
});

document.getElementById('btn-ir-mi-solicitud').addEventListener('click', () => {
  document.getElementById('exito-postulacion').classList.remove('active');
  document.getElementById('mi-solicitud').scrollIntoView({ behavior: 'smooth' });
  const cedula = sessionStorage.getItem('refugio_cedula');
  if (cedula) consultarSolicitud(cedula);
});

function estadoLabel(estado) {
  const map = {
    Pendiente: { text: 'En revisión', class: 'estado-pendiente' },
    Aprobada: { text: '¡Aprobada!', class: 'estado-aprobada' },
    Rechazada: { text: 'No aprobada', class: 'estado-rechazada' }
  };
  return map[estado] || { text: estado, class: '' };
}

async function consultarSolicitud(cedula) {
  const box = document.getElementById('resultado-solicitud');
  box.hidden = false;
  box.innerHTML = '<div class="skeleton-consulta" style="height:80px;border-radius:12px;background:#ece8e4;animation:skeleton-pulse 1.4s ease-in-out infinite"></div>';

  try {
    const data = await apiFetch(`${API.publico}?action=mi-solicitud&cedula=${encodeURIComponent(cedula)}`);
    sessionStorage.setItem('refugio_cedula', cedula);

    if (!data.postulaciones?.length) {
      box.innerHTML = '<p class="empty">No hay postulaciones registradas con esta cédula.</p>';
      return;
    }

    box.innerHTML = data.postulaciones.map(p => {
      const est = estadoLabel(p.estado_postulacion);
      const codigoCert = p.certificado_codigo ? String(p.certificado_codigo).trim() : '';
      if (codigoCert) {
        sessionStorage.setItem('refugio_certificado_codigo', codigoCert);
      }
      const certUrl = codigoCert
        ? `certificado.html?codigo=${encodeURIComponent(codigoCert)}`
        : '';
      const certPdf = codigoCert
        ? `api/certificado_pdf.php?codigo=${encodeURIComponent(codigoCert)}`
        : '';
      const certBtns = codigoCert ? `
        <div class="cert-actions">
          <a class="btn btn-primary" href="${certUrl}" target="_blank" rel="noopener">Ver mi certificado</a>
          <a class="btn btn-outline" href="/${certPdf}" target="_blank" rel="noopener">Descargar PDF</a>
        </div>
        <p class="cert-hint">Código: <strong>${codigoCert}</strong></p>
      ` : (p.estado_postulacion === 'Aprobada'
        ? '<p class="hint">Su adopción fue aprobada. Si no ve el certificado, consulte con el refugio o ingrese su código en la página del certificado.</p>'
        : (p.estado_postulacion === 'Pendiente'
        ? '<p class="hint">Su encuesta está siendo evaluada. Puede haber otras postulaciones para este animal.</p>'
        : (p.estado_postulacion === 'Rechazada'
          ? '<p class="hint">Esta postulación no fue seleccionada. Puede postularse por otros animales disponibles.</p>'
          : '')));

      return `
        <article class="solicitud-card">
          <div class="solicitud-head">
            <h3>${p.animal} <small>(${p.nombre_especie})</small></h3>
            <span class="estado-tag ${est.class}">${est.text}</span>
          </div>
          <p class="solicitud-meta">Postulación del ${formatDate(p.fecha_postulacion?.split(' ')[0] || p.fecha_postulacion)}</p>
          ${p.estado_postulacion === 'Aprobada' ? `<p>¡Felicitaciones, ${p.nombres}! Su adopción fue aprobada.</p>` : ''}
          ${certBtns}
        </article>`;
    }).join('');
  } catch (err) {
    box.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

document.getElementById('form-consulta-cedula').addEventListener('submit', (e) => {
  e.preventDefault();
  const cedula = document.getElementById('consulta-cedula').value.trim();
  if (cedula) consultarSolicitud(cedula);
});

document.getElementById('btn-recargar-captcha').addEventListener('click', cargarCaptcha);
document.getElementById('cerrar-detalle').addEventListener('click', cerrarDetalle);
document.getElementById('cerrar-postulacion').addEventListener('click', cerrarPostulacion);
document.getElementById('buscar').addEventListener('input', aplicarFiltros);
document.getElementById('filtro-especie').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-orden')?.addEventListener('change', aplicarFiltros);

document.getElementById('donacion-tipo')?.addEventListener('change', (e) => {
  const wrap = document.getElementById('donacion-animal-wrap');
  const sel = document.getElementById('donacion-animal');
  if (e.target.value === 'Apadrinamiento') {
    wrap.hidden = false;
    sel.required = true;
  } else {
    wrap.hidden = true;
    sel.required = false;
  }
});

document.getElementById('donacion-monto')?.addEventListener('change', (e) => {
  const wrap = document.getElementById('donacion-monto-otro-wrap');
  const input = document.getElementById('donacion-monto-otro');
  const esOtro = e.target.value === 'Otro';
  wrap.hidden = !esOtro;
  input.required = esOtro;
  if (!esOtro) input.value = '';
});

document.getElementById('form-donacion')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  if (body.monto_sugerido === 'Otro') {
    const montoOtro = (document.getElementById('donacion-monto-otro')?.value || '').trim();
    if (!montoOtro) {
      toast('Indique el monto que desea donar', 'error');
      return;
    }
    body.monto_sugerido = montoOtro;
  }
  delete body.monto_otro;
  if (body.tipo === 'Apadrinamiento' && body.id_animal) {
    body.id_animal = parseInt(body.id_animal, 10);
  } else {
    delete body.id_animal;
  }
  try {
    const res = await apiFetch(`${API.publico}?action=donacion`, { method: 'POST', body: JSON.stringify(body) });
    toast(res.message || 'Solicitud enviada');
    e.target.reset();
    document.getElementById('donacion-animal-wrap').hidden = true;
    document.getElementById('donacion-monto-otro-wrap').hidden = true;
    document.getElementById('donacion-monto-otro').required = false;
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('form-voluntariado')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    const res = await apiFetch(`${API.publico}?action=voluntariado`, { method: 'POST', body: JSON.stringify(body) });
    toast(res.message || 'Solicitud enviada');
    e.target.reset();
  } catch (err) {
    toast(err.message, 'error');
  }
});

window.verDetalle = verDetalle;
window.abrirPostulacion = abrirPostulacion;
window.cerrarDetalle = cerrarDetalle;

document.getElementById('year').textContent = new Date().getFullYear();

const cedulaGuardada = sessionStorage.getItem('refugio_cedula');
if (cedulaGuardada) {
  document.getElementById('consulta-cedula').value = cedulaGuardada;
}

cargarRefugio();
cargarHeroImagenes();
cargarStats();
cargarAnimales();
cargarHistorias();
initCatalogTabs();
initScrollReveal();
initPillarCards();

if (location.hash === '#mi-solicitud' && cedulaGuardada) {
  setTimeout(() => consultarSolicitud(cedulaGuardada), 300);
}

if (location.hash.startsWith('#animal-')) {
  const idAnimal = parseInt(location.hash.replace('#animal-', ''), 10);
  if (idAnimal) {
    setTimeout(async () => {
      if (!animales.length) await cargarAnimales();
      verDetalle(idAnimal);
    }, 600);
  }
}
