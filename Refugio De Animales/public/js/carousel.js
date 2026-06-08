function buildCarousel(fotos, carouselId = 'carousel') {
  const list = (fotos || []).filter(Boolean);
  if (!list.length) return '';
  const slides = list.map((f, i) => {
    const src = f.ruta ? `/${f.ruta}` : (f.startsWith('uploads') ? `/${f}` : f);
    return `<div class="carousel-slide${i === 0 ? ' active' : ''}" data-index="${i}">
      <img src="${src}" alt="Foto ${i + 1}">
    </div>`;
  }).join('');
  const dots = list.length > 1
    ? `<div class="carousel-dots">${list.map((_, i) =>
        `<button type="button" class="carousel-dot${i === 0 ? ' active' : ''}" data-carousel="${carouselId}" data-index="${i}"></button>`
      ).join('')}</div>`
    : '';
  const nav = list.length > 1
    ? `<button type="button" class="carousel-btn prev" data-carousel="${carouselId}" data-dir="-1">‹</button>
       <button type="button" class="carousel-btn next" data-carousel="${carouselId}" data-dir="1">›</button>`
    : '';
  return `<div class="carousel" id="${carouselId}">${nav}<div class="carousel-track">${slides}</div>${dots}</div>`;
}

function initCarousel(root) {
  if (!root) return;
  const id = root.id;
  const slides = root.querySelectorAll('.carousel-slide');
  if (slides.length < 2) return;

  let current = 0;
  function goTo(idx) {
    current = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    root.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === current));
  }

  root.querySelectorAll('.carousel-btn').forEach(btn => {
    btn.addEventListener('click', () => goTo(current + parseInt(btn.dataset.dir, 10)));
  });
  root.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => goTo(parseInt(dot.dataset.index, 10)));
  });
}

function initCarouselsIn(container) {
  (container || document).querySelectorAll('.carousel').forEach(initCarousel);
}

window.buildCarousel = buildCarousel;
window.initCarousel = initCarousel;
window.initCarouselsIn = initCarouselsIn;
