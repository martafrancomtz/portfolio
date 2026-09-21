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

    (function loop() {
      var k = reduce ? 1 : 0.18;
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  /* ============================================================
     2) REVEAL AL HACER SCROLL
     ============================================================ */
  /* .selected-work__row queda fuera: dentro del pin de scroll (3work.js) su
     opacidad la controla ese script fotograma a fotograma, y el fundido
     genérico de aquí chocaría con esas animaciones. .work-group__label y
     .work-item tampoco entran: su entrada escalonada la controla
     allmywork.js con su propio IntersectionObserver. */
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
