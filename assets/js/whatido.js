/* What I do: scroll fijado (pin), un paso a la vez.
   Lógica (scramble/hover/scroll),
   adaptada a los ids/clases de index.html: aquí solo hay un párrafo
   compartido (whatido__desc) en vez de dos líneas, y no se invierte el
   fondo de toda la página (eso era un extra del prototipo, fuera del
   sistema de color del sitio). */
(function () {
  "use strict";

  var PASOS = [
    "Layout, type, colour and the states in between. Figma, components and systems, responsive from the first frame.",
    "Interviews, surveys, benchmarking, usability testing. Working out what the thing is for before deciding what it looks like — and testing whether I got it right.",
    "I build what I design in HTML and CSS, and I'm learning JavaScript properly. Designing something you'll have to build yourself changes how you design it.",
    "Type scales, spacing, colour and components — the rules that keep fifty screens looking like one product. Typography is the part I care most about, and two years of print is where I learned to."
  ];

  var pista = document.getElementById("whatidoPin");
  if (!pista) return;
  var lista = document.getElementById("whatidoList");
  var items = lista.querySelectorAll(".what-i-do__item");
  var desc  = document.getElementById("whatidoDesc");

  var activo = 0, enfocado = -1, hover = null;
  var arrancado = false;
  var reduce = !!(window.matchMedia &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- scramble ----------
     Cada posición recibe un umbral aleatorio entre 0 y 1 y se queda fija
     cuando el progreso lo supera: el texto se resuelve en desorden, no de
     izquierda a derecha. Los espacios no se tocan; si no, el párrafo se
     recompone entero en cada frame. */
  var GLIFOS = "abcdeghknopqrsuvxyzABCDEGHKNOPQRSUVXYZ0234568";
  var timers = [];
  function pararTimers(){ timers.forEach(function(t){ cancelAnimationFrame(t); }); timers = []; }
  function azar(){ return GLIFOS[(Math.random() * GLIFOS.length) | 0]; }

  function prepararCajas(el, texto){
    el.textContent = "";
    var frag = document.createDocumentFragment();
    var cajas = new Array(texto.length);
    var palabra = null;

    for (var i = 0; i < texto.length; i++){
      var c = texto[i];
      if (c === " "){
        palabra = null;
        frag.appendChild(document.createTextNode(" "));
        cajas[i] = null;
        continue;
      }
      if (!palabra){
        palabra = document.createElement("span");
        palabra.className = "w";
        frag.appendChild(palabra);
      }
      var s = document.createElement("span");
      s.className = "g";
      s.textContent = c;
      palabra.appendChild(s);
      cajas[i] = s;
    }
    el.appendChild(frag);

    for (var j = 0; j < cajas.length; j++){
      if (cajas[j]) cajas[j].style.width = cajas[j].getBoundingClientRect().width + "px";
    }
    return cajas;
  }

  function scramble(el, texto, dur, retraso){
    var cajas = prepararCajas(el, texto);
    var largo = texto.length;
    var umbral = new Array(largo), glifo = new Array(largo);

    for (var i = 0; i < largo; i++){
      umbral[i] = Math.random();
      glifo[i]  = azar();
      if (cajas[i]) cajas[i].textContent = glifo[i];
    }

    var inicio = null;
    function paso(t){
      if (inicio === null) inicio = t;
      var p = (t - inicio - (retraso || 0)) / dur;
      if (p < 0) p = 0;
      if (p > 1) p = 1;

      for (var i = 0; i < largo; i++){
        var s = cajas[i];
        if (!s) continue;
        if (umbral[i] <= p){
          if (s.textContent !== texto[i]) s.textContent = texto[i];
          continue;
        }
        if (Math.random() < 0.32){ glifo[i] = azar(); s.textContent = glifo[i]; }
      }

      if (p < 1) timers.push(requestAnimationFrame(paso));
      else el.textContent = texto;
    }
    timers.push(requestAnimationFrame(paso));
  }

  /* ---------- pintar ---------- */
  function pintarEnfocado(){
    var i = (hover === null) ? activo : hover;
    if (i === enfocado) return;
    enfocado = i;

    for (var k = 0; k < items.length; k++){
      items[k].classList.toggle("is-active", k === i);
    }

    var texto = PASOS[i];
    pararTimers();

    if (reduce || !arrancado){ desc.textContent = texto; return; }

    scramble(desc, texto, 440);
  }

  function irA(i){ activo = i; pintarEnfocado(); }

  /* ---------- hover, foco y clic ---------- */
  items.forEach(function(item){
    var i = parseInt(item.getAttribute("data-i"), 10);
    item.addEventListener("mouseenter", function(){ hover = i; pintarEnfocado(); });
    item.addEventListener("focus",      function(){ hover = i; pintarEnfocado(); });
    item.addEventListener("click",      function(){ hover = null; irA(i); });
  });
  lista.addEventListener("mouseleave", function(){ hover = null; pintarEnfocado(); });
  lista.addEventListener("focusout", function(e){
    if (!lista.contains(e.relatedTarget)) { hover = null; pintarEnfocado(); }
  });

  /* ---------- paso, calculado del scroll ----------
     Se calcula la posición en cada frame en vez de escuchar intersecciones:
     así un salto de scrollbar no se puede saltar un paso. */
  var elEntrada = pista.querySelector(".whatido-pin__mark-in");
  var elPaso    = pista.querySelector(".whatido-pin__mark-step");
  var hEntrada = 0, hPaso = 1;

  function medir(){
    hEntrada = elEntrada.getBoundingClientRect().height;
    hPaso    = elPaso.getBoundingClientRect().height || 1;
  }

  var pendiente = false;
  function calcularPaso(){
    pendiente = false;
    var r = pista.getBoundingClientRect();
    var mitad = window.innerHeight / 2;
    var dentro = (r.top < mitad && r.bottom > mitad);

    if (dentro && !arrancado){
      arrancado = true;
      enfocado = -1;
      pintarEnfocado();
    }

    var i = Math.floor((-r.top - hEntrada) / hPaso);
    if (i < 0) i = 0;
    if (i > PASOS.length - 1) i = PASOS.length - 1;
    if (i !== activo){ hover = null; irA(i); }
  }
  function alScroll(){
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(calcularPaso);
  }

  window.addEventListener("scroll", alScroll, { passive:true });
  window.addEventListener("resize", function(){ medir(); alScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ medir(); alScroll(); });

  medir();
  alScroll();
})();
