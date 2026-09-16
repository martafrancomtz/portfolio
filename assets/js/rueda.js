/* ==================================================================
   RUEDA: pin de scroll (2 vueltas) + hover con tarjeta flotante.
  
   ================================================================== */
(function () {
  "use strict";

  var pin = document.getElementById("ruedaPin");
  if (!pin) return;

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var proyectos = [
    "3D bottle", "Off-White", "Mondo Restaurant", "Kilter Typography",
    "Students Life Cards", "ConSentío", "Merkamueble Redesign",
    "Antonio Franco portfolio", "Ecological Posters", "Portfolio v1 → v2", "Expo Sevilla '24", "Bullet Train Illustrations", "Typographic Analysis"
  ];
  var separador = "   ·   ";

  /* Los dos círculos comparten centro, anclado fuera del escenario visible
     (esquina superior derecha): así solo se ve la mitad del texto que lee
     del derecho, gire lo que gire. */
  var CENTRO_X = 1000, CENTRO_Y = 0;
  var RADIO_GRANDE = 360, RADIO_PEQUENO = 175;

  function formulaDelCirculo(radio) {
    var izquierda = CENTRO_X - radio, diametro = radio * 2;
    return "M " + izquierda + "," + CENTRO_Y +
      " a " + radio + "," + radio + " 0 1,0 " + diametro + ",0" +
      " a " + radio + "," + radio + " 0 1,0 " + (-diametro) + ",0";
  }

  /* Tamaños de letra de diseño (Figma). Si con estos tamaños los dos
     círculos juntos no tienen sitio para escribir TODOS los proyectos al
     menos una vez, se reducen un poco los dos (manteniendo su proporción)
     hasta que quepan. ESCALA_MINIMA es el límite: por debajo de eso se
     avisa por consola de qué proyectos se quedan fuera. */
  var LETRA_GRANDE = 36, LETRA_PEQUENA = 21;
  var ESCALA_MINIMA = 0.6;
  /* Margen para apretar un poco el espaciado (textLength) antes de dejar
     un nombre fuera: 1.02 = hasta un 2 %, imperceptible. */
  var TOLERANCIA = 1.02;

  var SVG_NS = "http://www.w3.org/2000/svg";

  /* Mide el ancho REAL (con la fuente ya cargada) de un texto a un tamaño
     dado, con un <text> invisible y fuera de ningún trazado. Antes se
     estimaba con "nº de letras × 0.56", que no cuadra con los anchos reales
     de Rethink Sans y dejaba proyectos sin escribir. */
  function medirTexto(medidor, texto, tamanoLetra) {
    medidor.style.fontSize = tamanoLetra + "px";
    medidor.textContent = texto;
    return medidor.getComputedTextLength();
  }

  /* Escribe nombres en el círculo, empezando por desdeIndice, mientras
     quepan en el perímetro. Si sobran vueltas, repite desde el principio
     (como antes). Devuelve el índice SIN módulo, para saber cuántos
     nombres se han escrito en total. */
  function rellenarCirculoDeTexto(medidor, textoSVG, circuloSVG, radio, tamanoLetra, desdeIndice) {
    circuloSVG.setAttribute("d", formulaDelCirculo(radio));
    var perimetro = circuloSVG.getTotalLength();
    var contenedor = textoSVG.querySelector("textPath");
    contenedor.textContent = "";

    var indice = desdeIndice, textoEscrito = "";
    var limite = desdeIndice + 200; // seguro contra bucles infinitos
    while (indice < limite) {
      var nombre = proyectos[indice % proyectos.length];
      var siguienteTexto = textoEscrito + nombre + separador;
      if (medirTexto(medidor, siguienteTexto, tamanoLetra) > perimetro * TOLERANCIA) break;

      var palabra = document.createElementNS(SVG_NS, "tspan");
      palabra.setAttribute("class", "rueda-item");
      palabra.setAttribute("data-idx", indice % proyectos.length);
      palabra.textContent = nombre;
      contenedor.appendChild(palabra);

      var punto = document.createElementNS(SVG_NS, "tspan");
      punto.setAttribute("class", "rueda-sep");
      punto.textContent = separador;
      contenedor.appendChild(punto);

      textoEscrito = siguienteTexto;
      indice++;
    }

    textoSVG.style.fontSize = tamanoLetra.toFixed(2) + "px";
    textoSVG.setAttribute("textLength", perimetro.toFixed(1));
    textoSVG.setAttribute("lengthAdjust", "spacing");
    return indice;
  }

  /* Rellena los dos círculos. El pequeño continúa donde acabó el grande.
     Si entre los dos no aparecen todos los proyectos, baja la escala y
     vuelve a probar. */
  function rellenarLosDosCirculos() {
    var medidor = document.createElementNS(SVG_NS, "text");
    medidor.setAttribute("visibility", "hidden");
    medidor.setAttribute("aria-hidden", "true");
    svg.appendChild(medidor);

    var escala = 1, escritos = 0;
    while (true) {
      var finGrande = rellenarCirculoDeTexto(medidor,
        document.getElementById("wheelTextBig"), document.getElementById("wheelPathBig"),
        RADIO_GRANDE, LETRA_GRANDE * escala, 0
      );
      var finPequeno = rellenarCirculoDeTexto(medidor,
        document.getElementById("wheelTextSmall"), document.getElementById("wheelPathSmall"),
        RADIO_PEQUENO, LETRA_PEQUENA * escala, finGrande
      );
      escritos = finPequeno;
      if (escritos >= proyectos.length || escala <= ESCALA_MINIMA) break;
      escala = Math.max(ESCALA_MINIMA, escala * 0.98);
    }

    svg.removeChild(medidor);

    if (escritos < proyectos.length) {
      console.warn("[rueda] No caben todos los proyectos ni al " + Math.round(ESCALA_MINIMA * 100) +
        "% del tamaño de letra. Se quedan fuera: " + proyectos.slice(escritos).join(", "));
    }
  }

  /* ============================================================
     GIRAR SEGÚN SCROLL (2 vueltas repartidas en los 400vh del pin)
     ============================================================ */
  var grupoGrande = document.getElementById("wheelBig");
  var grupoPequeno = document.getElementById("wheelSmall");
  var textoVuelta = document.getElementById("wheelLap");
  var pistaScroll = document.getElementById("wheelHint");

  /* Ajustes del movimiento (juega con ellos) */
  var INERCIA_GRANDE = 0.05;   // 0–1. Más bajo = más pesado, tarda más en alcanzar al scroll
  var INERCIA_PEQUENA = 0.08;  // el pequeño es más ligero: reacciona antes
  var DERIVA = 3;              // grados por segundo que gira SIEMPRE, se scrollee o no (0 = quieta)

  var anguloObjetivo = 0;                  // a dónde manda el scroll
  var anguloGrande = 0, anguloPequeno = 0; // lo que se pinta de verdad
  var derivaAcumulada = 0;
  var ruedaEnPantalla = true;
  var ultimoInstante = null;

  /* Solo LEE el scroll y apunta a dónde debería ir la rueda. Ya no pinta. */
  function leerScroll() {
    var caja = pin.getBoundingClientRect();
    ruedaEnPantalla = caja.bottom > 0 && caja.top < window.innerHeight;

    var scrollDisponible = pin.offsetHeight - window.innerHeight;
    var scrollActual = Math.max(0, Math.min(-caja.top, scrollDisponible));
    var progreso = scrollDisponible > 0 ? scrollActual / scrollDisponible : 0;

    anguloObjetivo = progreso * 360;

    if (textoVuelta) {
      var vuelta = progreso <= 0 ? 1 : Math.min(1, Math.ceil(progreso * 1));
      textoVuelta.textContent = String(vuelta).padStart(2, "0");
    }
    if (pistaScroll) {
      pistaScroll.style.opacity = progreso > 0.02 ? 0 : 1;
    }
  }

  /* Acerca "actual" a "objetivo" un porcentaje cada frame (interpolación).
     "pasos" corrige la velocidad para que vaya igual en pantallas de 60 y 120 Hz. */
  function acercar(actual, objetivo, inercia, pasos) {
    return actual + (objetivo - actual) * (1 - Math.pow(1 - inercia, pasos));
  }

  /* Bucle de animación: se ejecuta en cada frame y es el único que pinta. */
  function animar(instante) {
    var segundos = ultimoInstante === null ? 0 : Math.min((instante - ultimoInstante) / 1000, 0.1);
    ultimoInstante = instante;
    var pasos = segundos * 60;

    if (ruedaEnPantalla) {
      // Giro constante: siempre suma un poco, pase lo que pase.
      derivaAcumulada += DERIVA * segundos;

      var objetivo = anguloObjetivo + derivaAcumulada;
      anguloGrande = acercar(anguloGrande, objetivo, INERCIA_GRANDE, pasos);
      anguloPequeno = acercar(anguloPequeno, objetivo, INERCIA_PEQUENA, pasos);

      grupoGrande.setAttribute("transform", "rotate(" + (8 + anguloGrande).toFixed(2) + " " + CENTRO_X + " " + CENTRO_Y + ")");
      grupoPequeno.setAttribute("transform", "rotate(" + (55 + anguloPequeno).toFixed(2) + " " + CENTRO_X + " " + CENTRO_Y + ")");
    }

    requestAnimationFrame(animar);
  }

  /* ============================================================
     HOVER: difuminar el resto y mostrar la tarjeta central
     ============================================================ */
  var svg = pin.querySelector("svg");
  var tarjeta = document.getElementById("wheelCard");
  var tarjetaIndice = document.getElementById("wheelCardIdx");
  var tarjetaNombre = document.getElementById("wheelCardName");
  var capaA = tarjeta ? tarjeta.querySelector(".a") : null;
  var capaB = tarjeta ? tarjeta.querySelector(".b") : null;

  var proyectoActivo = null;
  var temporizadorColor = null;

  function colorDeProyecto(indice, variante) {
    var tono = Math.round(360 / proyectos.length * indice);
    var tono2 = (tono + 30) % 360;
    if (variante % 2 === 0) {
      return "linear-gradient(155deg, hsl(" + tono + " 65% 42%), hsl(" + tono2 + " 78% 16%))";
    }
    return "radial-gradient(120% 120% at 20% 15%, hsl(" + tono2 + " 65% 50%), hsl(" + tono + " 60% 12%))";
  }

  function mostrarProyecto(indice) {
    if (proyectoActivo === indice || !tarjeta) return;
    proyectoActivo = indice;

    svg.querySelectorAll(".rueda-item").forEach(function (palabra) {
      var esEste = Number(palabra.dataset.idx) === indice;
      palabra.classList.toggle("is-active", esEste);
      palabra.classList.toggle("is-blur", !esEste);
    });
    svg.querySelectorAll(".rueda-sep").forEach(function (punto) { punto.classList.add("is-blur"); });

    tarjetaIndice.textContent = String(indice + 1).padStart(2, "0");
    tarjetaNombre.textContent = proyectos[indice];
    tarjeta.classList.add("is-visible");

    clearInterval(temporizadorColor);
    var variante = 0;
    capaA.style.background = colorDeProyecto(indice, variante);
    capaA.classList.add("is-on");
    capaB.classList.remove("is-on");

    temporizadorColor = setInterval(function () {
      variante++;
      var estaVisibleA = capaA.classList.contains("is-on");
      var capaQueEntra = estaVisibleA ? capaB : capaA;
      var capaQueSale = estaVisibleA ? capaA : capaB;
      capaQueEntra.style.background = colorDeProyecto(indice, variante);
      capaQueEntra.classList.add("is-on");
      capaQueSale.classList.remove("is-on");
    }, 1200);
  }

  function ocultarTarjeta() {
    proyectoActivo = null;
    svg.querySelectorAll(".rueda-item, .rueda-sep").forEach(function (el) {
      el.classList.remove("is-active", "is-blur");
    });
    if (tarjeta) tarjeta.classList.remove("is-visible");
    clearInterval(temporizadorColor);
  }

  svg.addEventListener("pointerover", function (evento) {
    var palabra = evento.target.closest(".rueda-item");
    if (palabra) mostrarProyecto(Number(palabra.dataset.idx));
  });

  svg.addEventListener("pointerout", function (evento) {
    var salioDeUnaPalabra = evento.target.closest(".rueda-item");
    if (!salioDeUnaPalabra) return;
    var entraAOtraPalabra = evento.relatedTarget && evento.relatedTarget.closest && evento.relatedTarget.closest(".rueda-item");
    if (!entraAOtraPalabra) ocultarTarjeta();
  });

  /* ============================================================
     ARRANQUE
     ============================================================ */
  function alScrollear() { leerScroll(); }

  function preparar() {
    rellenarLosDosCirculos();

    if (reduce) {
      grupoGrande.setAttribute("transform", "rotate(8 " + CENTRO_X + " " + CENTRO_Y + ")");
      grupoPequeno.setAttribute("transform", "rotate(55 " + CENTRO_X + " " + CENTRO_Y + ")");
      if (pistaScroll) pistaScroll.style.display = "none";
      return;
    }

    alScrollear();
    anguloGrande = anguloPequeno = anguloObjetivo; // empieza ya colocada, sin salto
    requestAnimationFrame(animar);
    window.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", alScrollear);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.load("600 36px 'Rethink Sans'").then(function () {
      return document.fonts.ready;
    }).catch(function () {}).then(preparar);
  } else {
    preparar();
  }
})();