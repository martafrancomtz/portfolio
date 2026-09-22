(function () {
  "use strict";

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var fino = !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);

  /* ============================================================
     1) CURSOR CIRCULAR: mix-blend-mode: difference
     ============================================================ */
  var cursor = document.getElementById("cursor");
  if (cursor && fino) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var tx = cx, ty = cy, dentro = false;

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!dentro) { dentro = true; cx = tx; cy = ty; cursor.classList.add("is-ready"); }
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      dentro = false;
      cursor.classList.remove("is-ready");
    });

    document.querySelectorAll("a, button, .what-i-do__item").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-grow"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-grow"); });
    });

    // sobre una imagen-enlace (data-cursor="view") el círculo se convierte en
    // "View case ↗"; sobre las palabras de la rueda, en un círculo grande
    var etiqueta = document.createElement("span");
    etiqueta.className = "cursor__label";
    etiqueta.innerHTML = 'View case<svg viewBox="0 0 18.1338 18.1338" aria-hidden="true" focusable="false">' +
      '<path d="M18.1338 17.25H15.6338V4.26758L1.76758 18.1338L0 16.3662L13.8662 2.5H0.883789V0H18.1338V17.25Z" fill="currentColor"/></svg>';
    cursor.appendChild(etiqueta);
    document.addEventListener("pointerover", function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      cursor.classList.toggle("is-label", !!(t && t.closest('[data-cursor="view"]')));
      cursor.classList.toggle("is-big", !!(t && t.closest(".rueda-item")));
    });

    (function loop() {
      var k = reduce ? 1 : 0.18;
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  /* ============================================================
     1b) BOTONES: el texto se reescribe una vez al entrar (como en
         All my work, assets/js/rewrite.js); no se mueve nada
     ============================================================ */
  if (window.Rewrite) {
    document.querySelectorAll(".btn").forEach(function (btn) {
      var label = btn.querySelector(".btn__label");
      if (!label) return;
      // el ancho del texto se fija mientras se reescribe: las letras al azar
      // no miden exactamente lo mismo y la flecha (o el botón) se movería
      function run() {
        window.Rewrite.reset(label);
        label.style.width = label.getBoundingClientRect().width + "px";
        window.Rewrite.run(label, 500, function () { label.style.width = ""; });
      }
      btn.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "mouse") run();
      });
      btn.addEventListener("focus", function () {
        if (btn.matches(":focus-visible")) run();
      });
    });
  }

  /* ============================================================
     1c) CABECERA: se esconde al bajar y vuelve en cuanto se sube
         un poco (como studio-move); arriba del todo, siempre visible
     ============================================================ */
  var header = document.getElementById("siteHeader");
  var menuOpen = false;
  if (header) {
    var lastY = window.scrollY, ticking = false;
    var BAJA = 8, SUBE = 4;   // px que hay que moverse para esconderla / sacarla

    // la sombra del menú solo tiene sentido sobre el hero (fondo animado);
    // sobre el fondo normal de la página queda rara
    var heroZona = document.querySelector(".hero");
    function sobreHero() {
      var sobre = !!heroZona && window.scrollY < heroZona.offsetHeight - header.offsetHeight / 2;
      header.classList.toggle("is-over-hero", sobre);
    }
    sobreHero();

    function onScroll() {
      ticking = false;
      sobreHero();
      var y = window.scrollY;
      if (menuOpen || y <= header.offsetHeight) {
        header.classList.remove("is-hidden");
      } else if (y > lastY + BAJA) {
        header.classList.add("is-hidden");
      } else if (y < lastY - SUBE) {
        header.classList.remove("is-hidden");
      } else {
        return;   // movimiento mínimo: se acumula hasta pasar el umbral
      }
      lastY = y;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    // con el teclado, que se vea en cuanto un enlace suyo tiene el foco
    header.addEventListener("focusin", function () { header.classList.remove("is-hidden"); });
  }

  /* ============================================================
     1d) MENÚ HAMBURGUESA (pantallas pequeñas)
     ============================================================ */
  var toggle = document.getElementById("navToggle");
  var panel = document.getElementById("navPanel");
  if (toggle && panel) {
    function setMenu(open) {
      menuOpen = open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      panel.classList.toggle("is-open", open);
      // al bloquear el scroll desaparece la barra: su ancho se guarda en
      // --sbw para que la cabecera (y la X) no se muevan
      var root = document.documentElement;
      if (open) root.style.setProperty("--sbw", (window.innerWidth - root.clientWidth) + "px");
      else root.style.removeProperty("--sbw");
      root.classList.toggle("is-menu-open", open);
      if (open && header) header.classList.remove("is-hidden");
    }
    toggle.addEventListener("click", function () { setMenu(!menuOpen); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { setMenu(false); toggle.focus(); }
    });
    // si se agranda la ventana con el menú abierto, se cierra
    window.matchMedia("(min-width: 700px)").addEventListener("change", function (m) {
      if (m.matches && menuOpen) setMenu(false);
    });
  }

  /* ============================================================
     2) REVEAL AL HACER SCROLL
     ============================================================ */
  /* Las filas de Selected work (.sw) y su enlace "All work" (.selected-reveal)
     no entran aquí: su entrada escalonada la controla selected-work.js con
     su propio IntersectionObserver (el <h2> sí es genérico, ese sigue en
     .section-title). .work-group__label y .work-item tampoco entran: su
     entrada escalonada la controla all-my-work.js del mismo modo. */
  var revelables = document.querySelectorAll(
    ".section-title, .statement__quote, .statement__now, " +
    ".what-i-do__item, .cta__title, .cta__lead, .cta__text"
  );
  revelables.forEach(function (el) { el.classList.add("reveal"); });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("is-visible");
          io.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    revelables.forEach(function (el) { io.observe(el); });
  } else {
    revelables.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* "What I do" (pin de scroll + hover + scramble) vive en assets/js/whatido.js.
     La rueda (pin de scroll + hover) vive en assets/js/rueda.js */
})();
