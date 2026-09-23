/* Reescritura del texto real en hover (sin capas encima: no hay letras
   superpuestas y el texto nunca salta de línea). Sacado tal cual de
   all-my-work.js para usarlo también en los botones (main.js).
   Uso: Rewrite.run(el, ms, onDone) · Rewrite.reset(el) */
(() => {
  'use strict';

  /* ================== AJUSTES ================== */
  const CONFIG = {
    // 'aino'       = letras al azar que se van colocando de izquierda a derecha
    // 'locomotive' = las letras de cada palabra se barajan un instante y vuelven
    style: 'aino',
    ainoTick: 30,      // ms entre cambios de letra (aino)
    shuffleSteps: 3,   // veces que se barajan las letras (locomotive)
    shuffleTick: 55    // ms entre barajadas (locomotive)
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const IS_LETTER = /[\p{L}\p{N}]/u;
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const DIGITS = '0123456789';

  // Las letras al azar se eligen con un ancho parecido al de la original:
  // así la palabra mide casi lo mismo y no choca con lo que tiene al lado.
  const canvas = document.createElement('canvas').getContext('2d');
  const pools = new Map();

  function poolFor(ch, el) {
    const cs = getComputedStyle(el);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = font + '|' + ch;
    if (pools.has(key)) return pools.get(key);
    canvas.font = font;
    const set = /\d/.test(ch) ? DIGITS : ch !== ch.toLowerCase() ? UPPER : LOWER;
    const w0 = canvas.measureText(ch).width;
    const widths = [...set].map((c) => [c, canvas.measureText(c).width]);
    let pool = [];
    for (let tol = 0.08; pool.length < 3 && tol <= 0.6; tol += 0.08) {
      pool = widths.filter(([c, w]) => c !== ch && Math.abs(w - w0) <= w0 * tol).map(([c]) => c);
    }
    if (!pool.length) pool = [...set].filter((c) => c !== ch);
    pools.set(key, pool);
    return pool;
  }

  function randomLike(ch, el) {
    const pool = poolFor(ch, el);
    return pool[(Math.random() * pool.length) | 0];
  }

  // los trozos de texto del elemento (se vuelven a leer si su contenido se
  // ha cambiado desde fuera, p. ej. el párrafo de What I do)
  function pieces(el) {
    if (el._pieces && el._pieces.some((p) => !el.contains(p.node))) el._pieces = null;
    if (!el._pieces) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const list = [];
      while (walker.nextNode()) list.push({ node: walker.currentNode, text: walker.currentNode.nodeValue });
      el._pieces = list;
    }
    return el._pieces;
  }

  function reset(el) {
    if (el._timer) cancelAnimationFrame(el._timer);
    el._timer = 0;
    (el._pieces || []).forEach((p) => { p.node.nodeValue = p.text; });
  }

  // Aino: letras al azar que se van resolviendo de izquierda a derecha
  function decode(el, duration, onDone) {
    const list = pieces(el);
    const total = list.reduce((n, p) => n + [...p.text].filter((c) => IS_LETTER.test(c)).length, 0);
    const t0 = performance.now();
    let last = -Infinity;
    const tick = (now) => {
      const t = now - t0;
      if (t >= duration) {
        reset(el);
        if (onDone) onDone();
        return;
      }
      if (now - last >= CONFIG.ainoTick) {
        last = now;
        const solved = Math.floor((t / duration) * (total + 1));
        let k = 0;
        list.forEach((p) => {
          let out = '';
          for (const c of p.text) {
            if (IS_LETTER.test(c)) {
              out += k < solved ? c : randomLike(c, el);
              k += 1;
            } else {
              out += c;
            }
          }
          p.node.nodeValue = out;
        });
      }
      el._timer = requestAnimationFrame(tick);
    };
    el._timer = requestAnimationFrame(tick);
  }

  // Locomotive: las letras de cada palabra se barajan unas veces y vuelven
  function shuffleWord(word) {
    const a = [...word];
    if (a.length < 2) return word;
    for (let tries = 0; tries < 6; tries++) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      if (a.join('') !== word) break;
    }
    return a.join('');
  }

  function shuffle(el, onDone) {
    const list = pieces(el);
    const t0 = performance.now();
    let step = 0;
    const tick = (now) => {
      const due = Math.floor((now - t0) / CONFIG.shuffleTick);
      if (due >= CONFIG.shuffleSteps) {
        reset(el);
        if (onDone) onDone();
        return;
      }
      if (due >= step) {
        step = due + 1;
        list.forEach((p) => {
          p.node.nodeValue = p.text.replace(/[\p{L}\p{N}]+/gu, shuffleWord);
        });
      }
      el._timer = requestAnimationFrame(tick);
    };
    el._timer = requestAnimationFrame(tick);
  }

  function run(el, duration, onDone) {
    reset(el);
    if (reduceMotion.matches) {
      if (onDone) onDone();
      return;
    }
    if (CONFIG.style === 'locomotive') shuffle(el, onDone);
    else decode(el, duration, onDone);
  }

  window.Rewrite = { run, reset };
})();
