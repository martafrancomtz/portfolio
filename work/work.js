(() => {
  'use strict';

  const CONFIG = {
    zoom: 2.4,      // zoom de la imagen dentro del círculo (lado corto = zoom × diámetro)
    follow: 20,     // seguimiento del ratón con un muelle sin rebote (más alto = más pegado)
    morph: 12,      // velocidad imagen ⇄ círculo
    open: 13,       // velocidad círculo → pantalla completa al hacer clic
    openDelay: 550  // ms hasta navegar al proyecto
  };

  const work = document.querySelector('.work');
  const orb = document.querySelector('.orb');
  const probe = document.querySelector('.orb-probe');
  if (!work || !orb || !probe) return;

  // En pantallas táctiles no hay hover: los proyectos funcionan como enlaces normales
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const root = document.documentElement;
  const scaleEl = orb.querySelector('.orb__scale');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let state = 'idle'; // idle | active | leaving | opening
  let active = null;  // .project activo
  let layers = [];    // imágenes dentro del círculo
  let swapId = 0;
  let rafId = 0;
  let lastT = 0;
  let leaveTimer = 0;
  let openTimer = 0;
  let posRate = CONFIG.morph;
  let sizeRate = CONFIG.morph;
  let vx = 0;
  let vy = 0;

  const pointer = { x: 0, y: 0, known: false };
  const cur = { x: 0, y: 0, w: 0, h: 0, r: 0 }; // estado actual del círculo
  const tgt = { x: 0, y: 0, w: 0, h: 0, r: 0 }; // hacia dónde va

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const diameter = () => probe.getBoundingClientRect().width || 190;

  function pair(str) {
    const n = String(str || '').trim().split(/\s+/).map(parseFloat);
    return [
      Number.isFinite(n[0]) ? n[0] / 100 : 0.5,
      Number.isFinite(n[1]) ? n[1] / 100 : 0.5
    ];
  }

  function dataOf(project) {
    const img = project.querySelector('.project__img');
    return {
      project,
      img,
      src: img.currentSrc || img.src,
      nw: img.naturalWidth || 1000,
      nh: img.naturalHeight || 1000,
      focus: pair(project.dataset.foco),                     // qué parte se ve en el círculo
      zoom: parseFloat(project.dataset.zoom) || CONFIG.zoom,  // zoom propio (opcional)
      pos: pair(getComputedStyle(img).objectPosition)         // encuadre en la rejilla
    };
  }

  // la imagen tal y como se ve en la celda (object-fit: cover)
  function coverBox(d, w, h, px, py) {
    const s = Math.max(w / d.nw, h / d.nh);
    const bw = d.nw * s;
    const bh = d.nh * s;
    return { bw, bh, bx: (w - bw) * px, by: (h - bh) * py };
  }

  // la imagen dentro del círculo, centrada en su punto de foco
  function circleBox(d, D) {
    const s = (d.zoom * D) / Math.min(d.nw, d.nh);
    const bw = d.nw * s;
    const bh = d.nh * s;
    return {
      bw,
      bh,
      bx: clamp(D / 2 - d.focus[0] * bw, D - bw, 0),
      by: clamp(D / 2 - d.focus[1] * bh, D - bh, 0)
    };
  }

  function setFromRect(o, rect) {
    o.x = rect.left + rect.width / 2;
    o.y = rect.top + rect.height / 2;
    o.w = rect.width;
    o.h = rect.height;
    o.r = 0;
  }

  /* ---------- capas de imagen dentro del círculo ---------- */
  function addLayer(d, box) {
    const el = document.createElement('img');
    el.className = 'orb__layer';
    el.alt = '';
    el.decoding = 'async';
    el.src = d.src;
    const layer = { el, d, cur: { ...box }, tgt: { ...box } };
    scaleEl.appendChild(el);
    layers.push(layer);
    paintLayer(layer);
    return layer;
  }

  function clearLayers(keep) {
    layers.forEach((l) => { if (l !== keep) l.el.remove(); });
    layers = keep ? [keep] : [];
  }

  const topLayer = () => layers[layers.length - 1];

  // si hay un cambio de imagen a medias, deja solo la del proyecto activo
  function keepActiveLayer() {
    const top = topLayer();
    if (top && top.d.project === active) {
      clearLayers(top);
    } else {
      clearLayers();
      addLayer(dataOf(active), circleBox(dataOf(active), cur.w || diameter()));
    }
    return topLayer();
  }

  function stopScale() {
    scaleEl.getAnimations().forEach((a) => a.cancel());
  }

  function currentScale() {
    const m = getComputedStyle(scaleEl).transform;
    if (!m || m === 'none') return 1;
    const v = m.match(/matrix\(([^,]+)/);
    return v ? parseFloat(v[1]) : 1;
  }

  /* ---------- pintar ---------- */
  function paintLayer(l) {
    l.el.style.width = l.cur.bw + 'px';
    l.el.style.height = l.cur.bh + 'px';
    l.el.style.transform = `translate3d(${l.cur.bx}px, ${l.cur.by}px, 0)`;
  }

  function paint() {
    orb.style.width = cur.w + 'px';
    orb.style.height = cur.h + 'px';
    orb.style.borderRadius = Math.min(cur.r, cur.w / 2, cur.h / 2) + 'px';
    orb.style.transform = `translate3d(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px, 0)`;
    layers.forEach(paintLayer);
  }

  function start() {
    if (!rafId) {
      lastT = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function frame(t) {
    rafId = 0;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60;
    lastT = t;

    if (state === 'leaving') retargetToCell();

    const instant = reduceMotion.matches;
    const kp = instant ? 1 : 1 - Math.exp(-dt * posRate);
    const ks = instant ? 1 : 1 - Math.exp(-dt * sizeRate);
    const kr = instant ? 1 : 1 - Math.exp(-dt * sizeRate * (tgt.r > cur.r ? 1.8 : 1));

    if (state === 'active' && !instant) {
      // muelle con amortiguación crítica: fluido y sin pasarse del puntero
      [cur.x, vx] = follow(cur.x, vx, tgt.x, dt);
      [cur.y, vy] = follow(cur.y, vy, tgt.y, dt);
    } else {
      cur.x += (tgt.x - cur.x) * kp;
      cur.y += (tgt.y - cur.y) * kp;
      vx = 0;
      vy = 0;
    }
    cur.w += (tgt.w - cur.w) * ks;
    cur.h += (tgt.h - cur.h) * ks;
    cur.r += (tgt.r - cur.r) * kr;

    for (const l of layers) {
      l.cur.bw += (l.tgt.bw - l.cur.bw) * ks;
      l.cur.bh += (l.tgt.bh - l.cur.bh) * ks;
      l.cur.bx += (l.tgt.bx - l.cur.bx) * ks;
      l.cur.by += (l.tgt.by - l.cur.by) * ks;
    }

    paint();

    if (state === 'leaving' && settled()) finishLeave();
    if (state !== 'idle') rafId = requestAnimationFrame(frame);
  }

  function follow(x, v, target, dt) {
    const w = CONFIG.follow;
    const e = Math.exp(-w * dt);
    const change = x - target;
    const temp = (v + w * change) * dt;
    return [target + (change + temp) * e, (v - w * temp) * e];
  }

  function settled() {
    const e = 1.5;
    return Math.abs(cur.x - tgt.x) < e && Math.abs(cur.y - tgt.y) < e &&
           Math.abs(cur.w - tgt.w) < e && Math.abs(cur.h - tgt.h) < e;
  }

  function retargetToCell() {
    if (!active) return;
    const rect = active.getBoundingClientRect();
    setFromRect(tgt, rect);
    const l = topLayer();
    if (l) l.tgt = coverBox(l.d, rect.width, rect.height, l.d.pos[0], l.d.pos[1]);
  }

  /* ---------- estados ---------- */
  function activate(project) {
    if (state === 'opening') return;
    if (project === active && state === 'active') return;

    const D = diameter();

    if (state === 'idle') {
      // la imagen de la celda se convierte en el círculo
      const d = dataOf(project);
      const rect = d.img.getBoundingClientRect();
      setFromRect(cur, rect);
      clearLayers();
      addLayer(d, coverBox(d, rect.width, rect.height, d.pos[0], d.pos[1]));
      project.classList.add('is-instant', 'is-active');
      requestAnimationFrame(() => requestAnimationFrame(() => project.classList.remove('is-instant')));
      orb.classList.add('is-visible');
      paint();
    } else if (project !== active) {
      // ya hay círculo: cambia de imagen
      active.classList.remove('is-active', 'is-leaving');
      project.classList.add('is-active');
      swap(dataOf(project), D);
    }

    project.classList.remove('is-leaving');
    clearTimeout(leaveTimer);
    active = project;
    state = 'active';
    posRate = CONFIG.morph;
    sizeRate = CONFIG.morph;
    root.classList.add('orb-on');

    Object.assign(tgt, { x: pointer.x, y: pointer.y, w: D, h: D, r: D / 2 });
    layers.forEach((l) => { l.tgt = circleBox(l.d, D); });
    start();
  }

  function swap(d, D) {
    const id = ++swapId;

    if (reduceMotion.matches) {
      stopScale();
      clearLayers();
      addLayer(d, circleBox(d, D));
      return;
    }

    // salto: se encoge, cambia de imagen y vuelve a crecer con rebote
    const s0 = currentScale();
    stopScale();
    const shrink = scaleEl.animate(
      [{ transform: `scale(${s0})` }, { transform: 'scale(0)' }],
      { duration: 60 + 140 * s0, easing: 'cubic-bezier(.55, 0, .9, .45)', fill: 'forwards' }
    );
    shrink.onfinish = () => {
      if (id !== swapId) return;
      clearLayers();
      addLayer(d, circleBox(d, diameter()));
      const grow = scaleEl.animate(
        [
          { transform: 'scale(0)', easing: 'cubic-bezier(.2, .7, .3, 1)' },
          { transform: 'scale(1.12)', offset: 0.55, easing: 'cubic-bezier(.4, 0, .4, 1)' },
          { transform: 'scale(.97)', offset: 0.8 },
          { transform: 'scale(1)' }
        ],
        { duration: 460, fill: 'forwards' }
      );
      grow.onfinish = () => { if (id === swapId) grow.cancel(); };
    };
  }

  // el círculo vuelve a su celda y la imagen reaparece
  function leave() {
    if (state !== 'active' || !active) return;
    state = 'leaving';
    swapId++;
    stopScale();
    keepActiveLayer();
    posRate = CONFIG.morph;
    sizeRate = CONFIG.morph;
    active.classList.add('is-leaving');
    root.classList.remove('orb-on');
    retargetToCell();
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(finishLeave, 1200);
    start();
  }

  function finishLeave() {
    clearTimeout(leaveTimer);
    if (state !== 'leaving') return;
    const p = active;
    if (p) {
      p.classList.add('is-instant');
      p.classList.remove('is-active', 'is-leaving');
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove('is-instant')));
    }
    hideOrb();
  }

  function hideOrb() {
    swapId++;
    stopScale();
    clearLayers();
    orb.classList.remove('is-visible');
    root.classList.remove('orb-on', 'orb-open');
    active = null;
    state = 'idle';
    stop();
  }

  function reset() {
    clearTimeout(leaveTimer);
    clearTimeout(openTimer);
    document.querySelectorAll('.project.is-active, .project.is-leaving')
      .forEach((p) => p.classList.remove('is-active', 'is-leaving'));
    hideOrb();
  }

  // clic: el círculo crece hasta ocupar la pantalla y navega al proyecto
  function open() {
    if (state !== 'active' || !active) return;
    state = 'opening';
    swapId++;
    stopScale();
    const l = keepActiveLayer();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    Object.assign(tgt, { x: vw / 2, y: vh / 2, w: vw, h: vh, r: 0 });
    l.tgt = coverBox(l.d, vw, vh, 0.5, 0.5);
    posRate = CONFIG.open;
    sizeRate = CONFIG.open;
    root.classList.add('orb-open');
    start();

    const href = active.getAttribute('href');
    openTimer = setTimeout(() => {
      window.location.href = href;
    }, reduceMotion.matches ? 0 : CONFIG.openDelay);
  }

  /* ---------- eventos ---------- */
  function hitTest(el) {
    if (!el || !el.closest) return;
    const project = el.closest('.project');
    if (project && work.contains(project)) activate(project);
    else if (!work.contains(el)) leave(); // fuera de la rejilla
    // entre imágenes (separaciones): se mantiene el proyecto activo
  }

  if (canHover) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.known = true;
      if (state === 'active' || state === 'leaving' || state === 'idle') hitTest(e.target);
      if (state === 'active') {
        tgt.x = pointer.x;
        tgt.y = pointer.y;
      }
    }, { passive: true });

    // el ratón sale de la ventana
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) leave();
    });

    // al hacer scroll cambia lo que hay debajo del ratón
    let scrollQueued = false;
    window.addEventListener('scroll', () => {
      if (!pointer.known || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        if (state === 'active' || state === 'leaving' || state === 'idle') {
          hitTest(document.elementFromPoint(pointer.x, pointer.y));
        }
      });
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (state !== 'active') return;
      const D = diameter();
      Object.assign(tgt, { w: D, h: D, r: D / 2 });
      layers.forEach((l) => { l.tgt = circleBox(l.d, D); });
      start();
    });
  }

  work.addEventListener('click', (e) => {
    if (e.detail === 0) return; // teclado (Enter): navegación normal del enlace
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (state === 'active' && active) {
      e.preventDefault();
      open(); // vale hacer clic en cualquier parte de la galería (también entre imágenes)
    }
  });

  // al volver con el botón "atrás" del navegador
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset();
  });
})();
