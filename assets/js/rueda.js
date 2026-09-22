/* ==================================================================
   RUEDA: pin de scroll (1 vuelta) + hover (o toque) con tarjeta flotante.
  
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
  /* El SVG junta los espacios seguidos en uno y quita los del final del
     texto: en la unión del círculo (el último nombre con el primero) el
     punto quedaba pegado a "3D bottle". Con un espacio duro (\u00A0) al
     final, ese último espacio no se pierde y el punto queda centrado. */
  var separador = " \u00B7\u00A0";

  /* Qué se ve en la tarjeta de cada proyecto (ruta desde index.html).
     - Una imagen o gif:  "assets/img/proyectos/nombre.jpg"
     - Un vídeo:          "assets/img/proyectos/nombre.mp4"  (sin sonido, en bucle)
     - Varias imágenes:   ["a.jpg", "b.jpg", "c.jpg"]  → se van cambiando rápido
     El nombre tiene que ser IGUAL que en la lista de arriba.
     Si un proyecto no aparece aquí, se ve un degradado de color. */
  var medios = {
    "Students Life Cards": "assets/img/playing-cards-mockup.png"
    // "3D bottle": "assets/img/proyectos/3d-bottle.mp4",
    // "Off-White": ["assets/img/proyectos/ow-1.jpg", "assets/img/proyectos/ow-2.jpg"],
  };
  var VELOCIDAD_FLIPBOOK = 200; // ms entre imagen e imagen. No bajes de ~170: los cambios muy rápidos pueden molestar

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
     GIRAR SEGÚN SCROLL (1 vuelta repartida en el recorrido del pin, 220vh)
     ============================================================ */
  var grupoGrande = document.getElementById("wheelBig");
  var grupoPequeno = document.getElementById("wheelSmall");

  /* Ajustes del movimiento (juega con ellos) */
  var INERCIA_GRANDE = 0.05;   // 0–1. Más bajo = más pesado, tarda más en alcanzar al scroll
  var INERCIA_PEQUENA = 0.08;  // el pequeño es más ligero: reacciona antes
  var DERIVA = 3;              // grados por segundo que gira sola, se scrollee o no (0 = quieta)

  var anguloObjetivo = 0;                  // a dónde manda el scroll
  var anguloGrande = 0, anguloPequeno = 0; // lo que se pinta de verdad
  var derivaAcumulada = 0;
  var velocidadDeriva = DERIVA;            // velocidad actual del giro constante
  var FRENADA = 0.08;                      // 0–1. Lo rápido que frena/arranca con el hover (1 = de golpe)
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
      // Giro constante: con hover frena hasta pararse; al salir, vuelve a arrancar.
      var derivaDeseada = proyectoActivo === null ? DERIVA : 0;
      velocidadDeriva = acercar(velocidadDeriva, derivaDeseada, FRENADA, pasos);
      derivaAcumulada += velocidadDeriva * segundos;

      var objetivo = anguloObjetivo + derivaAcumulada;
      anguloGrande = acercar(anguloGrande, objetivo, INERCIA_GRANDE, pasos);
      anguloPequeno = acercar(anguloPequeno, objetivo, INERCIA_PEQUENA, pasos);

      grupoGrande.setAttribute("transform", "rotate(" + (8 + anguloGrande).toFixed(2) + " " + CENTRO_X + " " + CENTRO_Y + ")");
      grupoPequeno.setAttribute("transform", "rotate(" + (55 + anguloPequeno).toFixed(2) + " " + CENTRO_X + " " + CENTRO_Y + ")");
    }

    actualizarTarjeta(pasos);
    requestAnimationFrame(animar);
  }

  /* ============================================================
     HOVER: difuminar el resto y mostrar la tarjeta central
     ============================================================ */
  var svg = pin.querySelector("svg");
  var tarjeta = document.getElementById("wheelCard");
  var tarjetaImagen = document.getElementById("wheelCardImg");
  var tarjetaVideo = document.getElementById("wheelCardVideo");
  var capaA = tarjeta ? tarjeta.querySelector(".a") : null;
  var capaB = tarjeta ? tarjeta.querySelector(".b") : null;

  var proyectoActivo = null;
  var temporizadorColor = null;
  var temporizadorFlipbook = null;

  function colorDeProyecto(indice, variante) {
    var tono = Math.round(360 / proyectos.length * indice);
    var tono2 = (tono + 30) % 360;
    if (variante % 2 === 0) {
      return "linear-gradient(155deg, hsl(" + tono + " 65% 42%), hsl(" + tono2 + " 78% 16%))";
    }
    return "radial-gradient(120% 120% at 20% 15%, hsl(" + tono2 + " 65% 50%), hsl(" + tono + " 60% 12%))";
  }

  /* ============================================================
     TARJETA: sitio al azar, sin tocar nunca la rueda
     ============================================================ */
  var MARGEN_RUEDA = 80;        // distancia mínima a la rueda, en unidades del SVG
  var MARGEN_PANTALLA = 24;     // aire con los bordes de la ventana, en px
  var INERCIA_TARJETA = 0.1;    // 0–1. Más bajo = tarda más en viajar a su nuevo sitio
  var INCLINACION_MAX = 4;      // grados que se inclina como mucho al moverse

  var tarjetaX = 0, tarjetaY = 0, tarjetaGiro = 0;   // dónde está
  var destinoX = 0, destinoY = 0;                     // a dónde va

  /* El círculo que ocupa la rueda en la pantalla, en px.
     getScreenCTM() traduce coordenadas del SVG (viewBox) a píxeles. */
  function zonaDeLaRueda() {
    var matriz = svg.getScreenCTM();
    var centro = new DOMPoint(CENTRO_X, CENTRO_Y).matrixTransform(matriz);
    return { x: centro.x, y: centro.y, r: (RADIO_GRANDE + MARGEN_RUEDA) * matriz.a };
  }

  /* Distancia entre el centro de la rueda y el punto de la tarjeta
     que le queda más cerca. Si es menor que el radio, se solapan. */
  function distanciaALaRueda(x, y, ancho, alto, rueda) {
    var px = Math.max(x, Math.min(rueda.x, x + ancho));
    var py = Math.max(y, Math.min(rueda.y, y + alto));
    var dx = px - rueda.x, dy = py - rueda.y;
    return { dx: dx, dy: dy, d: Math.sqrt(dx * dx + dy * dy) };
  }

  /* Prueba posiciones en una rejilla de 16 px, descarta las que pisan
     la rueda y devuelve una de las libres al azar. */
  function buscarHuecoAlAzar(ancho, alto) {
    var rueda = zonaDeLaRueda();
    var maxX = window.innerWidth - ancho - MARGEN_PANTALLA;
    var maxY = window.innerHeight - alto - MARGEN_PANTALLA;
    var libres = [];
    var masLejos = { x: MARGEN_PANTALLA, y: Math.max(MARGEN_PANTALLA, maxY) }, masLejosD = -1;

    for (var x = MARGEN_PANTALLA; x <= maxX; x += 16) {
      for (var y = MARGEN_PANTALLA; y <= maxY; y += 16) {
        var d = distanciaALaRueda(x, y, ancho, alto, rueda).d;
        if (d > masLejosD) { masLejosD = d; masLejos = { x: x, y: y }; }
        if (d >= rueda.r) libres.push({ x: x, y: y });
      }
    }
    if (libres.length) return libres[Math.floor(Math.random() * libres.length)];
    return masLejos; // sin hueco (pantallas muy pequeñas): lo más lejos posible
  }

  /* Seguro: si en su camino la tarjeta llega a rozar la rueda, se la empuja hacia fuera. */
  function empujarFuera(ancho, alto) {
    var rueda = zonaDeLaRueda();
    var info = distanciaALaRueda(tarjetaX, tarjetaY, ancho, alto, rueda);
    if (info.d >= rueda.r) return;
    if (info.d === 0) { tarjetaX = destinoX; tarjetaY = destinoY; return; }
    var falta = rueda.r - info.d;
    tarjetaX += info.dx / info.d * falta;
    tarjetaY += info.dy / info.d * falta;
  }

  function pintarTarjeta() {
    tarjeta.style.translate = tarjetaX.toFixed(1) + "px " + tarjetaY.toFixed(1) + "px";
    tarjeta.style.rotate = tarjetaGiro.toFixed(2) + "deg";
  }

  /* Se llama en cada frame desde animar(). */
  function actualizarTarjeta(pasos) {
    if (proyectoActivo === null || !tarjeta) return;
    var ancho = tarjeta.offsetWidth, alto = tarjeta.offsetHeight;

    // Si la rueda se ha movido y su sitio ya no está libre, busca otro.
    var rueda = zonaDeLaRueda();
    if (distanciaALaRueda(destinoX, destinoY, ancho, alto, rueda).d < rueda.r) {
      var hueco = buscarHuecoAlAzar(ancho, alto);
      destinoX = hueco.x; destinoY = hueco.y;
    }

    var xAntes = tarjetaX;
    tarjetaX = acercar(tarjetaX, destinoX, INERCIA_TARJETA, pasos);
    tarjetaY = acercar(tarjetaY, destinoY, INERCIA_TARJETA, pasos);
    empujarFuera(ancho, alto);

    // Se inclina hacia donde se mueve, como si colgara.
    var velocidad = pasos > 0 ? (tarjetaX - xAntes) / pasos : 0;
    var giroDeseado = Math.max(-INCLINACION_MAX, Math.min(INCLINACION_MAX, velocidad * 0.5));
    tarjetaGiro = acercar(tarjetaGiro, giroDeseado, 0.1, pasos);

    pintarTarjeta();
  }

  /* Coloca la tarjeta de golpe en un sitio al azar (al aparecer). */
  function colocarTarjeta() {
    var hueco = buscarHuecoAlAzar(tarjeta.offsetWidth, tarjeta.offsetHeight);
    destinoX = tarjetaX = hueco.x;
    destinoY = tarjetaY = hueco.y;
    tarjetaGiro = 0;
    pintarTarjeta();
  }

  /* ============================================================
     CONTENIDO DE LA TARJETA: imagen, gif, vídeo o secuencia
     ============================================================ */
  function esVideo(ruta) { return /\.(mp4|webm|mov)$/i.test(ruta); }

  function pararMedios() {
    clearInterval(temporizadorColor);
    clearInterval(temporizadorFlipbook);
    if (tarjetaVideo) tarjetaVideo.pause();
  }

  function ponerMedio(indice) {
    pararMedios();
    var medio = medios[proyectos[indice]];
    tarjetaImagen.classList.remove("is-on");
    tarjetaVideo.classList.remove("is-on");

    // El degradado de color hace de fondo mientras carga (o si no hay nada).
    var variante = 0;
    capaA.style.background = colorDeProyecto(indice, variante);
    capaA.classList.add("is-on");
    capaB.classList.remove("is-on");

    // 1) Sin imagen: los degradados se van alternando, como antes.
    if (!medio) {
      temporizadorColor = setInterval(function () {
        variante++;
        var estaVisibleA = capaA.classList.contains("is-on");
        var capaQueEntra = estaVisibleA ? capaB : capaA;
        var capaQueSale = estaVisibleA ? capaA : capaB;
        capaQueEntra.style.background = colorDeProyecto(indice, variante);
        capaQueEntra.classList.add("is-on");
        capaQueSale.classList.remove("is-on");
      }, 1200);
      return;
    }

    // 2) Vídeo: se reproduce desde el principio, sin sonido y en bucle.
    if (typeof medio === "string" && esVideo(medio)) {
      if (tarjetaVideo.getAttribute("src") !== medio) tarjetaVideo.src = medio;
      tarjetaVideo.currentTime = 0;
      tarjetaVideo.classList.add("is-on");
      if (!reduce) tarjetaVideo.play().catch(function () {});
      return;
    }

    // 3) Una imagen o gif, o 4) una lista de imágenes que se van cambiando.
    var lista = typeof medio === "string" ? [medio] : medio;
    lista.forEach(function (ruta) { new Image().src = ruta; }); // precarga
    var paso = 0;
    tarjetaImagen.src = lista[0];
    tarjetaImagen.classList.add("is-on");

    if (lista.length > 1 && !reduce) {
      temporizadorFlipbook = setInterval(function () {
        paso = (paso + 1) % lista.length;
        tarjetaImagen.src = lista[paso];
      }, VELOCIDAD_FLIPBOOK);
    }
  }

  /* ============================================================
     HOVER: difuminar el resto y mostrar la tarjeta
     ============================================================ */
  function mostrarProyecto(indice) {
    if (proyectoActivo === indice || !tarjeta) return;
    var estabaOculta = proyectoActivo === null;
    proyectoActivo = indice;

    if (estabaOculta || reduce) {
      colocarTarjeta();
    } else {
      var hueco = buscarHuecoAlAzar(tarjeta.offsetWidth, tarjeta.offsetHeight);
      destinoX = hueco.x; destinoY = hueco.y; // viaja hasta el nuevo sitio
    }

    svg.querySelectorAll(".rueda-item").forEach(function (palabra) {
      var esEste = Number(palabra.dataset.idx) === indice;
      palabra.classList.toggle("is-active", esEste);
      palabra.classList.toggle("is-blur", !esEste);
    });
    svg.querySelectorAll(".rueda-sep").forEach(function (punto) { punto.classList.add("is-blur"); });

    ponerMedio(indice);
    tarjeta.classList.add("is-visible");
  }

  function ocultarTarjeta() {
    proyectoActivo = null;
    svg.querySelectorAll(".rueda-item, .rueda-sep").forEach(function (el) {
      el.classList.remove("is-active", "is-blur");
    });
    if (tarjeta) tarjeta.classList.remove("is-visible");
    pararMedios();
  }

  /* Al hacer scroll la tarjeta se esconde, y no vuelve a salir mientras
     sigas scrolleando. Cuando paras, sale si el ratón está sobre un proyecto. */
  var scrollEnMarcha = null;
  function esconderAlScrollear() {
    if (proyectoActivo !== null) ocultarTarjeta();
    clearTimeout(scrollEnMarcha);
    scrollEnMarcha = setTimeout(function () { scrollEnMarcha = null; }, 250);
  }

  /* Con ratón: hover. En móvil/táctil no hay hover: la tarjeta se abre al
     tocar una palabra, se cierra al tocarla otra vez o al tocar fuera. */
  function hoverSobre(evento) {
    if (evento.pointerType !== "mouse") return;
    if (scrollEnMarcha) return;
    var palabra = evento.target.closest(".rueda-item");
    if (palabra) mostrarProyecto(Number(palabra.dataset.idx));
  }

  svg.addEventListener("pointerover", hoverSobre);
  svg.addEventListener("pointermove", hoverSobre); // para volver a mostrarla tras el scroll

  svg.addEventListener("pointerout", function (evento) {
    if (evento.pointerType !== "mouse") return;
    var salioDeUnaPalabra = evento.target.closest(".rueda-item");
    if (!salioDeUnaPalabra) return;
    var entraAOtraPalabra = evento.relatedTarget && evento.relatedTarget.closest && evento.relatedTarget.closest(".rueda-item");
    if (!entraAOtraPalabra) ocultarTarjeta();
  });

  var ultimoPuntero = "mouse";
  document.addEventListener("pointerdown", function (e) { ultimoPuntero = e.pointerType; }, true);
  document.addEventListener("click", function (evento) {
    if (ultimoPuntero === "mouse") return;
    var palabra = evento.target.closest && evento.target.closest(".rueda-item");
    if (!palabra) { if (proyectoActivo !== null) ocultarTarjeta(); return; }
    var indice = Number(palabra.dataset.idx);
    if (proyectoActivo === indice) ocultarTarjeta();
    else mostrarProyecto(indice);
  });

  /* ============================================================
     ARRANQUE
     ============================================================ */
  function alScrollear() { leerScroll(); }

  /* ============================================================
     HUECO DE ABAJO: el escenario ocupa una pantalla, pero la rueda solo
     la parte de arriba. Ese hueco hace falta mientras gira (ahí salen las
     imágenes), pero al acabar se veía como un espacio enorme. La sección
     siguiente sube a ocuparlo en el último tramo (margen negativo del
     pin): mientras la rueda sigue fija, "What I do" entra por debajo, y
     después todo sube junto, a la separación normal entre secciones.
     ============================================================ */
  var escenario = pin.querySelector(".rueda-stage");
  function ajustarHueco() {
    var matriz = svg.getScreenCTM();
    if (!matriz || !escenario) return;
    // punto más bajo de la rueda: radio grande + su letra, bajo el centro
    var fondo = new DOMPoint(CENTRO_X, CENTRO_Y + RADIO_GRANDE + LETRA_GRANDE).matrixTransform(matriz).y;
    var hueco = escenario.offsetHeight - (fondo - escenario.getBoundingClientRect().top);
    // se deja un poco de aire extra (20% de pantalla): si no, "What I do"
    // llega a la vez que su cambio a fondo oscuro y se solapa con la rueda
    hueco -= window.innerHeight * 0.2;
    pin.style.marginBottom = -Math.max(0, Math.round(hueco)) + "px";
  }

  function preparar() {
    rellenarLosDosCirculos();
    window.addEventListener("scroll", esconderAlScrollear, { passive: true });

    if (reduce) {
      grupoGrande.setAttribute("transform", "rotate(8 " + CENTRO_X + " " + CENTRO_Y + ")");
      grupoPequeno.setAttribute("transform", "rotate(55 " + CENTRO_X + " " + CENTRO_Y + ")");
      return;
    }

    ajustarHueco();
    window.addEventListener("resize", ajustarHueco);
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