/* Selected work: la lista se fija con el scroll y los proyectos se abren
   uno a uno. Los enlaces navegan a cada proyecto. Nunca pasa a estática por ancho de pantalla, solo con
   prefers-reduced-motion (ahí se ven todos los proyectos abiertos). */
(() => {
  'use strict';

  /* ================== AJUSTES ================== */
  const CONFIG = {
    step: 0.9,         // scroll (en alturas de pantalla) que dura abierto cada proyecto
    stepTouch: 0.6,    // lo mismo en pantallas táctiles
    minMedia: 0.4,     // móvil muy bajo: la imagen nunca baja del 40% de su alto
    stagger: 90         // ms entre filas al aparecer
  };

  const section = document.querySelector('.selected-work');
  if (!section) return;
  const track = section.querySelector('.selected-work__track');
  const stage = section.querySelector('.selected-work__stage');
  const list = section.querySelector('.selected-work__list');
  const items = [...section.querySelectorAll('.sw')];
  const heads = items.map((it) => it.querySelector('.sw__head'));
  const bodies = items.map((it) => it.querySelector('.sw__body'));
  const medias = items.map((it) => it.querySelector('.sw__media'));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const mobileMQ = matchMedia('(max-width: 699px)');
  const N = items.length;

  let pinned = false;     // si la lista se queda fija y se abre con el scroll
  let active = -2;        // proyecto abierto (-1 = ninguno)
  let pinStart = 0;       // posición de scroll donde la lista se queda fija
  let distance = 0;       // scroll total mientras está fija
  let lastW = 0;
  let lastH = 0;
  let ticking = false;

  /* ---------- 1. Aparición de la cabecera y las filas ---------- */
  const reveals = [...section.querySelectorAll('.selected-reveal'), ...items];
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    let nextFree = 0;
    const io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .sort((a, b) => reveals.indexOf(a) - reveals.indexOf(b))
        .forEach((el) => {
          const now = performance.now();
          const start = Math.max(now, nextFree);
          el.style.setProperty('--d', Math.round(start - now) + 'ms');
          el.classList.add('is-in');
          nextFree = start + CONFIG.stagger;
          io.unobserve(el);
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.2 });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- 2. Abrir un proyecto ---------- */
  function open(index) {
    if (index === active) return;
    active = index;
    items.forEach((it, i) => {
      const on = i === index;
      it.classList.toggle('is-open', on);
      heads[i].setAttribute('aria-expanded', String(on));
      // lo que está cerrado no se puede enfocar con el teclado
      it.querySelector('.sw__panel').inert = !on;
    });
  }

  /* ---------- 3. Que el proyecto abierto quepa entero en pantalla ---------- */
  // Ordenador: si la ventana es baja, los espacios verticales y la imagen se
  // reducen todos en la misma proporción (--sv), así se mantiene el diseño.
  // Móvil: solo se reduce el alto de la imagen.
  function fit(vh) {
    section.style.removeProperty('--media-max');
    section.style.setProperty('--sv', '1');
    const rowsText = heads.reduce((sum, h) => sum + h.offsetHeight, 0);

    if (!mobileMQ.matches) {
      const u = section.clientWidth / 1440;                        // 1px de Figma
      // lo que se encoge: 118 arriba + 96 entre filas + 96 hasta la imagen + 474 de imagen + 38 abajo
      const scalable = (118 + 96 * (N - 1) + 96 + 474 + 38) * u;
      // el párrafo y "View case" tienen que caber al lado de la imagen
      const textH = Math.max(...items.map((it) => {
        const t = it.querySelector('.sw__text');
        return t.querySelector('p').offsetHeight + t.querySelector('.sw__cta').offsetHeight +
               parseFloat(getComputedStyle(t).rowGap || 0);
      }));
      let sv = (vh - rowsText) / scalable;
      sv = Math.min(1, Math.max(sv, textH / (474 * u), 0.45));
      section.style.setProperty('--sv', sv.toFixed(4));
      return;
    }

    const pinTop = parseFloat(getComputedStyle(stage).paddingTop) || 0;
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    let extra = 0;       // lo que ocupa el panel además de la imagen
    let natural = 0;     // alto de la imagen sin reducir
    bodies.forEach((b, i) => {
      extra = Math.max(extra, b.offsetHeight - medias[i].offsetHeight);
      natural = Math.max(natural, medias[i].offsetHeight);
    });
    const room = Math.floor(vh - pinTop - rowsText - gap * (N - 1) - extra - 20);
    if (room < natural) {
      section.style.setProperty('--media-max', Math.max(room, natural * CONFIG.minMedia) + 'px');
    }
  }

  // alto del escenario con todos los proyectos cerrados: arriba + filas + "All work"
  function closedHeight() {
    const cs = getComputedStyle(stage);
    const all = section.querySelector('.selected-work__all');
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    const rows = heads.reduce((sum, h) => sum + h.offsetHeight, 0);
    return (parseFloat(cs.paddingTop) || 0) + rows + gap * (N - 1) +
      (all ? all.offsetHeight + (parseFloat(getComputedStyle(all).marginTop) || 0) : 0);
  }

  /* ---------- 4. Fijar la lista y abrir según el scroll ---------- */
  function measure() {
    lastW = window.innerWidth;
    lastH = window.innerHeight;
    pinned = !reduceMotion.matches;
    section.classList.toggle('is-static', !pinned);

    if (!pinned) {
      section.style.marginBottom = '';
      track.style.height = '';
      stage.style.position = '';
      stage.style.top = '';
      stage.style.height = '';
      section.style.removeProperty('--media-max');
      section.style.removeProperty('--sv');
      active = -2;
      items.forEach((it) => it.classList.add('is-open'));
      heads.forEach((h) => h.setAttribute('aria-expanded', 'true'));
      items.forEach((it) => { it.querySelector('.sw__panel').inert = false; });
      return;
    }

    const vh = lastH;
    fit(vh);
    // en táctil, cada proyecto dura menos scroll (con el dedo se hacía eterno)
    distance = Math.round(N * (coarse.matches ? CONFIG.stepTouch : CONFIG.step) * vh);
    stage.style.position = 'sticky';
    stage.style.top = '0px';
    stage.style.height = vh + 'px';
    // Con todo cerrado, el escenario (una pantalla) deja un hueco vacío bajo
    // "All work". La siguiente sección sube a ocuparlo mientras la lista
    // sigue fija, ya cerrada: la pista se alarga ese hueco y la sección lo
    // recupera con un margen negativo, así la separación con la siguiente
    // es solo --space-section, como en el resto de la web.
    const empty = Math.max(0, Math.round(vh - closedHeight()));
    track.style.height = vh + distance + empty + 'px';
    section.style.marginBottom = -empty + 'px';
    pinStart = track.getBoundingClientRect().top + window.scrollY;
    active = -2;
    update();
  }

  function update() {
    ticking = false;
    if (!pinned) return;
    const q = (window.scrollY - pinStart) / distance;   // 0 → 1 mientras está fija
    let index = -1;
    if (q >= 0 && q < 1) index = Math.min(N - 1, Math.floor(q * N));
    open(index);
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // en el móvil la barra del navegador cambia el alto al hacer scroll: eso no cuenta
      const smallJump = Math.abs(window.innerHeight - lastH) < 120;
      if (window.innerWidth === lastW && coarse.matches && smallJump) return;
      measure();
    }, 120);
  });
  reduceMotion.addEventListener('change', measure);

  // clic en una fila: ir al punto del scroll donde ese proyecto está abierto
  heads.forEach((head, i) => {
    head.addEventListener('click', () => {
      // en táctil no hay salto (pelea con el dedo al hacer scroll): tocar el
      // título lleva directamente al caso, esté abierto o cerrado
      if (coarse.matches) {
        const cta = items[i].querySelector('.sw__cta');
        if (cta) window.location.href = cta.href;
        return;
      }
      if (!pinned) return;
      const top = pinStart + (i + 0.35) * (distance / N);
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  measure();
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
