/* All my work: entrada escalonada, reescritura letra a letra en hover y
   el subtítulo acercándose al título. Lógica (se quita la barra de demo y el
   encabezado propio del prototipo: el <h2> de esta sección ya se revela
   con el sistema genérico de main.js). */
(() => {
  'use strict';

  const CONFIG = {
    // 'codigo' = letras al azar que se van ordenando de izquierda a derecha
    rewrite: 'codigo',
    titleTime: 520,   // ms que tarda en reescribirse el título
    tagsTime: 460,    // ms que tarda en reescribirse el subtítulo
    stagger: 90,      // ms entre un título y el siguiente al entrar
    groupPause: 140   // ms extra al pasar de un grupo al siguiente
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

  /* ---------- 2. Reescritura del texto ---------- */
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const UPPER = LOWER.toUpperCase();
  const DIGITS = '0123456789';
  const SYMBOLS = '#/*+=_';
  const pick = (str) => str[(Math.random() * str.length) | 0];

  function randomGlyph(ch) {
    if (Math.random() < 0.12) return pick(SYMBOLS);
    if (/\d/.test(ch)) return pick(DIGITS);
    if (ch !== ch.toLowerCase()) return pick(UPPER);
    return pick(LOWER);
  }

  // parte el texto en letras (una sola vez); espacios y la flecha se quedan igual
  function letters(el) {
    if (el._letters) return el._letters;
    el._html = el.innerHTML;
    const list = [];
    [...el.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        if (/[\p{L}\p{N}]/u.test(ch)) {
          const span = document.createElement('span');
          span.className = 'ch';
          span.textContent = ch;
          frag.appendChild(span);
          list.push(span);
        } else {
          frag.appendChild(document.createTextNode(ch));
        }
      }
      node.replaceWith(frag);
    });
    el._letters = list;
    return list;
  }

  // vuelve a dejar el texto tal cual (con su interletraje original)
  function restore(el) {
    if (el._raf) cancelAnimationFrame(el._raf);
    el._raf = 0;
    if (el._letters) {
      el.innerHTML = el._html;
      el._letters = null;
    }
  }

  function stopRewrite(owner, chars) {
    if (owner._raf) cancelAnimationFrame(owner._raf);
    owner._raf = 0;
    chars.forEach((span) => span.classList.remove('is-scr', 'is-hid'));
  }

  // una vuelta de reescritura del texto entero
  function rewrite(el, duration, onDone) {
    runRewrite(el, letters(el), duration, onDone);
  }

  // una vuelta de reescritura sobre unas letras concretas; onDone se llama al terminar
  function runRewrite(owner, chars, duration, onDone) {
    const el = owner;
    stopRewrite(owner, chars);
    const n = chars.length;
    if (!n || reduceMotion.matches) {
      if (onDone) onDone();
      return;
    }

    const mode = CONFIG.rewrite;
    const t0 = performance.now();
    const plan = chars.map((span, i) => {
      const k = n > 1 ? i / (n - 1) : 1;
      return mode === 'tecleo'
        ? { span, start: 0, end: 60 + k * (duration - 60), last: -1 }
        : { span, start: k * duration * 0.3, end: duration * 0.35 + k * duration * 0.65, last: -1 };
    });

    if (mode === 'tecleo') chars.forEach((span) => span.classList.add('is-hid'));

    const tick = (now) => {
      const t = now - t0;
      let running = false;
      for (const p of plan) {
        if (t >= p.end) {
          p.span.classList.remove('is-scr', 'is-hid');
          continue;
        }
        running = true;
        if (mode === 'codigo' && t >= p.start && t - p.last > 50) {
          p.span.dataset.g = randomGlyph(p.span.textContent);
          p.span.classList.add('is-scr');
          p.last = t;
        }
      }
      if (running) {
        el._raf = requestAnimationFrame(tick);
      } else {
        el._raf = 0;
        if (onDone) onDone();
      }
    };
    el._raf = requestAnimationFrame(tick);
  }

  /* ---------- 3. Hover ---------- */
  const pointer = { x: -1, y: -1 };

  function measure(item) {
    const title = item.querySelector('.work-item__title').getBoundingClientRect();
    const tags = item.querySelector('.work-item__tags').getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(item).columnGap) || 26;
    const shift = Math.min(0, title.right + gap - tags.left);
    item.style.setProperty('--shift', shift.toFixed(2) + 'px');
  }

  // hover: el título y el subtítulo se reescriben una sola vez
  function enter(item) {
    if (item.classList.contains('is-hover')) return;
    measure(item);
    item.classList.add('is-hover');
    item._phase = 'intro';
    const title = item.querySelector('.work-item__title');
    const tags = item.querySelector('.work-item__move');
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      if (item._phase !== 'intro') {
        // el ratón se fue durante la reescritura: dejar el texto limpio
        restore(title);
        restore(tags);
      } else {
        item._phase = 'rest';
      }
    };
    rewrite(title, CONFIG.titleTime, done);
    rewrite(tags, CONFIG.tagsTime, done);
  }

  // al salir: el subtítulo vuelve a su sitio y el texto queda normal
  function leave(item) {
    clearTimeout(item._wait);
    item.classList.remove('is-hover');
    const wasIntro = item._phase === 'intro';
    item._phase = null;
    if (!wasIntro) {
      restore(item.querySelector('.work-item__title'));
      restore(item.querySelector('.work-item__move'));
    }
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
      // todavía se está colocando: reescribir cuando termine
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
