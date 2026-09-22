/* All my work: entrada de grupo en grupo y de título en título, y
   reescritura del texto real en hover. Los enlaces navegan a cada proyecto.
   El <h2> de la sección se revela con el sistema genérico de main.js. */
(() => {
  'use strict';

  /* ================== AJUSTES ================== */
  const CONFIG = {
    // Efecto al pasar el ratón (una sola vez, al entrar en la fila): el
    // estilo (aino/locomotive) y sus tiempos se eligen en rewrite.js
    ainoTitle: 600,    // ms (aino) para el título
    ainoTags: 500,     // ms (aino) para el subtítulo
    stagger: 90,       // ms entre un título y el siguiente al entrar
    groupPause: 140    // ms extra al pasar de un grupo al siguiente
  };

  const root = document.querySelector('.all-work');
  if (!root) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const items = [...root.querySelectorAll('.work-item')];

  /* ---------- 1. Entrada de grupo en grupo y de título en título ---------- */
  const TITLE_IN = 1300;  // lo que tarda un título en colocarse (igual que en el CSS)
  let nextFree = 0;
  let lastGroup = null;
  let io = null;

  function show(el) {
    if (el.classList.contains('is-in')) return;
    if (io) io.unobserve(el);
    const group = el.closest('.work-group');
    const now = performance.now();
    let start = Math.max(now, nextFree);
    if (start > now && lastGroup && group !== lastGroup) start += CONFIG.groupPause;
    el.style.setProperty('--d', Math.round(start - now) + 'ms');
    el.classList.add('is-in');
    el._readyAt = start + TITLE_IN;
    // la categoría no ocupa turno: entra a la vez que su primer título
    nextFree = el.classList.contains('work-group__label') ? start : start + CONFIG.stagger;
    lastGroup = group;
  }

  const targets = [...root.querySelectorAll('.work-group__label, .work-item')];

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
  } else {
    nextFree = performance.now() + 180;
    io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .sort((x, y) => targets.indexOf(x) - targets.indexOf(y)) // orden de la página
        .forEach(show);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.3 });
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- 2. Reescritura del texto: assets/js/rewrite.js ---------- */
  const { run: rewrite, reset } = window.Rewrite;

  /* ---------- 3. Hover ---------- */
  const pointer = { x: -1, y: -1 };

  function measure(item) {
    const title = item.querySelector('.work-item__title').getBoundingClientRect();
    const tags = item.querySelector('.work-item__tags').getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(item).columnGap) || 26;
    const shift = Math.min(0, title.right + gap - tags.left);
    item.style.setProperty('--shift', shift.toFixed(2) + 'px');
  }

  // al entrar: el título y el subtítulo se reescriben una vez y el subtítulo se acerca
  function enter(item) {
    if (item.classList.contains('is-hover')) return;
    const title = item.querySelector('.work-item__title');
    const tags = item.querySelector('.work-item__move');
    reset(title);    // se mide con el texto normal, antes de reescribir
    reset(tags);
    measure(item);
    item.classList.add('is-hover');
    rewrite(title, CONFIG.ainoTitle);
    rewrite(tags, CONFIG.ainoTags);
  }

  // al salir: el subtítulo vuelve (si la reescritura no ha acabado, termina sola)
  function leave(item) {
    clearTimeout(item._wait);
    item.classList.remove('is-hover');
  }

  // mientras se hace scroll no se activa nada (evita el parpadeo de filas
  // que pasan por debajo del ratón); al parar, se activa la que quede debajo
  let scrolling = false;
  let scrollTimer = 0;

  function tryEnter(item) {
    if (scrolling || !canHover.matches) return;
    clearTimeout(item._wait);
    if (!item.classList.contains('is-in')) show(item);   // si aún no había entrado, que entre ya
    const wait = (item._readyAt || 0) - performance.now();
    if (wait > 0) {
      // todavía se está colocando: empezar cuando termine
      item._wait = setTimeout(() => { if (item.matches(':hover')) tryEnter(item); }, wait);
      return;
    }
    enter(item);
  }

  function syncHover() {
    const el = pointer.x < 0 ? null : document.elementFromPoint(pointer.x, pointer.y);
    const current = el && el.closest ? el.closest('.work-item') : null;
    items.forEach((i) => { if (i !== current && i.classList.contains('is-hover')) leave(i); });
    if (current) tryEnter(current);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrolling = false;
      if (canHover.matches) syncHover();
    }, 140);
  }, { passive: true });

  items.forEach((item) => {
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      const moved = e.clientX !== pointer.x || e.clientY !== pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (moved) {
        tryEnter(item);
      } else {
        // el ratón no se ha movido: la fila ha llegado por scroll, esperar a ver
        clearTimeout(item._wait);
        item._wait = setTimeout(() => { if (item.matches(':hover')) tryEnter(item); }, 90);
      }
    });
    item.addEventListener('pointerleave', () => leave(item));
    item.addEventListener('focus', () => {
      if (item.matches(':focus-visible')) enter(item);
    });
    item.addEventListener('blur', () => leave(item));
  });

  window.addEventListener('resize', () => {
    items.filter((i) => i.classList.contains('is-hover')).forEach(measure);
  });
})();
