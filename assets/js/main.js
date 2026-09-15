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
  var revelables = document.querySelectorAll(
    ".section-title, .selected-work__row, .statement__quote, .statement__now, " +
    ".what-i-do__item, .all-work__group, .cta__title, .cta__lead, .cta__text"
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

  /* ============================================================
     3) "WHAT I DO": el ítem activo se enfoca, el resto se desenfoca
     ============================================================ */
  var itemsQueHace = document.querySelectorAll(".what-i-do__item");
  if (itemsQueHace.length) {
    function activar(item) {
      itemsQueHace.forEach(function (i) { i.classList.toggle("is-active", i === item); });
    }
    itemsQueHace.forEach(function (item) {
      item.addEventListener("mouseenter", function () { activar(item); });
      item.addEventListener("focus", function () { activar(item); });
    });
  }

  /* ============================================================
     4) RUEDA: dos círculos concéntricos con los proyectos en bucle
     ============================================================ */
  var wheel = document.getElementById("wheel");
  if (wheel) {
    var proyectos = [
      "3D bottle", "Off-White", "Mondo Restaurant", "Kilter Typography",
      "Students Life Cards", "Ecological Posters", "Merkamueble Redesign",
      "Expo Sevilla '24", "Bullet Train Illustrations", "Typographic Analysis"
    ];
    var separador = "   ·   ";
    var CENTRO_X = 1000, CENTRO_Y = 0;
    var RADIO_GRANDE = 620, RADIO_PEQUENO = 400;

    function formulaDelCirculo(radio) {
      var izquierda = CENTRO_X - radio, diametro = radio * 2;
      return "M " + izquierda + "," + CENTRO_Y +
        " a " + radio + "," + radio + " 0 1,0 " + diametro + ",0" +
        " a " + radio + "," + radio + " 0 1,0 " + (-diametro) + ",0";
    }

    function rellenarCirculoDeTexto(textoSVG, circuloSVG, radio, tamanoLetra, desdeIndice) {
      circuloSVG.setAttribute("d", formulaDelCirculo(radio));
      var perimetro = circuloSVG.getTotalLength();
      var contenedor = textoSVG.querySelector("textPath");
      contenedor.textContent = "";

      var indice = desdeIndice, anchoEscrito = 0;
      while (anchoEscrito < perimetro * 1.08) {
        var nombre = proyectos[indice % proyectos.length];
        var palabra = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        palabra.textContent = nombre + separador;
        contenedor.appendChild(palabra);
        anchoEscrito += (nombre + separador).length * tamanoLetra * 0.56;
        indice++;
      }

      textoSVG.style.fontSize = tamanoLetra + "px";
      textoSVG.setAttribute("textLength", perimetro.toFixed(1));
      textoSVG.setAttribute("lengthAdjust", "spacing");
      return indice % proyectos.length;
    }

    var grupoGrande = document.getElementById("wheelBig");
    var grupoPequeno = document.getElementById("wheelSmall");

    /* El círculo se recorta (overflow:hidden) para mostrar solo el cuadrante
       legible: por eso la rotación es fija, no ligada al scroll: girarlo
       traería a la vista la mitad del texto invertida (propiedad de todo
       textPath circular con un único sentido de recorrido). */
    function posicionInicial() {
      grupoGrande.setAttribute("transform", "rotate(18 " + CENTRO_X + " " + CENTRO_Y + ")");
      grupoPequeno.setAttribute("transform", "rotate(52 " + CENTRO_X + " " + CENTRO_Y + ")");
    }

    var listo = false;
    function preparar() {
      if (listo) return;
      listo = true;
      var siguiente = rellenarCirculoDeTexto(
        document.getElementById("wheelTextBig"), document.getElementById("wheelPathBig"),
        RADIO_GRANDE, 40, 0
      );
      rellenarCirculoDeTexto(
        document.getElementById("wheelTextSmall"), document.getElementById("wheelPathSmall"),
        RADIO_PEQUENO, 26, siguiente
      );
      posicionInicial();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.load("600 40px 'Rethink Sans'").then(function () {
        return document.fonts.ready;
      }).catch(function () {}).then(preparar);
    } else {
      preparar();
    }
  }
})();
