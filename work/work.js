(() => {
  'use strict';

  const CONFIG = {
    follow: 20,     // seguimiento del ratón con un muelle sin rebote (más alto = más pegado)
    morph: 12,       // velocidad hueco ⇄ círculo
    open: 13,        // velocidad círculo → pantalla completa al hacer clic
    openDelay: 550  // ms hasta navegar al proyecto
  };

  const work = document.querySelector('.work');
  const orb = document.querySelector('.orb');
  const probe = document.querySelector('.orb-probe');
  if (!work || !orb || !probe) return;

  // En pantallas táctiles no hay hover: los proyectos funcionan como enlaces normales
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let state = 'idle'; // idle | active | leaving | opening
  let active = null;  // .project activo
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

  const diameter = () => probe.getBoundingClientRect().width || 190;

  function setFromRect(o, rect) {
    o.x = rect.left + rect.width / 2;
    o.y = rect.top + rect.height / 2;
    o.w = rect.width;
    o.h = rect.height;
    o.r = 0;
  }

  function colorOf(project) {
    const hole = project.querySelector('.project__img');
    return hole ? getComputedStyle(hole).backgroundColor : '';
  }

  function paint() {
    orb.style.width = cur.w + 'px';
    orb.style.height = cur.h + 'px';
    orb.style.borderRadius = Math.min(cur.r, cur.w / 2, cur.h / 2) + 'px';
    orb.style.transform = `translate3d(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px, 0)`;
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
    if (active) setFromRect(tgt, active.getBoundingClientRect());
  }

  /* ---------- estados ---------- */
  function activate(project) {
    if (state === 'opening') return;
    if (project === active && state === 'active') return;

    const D = diameter();
    orb.style.backgroundColor = colorOf(project);

    if (state === 'idle') {
      // el hueco de la celda se convierte en el círculo
      setFromRect(cur, project.getBoundingClientRect());
      project.classList.add('is-instant', 'is-active');
      requestAnimationFrame(() => requestAnimationFrame(() => project.classList.remove('is-instant')));
      orb.classList.add('is-visible');
      paint();
    } else if (project !== active) {
      active.classList.remove('is-active', 'is-leaving');
      project.classList.add('is-active');
    }

    project.classList.remove('is-leaving');
    clearTimeout(leaveTimer);
    active = project;
    state = 'active';
    posRate = CONFIG.morph;
    sizeRate = CONFIG.morph;
    root.classList.add('orb-on');

    Object.assign(tgt, { x: pointer.x, y: pointer.y, w: D, h: D, r: D / 2 });
    start();
  }

  // el círculo vuelve a su celda y el hueco reaparece
  function leave() {
    if (state !== 'active' || !active) return;
    state = 'leaving';
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    Object.assign(tgt, { x: vw / 2, y: vh / 2, w: vw, h: vh, r: 0 });
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
    // entre proyectos (separaciones): se mantiene el proyecto activo
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
      start();
    });
  }

  work.addEventListener('click', (e) => {
    if (e.detail === 0) return; // teclado (Enter): navegación normal del enlace
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (state === 'active' && active) {
      e.preventDefault();
      open();
    }
  });

  // al volver con el botón "atrás" del navegador
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset();
  });
})();
