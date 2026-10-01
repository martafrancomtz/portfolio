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

  /* ---------- reescritura ----------
     La misma que los botones (assets/js/rewrite.js, estilo "Aino": letras
     al azar de ancho parecido que se resuelven de izquierda a derecha).
     Mientras dura, cada palabra va en una caja con su ancho fijado: las
     letras al azar no miden exactamente lo mismo y, sin esto, el párrafo
     cambiaría de corte de línea y el texto saltaría. Al acabar vuelve a
     ser texto normal. */
  var DURACION = 500;          // la de los botones (main.js)

  function reescribir(el, texto){
    if (window.Rewrite) window.Rewrite.reset(el);
    el.textContent = "";
    var frag = document.createDocumentFragment();
    var palabras = texto.split(" ");
    var cajas = palabras.map(function(p, i){
      if (i) frag.appendChild(document.createTextNode(" "));
      var w = document.createElement("span");
      w.className = "w";
      w.textContent = p;
      frag.appendChild(w);
      return w;
    });
    el.appendChild(frag);
    if (!window.Rewrite){ el.textContent = texto; return; }
    cajas.forEach(function(w){ w.style.width = w.getBoundingClientRect().width + "px"; });
    window.Rewrite.run(el, DURACION, function(){ el.textContent = texto; });
  }
  function pararTimers(){ if (window.Rewrite) window.Rewrite.reset(desc); }

  /* ---------- pantallas pequeñas: el texto va debajo de su enunciado ----------
     En una columna, el párrafo se mueve dentro del enunciado activo (justo
     debajo de su título) en vez de quedarse al final de la lista. */
  var grid = desc.parentNode;
  var pequena = window.matchMedia("(max-width: 60rem)");
  function colocarDesc(){
    var destinoDesc = pequena.matches && enfocado >= 0 ? items[enfocado] : grid;
    if (desc.parentNode !== destinoDesc) destinoDesc.appendChild(desc);
  }
  pequena.addEventListener("change", colocarDesc);

  /* ---------- pintar ---------- */
  function pintarEnfocado(){
    var i = (hover === null) ? activo : hover;
    if (i === enfocado) return;
    enfocado = i;
    colocarDesc();

    for (var k = 0; k < items.length; k++){
      items[k].classList.toggle("is-active", k === i);
    }

    var texto = PASOS[i];
    pararTimers();

    if (reduce || !arrancado){ desc.textContent = texto; return; }

    reescribir(desc, texto);
  }

  function irA(i){ activo = i; pintarEnfocado(); }

  /* ---------- hover, foco y clic ----------
     Al pasar por un enunciado (o tocarlo) el scroll salta a su tramo: así
     el scroll y lo que se ve van siempre a la par. Mientras dura el salto,
     no se pintan los pasos intermedios. */
  var destino = null, finSalto = 0;
  function saltarA(i){
    var r = pista.getBoundingClientRect();
    var fijado = r.top <= 1 && r.bottom >= window.innerHeight - 1;
    if (!fijado) return;                       // solo con el bloque fijado en pantalla
    var y = window.scrollY + r.top + hEntrada + (i + 0.5) * hPaso;
    if (Math.abs(y - window.scrollY) < hPaso * 0.5) return;   // ya está en su tramo
    destino = i;
    clearTimeout(finSalto);
    finSalto = setTimeout(function(){ destino = null; alScroll(); }, 1500);
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }

  /* En pantallas táctiles no hay salto de scroll: el toque (o el roce al
     arrastrar) disparaba un scroll automático que peleaba con el dedo y
     dejaba la página a medias. Ahí el enunciado cambia solo con el scroll,
     y tocarlo solo lo muestra. */
  var conRaton = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);

  items.forEach(function(item){
    var i = parseInt(item.getAttribute("data-i"), 10);
    item.addEventListener("mouseenter", function(){
      if (!conRaton) return;
      hover = i; pintarEnfocado(); saltarA(i);
    });
    item.addEventListener("focus",      function(){ hover = i; pintarEnfocado(); });
    item.addEventListener("click",      function(){ hover = null; irA(i); if (conRaton) saltarA(i); });
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
    // fondo oscuro mientras el bloque ocupa el centro
    document.documentElement.classList.toggle("is-oscuro", dentro);

    if (dentro && !arrancado){
      arrancado = true;
      enfocado = -1;
      pintarEnfocado();
    }

    var i = Math.floor((-r.top - hEntrada) / hPaso);
    if (i < 0) i = 0;
    if (i > PASOS.length - 1) i = PASOS.length - 1;
    if (destino !== null){
      if (i !== destino) return;               // saltando: aún no ha llegado
      destino = null; clearTimeout(finSalto);
      activo = i; return;                      // ya se ve el suyo (el del hover)
    }
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
