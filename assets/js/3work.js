/* Selected work: scroll fijado (pin) + ficha por proyecto.
   Lógica (medir/scramble/pintar/scroll),
   adaptada a los ids/clases de index.html. El cursor "crece" reutilizando
   el cursor global (#cursor, ver main.js) en vez de duplicar un cursor propio. */
(function () {
  "use strict";

  var OBRAS = [
    { titulo:"Antonio Franco — Fashion portfolio", indice:"(01)",
      roles:"Web design, Front end",   ano:"2026" },
    { titulo:"ConSentío",              indice:"(02)",
      roles:"UX Research, UI Design",  ano:"2025" },
    { titulo:"Portfolio v1 → v2",      indice:"(03)",
      roles:"Web design, Front-end",   ano:"2025–26" }
  ];

  /* Todo en unidades de fase (1 = una imagen). */
  var VIAJE    = 0.22;   /* lo que tardan los textos en colocarse */
  var MINI     = 0.04;   /* aparece la miniatura */
  var IMG_INI  = 0.16;   /* y empieza a entrar */
  var CREZCA   = 0.45;   /* lo que tarda en abrirse: el resto de la fase, quieta */
  var ARRANQUE = 0.10;   /* aquí se reescriben los textos de la ficha */
  var VUELTA   = 3.30;   /* la imagen ya se ha ido; vuelven los textos */
  var TMAX     = 3.70;

  var pista = document.getElementById("workPin");
  if (!pista) return;
  var lista = document.getElementById("workList");
  var filas = lista.querySelectorAll(".selected-work__row");
  var todo  = document.getElementById("workAll");
  var fotos = document.querySelectorAll(".work-pin__photo");
  var veres = document.querySelectorAll(".work-pin__view");
  var cursor = document.getElementById("cursor");

  var reduce = !!(window.matchMedia &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduce) return;

  /* ============ las ocho piezas ============ */
  var COL = { n:".c-n", t:".c-t", r:".c-r", a:".c-a" };
  function celda(cod){
    return filas[+cod[0] - 1].querySelector(COL[cod[1]]);
  }

  var V = [];
  Array.prototype.forEach.call(document.querySelectorAll(".vj"), function(el){
    var a = celda(el.getAttribute("data-a"));
    var c = celda(el.getAttribute("data-c"));
    var v = {
      el: el,
      a: a, c: c,
      b: document.getElementById(el.getAttribute("data-b")),
      der: el.getAttribute("data-lado") === "der",
      campo: el.getAttribute("data-campo"),          /* null = acompañante */
      antes: a.textContent, despues: c.textContent,
      Ax:0, Ay:0, Bx:0, By:0, Cx:0, Cy:0
    };
    el.textContent = v.antes;
    V.push(v);
  });

  for (var z = 0; z < fotos.length; z++) fotos[z].style.zIndex = String(z + 1);

  /* ============ scramble ============ */
  /* ---------- glifos que caben ----------
     Cada letra se anima dentro de una caja del ancho de su carácter final.
     Se miden todos los glifos una vez y cada posición sortea solo entre los
     que le caben, para no romper el ancho de la línea en ningún frame. */
  var POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!|/\\-+*<>";
  var medidas = {};

  function tablaDe(el){
    var cs = getComputedStyle(el);
    var clave = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    if (medidas[clave]) return medidas[clave];
    var m = document.createElement("span");
    m.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;" +
                      "white-space:pre;font-weight:" + cs.fontWeight +
                      ";font-size:" + cs.fontSize + ";font-family:" + cs.fontFamily;
    document.body.appendChild(m);
    var lista2 = [];
    for (var i = 0; i < POOL.length; i++){
      m.textContent = POOL[i];
      lista2.push({ c: POOL[i], w: m.getBoundingClientRect().width });
    }
    document.body.removeChild(m);
    lista2.sort(function(a, b){ return a.w - b.w; });
    medidas[clave] = lista2;
    return lista2;
  }

  function caben(lista2, ancho){
    var lo = 0, hi = lista2.length;
    while (lo < hi){
      var mid = (lo + hi) >> 1;
      if (lista2[mid].w <= ancho) lo = mid + 1; else hi = mid;
    }
    return lo < 1 ? 1 : lo;
  }

  var timers = [];
  function pararTimers(){
    for (var i = 0; i < timers.length; i++) cancelAnimationFrame(timers[i]);
    timers = [];
  }
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
    var lista2 = tablaDe(el), topes = new Array(cajas.length);
    for (var j = 0; j < cajas.length; j++){
      if (!cajas[j]) continue;
      var w = cajas[j].getBoundingClientRect().width;
      cajas[j].style.width = w + "px";
      topes[j] = caben(lista2, w + 0.5);
    }
    return { cajas: cajas, topes: topes, lista: lista2 };
  }

  function scramble(el, texto, dur, retraso){
    var prep = prepararCajas(el, texto);
    var cajas = prep.cajas, topes = prep.topes, lista2 = prep.lista;
    var largo = texto.length;
    var umbral = new Array(largo);
    function azar(i){ return lista2[(Math.random() * topes[i]) | 0].c; }
    for (var i = 0; i < largo; i++){
      umbral[i] = Math.random();
      if (cajas[i]) cajas[i].textContent = azar(i);
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
        if (Math.random() < 0.32) s.textContent = azar(i);
      }
      if (p < 1) timers.push(requestAnimationFrame(paso));
      else el.textContent = texto;
    }
    timers.push(requestAnimationFrame(paso));
  }

  /* ============ viaje ============ */
  var escala = 1, pIn = 0, pOut = 0, abierto = 0;

  function aplicarViaje(){
    var opAcomp = (1 - tope(abierto / 0.62, 0, 1)).toFixed(3);
    for (var i = 0; i < V.length; i++){
      var v = V[i], x, y, s;
      if (pOut > 0){                       /* de la ficha a las filas 02 y 03 */
        x = v.Bx + (v.Cx - v.Bx) * pOut;
        y = v.By + (v.Cy - v.By) * pOut;
        s = escala + (1 - escala) * pOut;
      } else {                             /* de las filas 01 y 02 a la ficha */
        x = v.Ax + (v.Bx - v.Ax) * pIn;
        y = v.Ay + (v.By - v.Ay) * pIn;
        s = 1 + (escala - 1) * pIn;
      }
      v.el.style.transform =
        "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
      if (!v.campo) v.el.style.opacity = opAcomp;
    }
  }

  function medirViajes(){
    for (var i = 0; i < V.length; i++) V[i].el.style.transform = "none";

    escala = (parseFloat(getComputedStyle(V[0].b).fontSize) || 16) /
             (parseFloat(getComputedStyle(V[0].el).fontSize) || 20);

    for (var j = 0; j < V.length; j++){
      var v = V[j];
      var n = v.el.getBoundingClientRect();
      var a = v.a.getBoundingClientRect();
      var b = v.b.getBoundingClientRect();
      var c = v.c.getBoundingClientRect();
      var cy = n.top + n.height / 2;

      v.Ax = a.left - n.left;
      v.Cx = c.left - n.left;
      v.Bx = v.der ? (b.right - n.width * escala - n.left) : (b.left - n.left);
      v.Ay = (a.top + a.height / 2) - cy;
      v.Cy = (c.top + c.height / 2) - cy;
      v.By = (b.top + b.height / 2) - cy;
    }
    aplicarViaje();
  }

  /* ============ textos ============
     −1 = como está en la lista de partida · 0..2 = obra en la ficha ·
      3 = como queda en la lista de llegada. */
  var estado = -9;
  var DUR = { titulo:300, indice:220, roles:340, ano:260 };
  var RET = { titulo:0,   indice:40,  roles:60,  ano:90 };

  function textoDe(v, e){
    if (e < 0) return v.antes;
    if (e > 2) return v.despues;
    if (v.campo) return OBRAS[e][v.campo];
    return (e >= 2) ? v.despues : v.antes;
  }

  function ponerTextos(e, animar){
    if (e === estado) return;
    estado = e;
    pista.setAttribute("data-obra", String(e));
    pararTimers();
    for (var k = 0; k < V.length; k++) V[k].el.style.transform = "none";
    for (var j = 0; j < V.length; j++){
      var v = V[j], destino = textoDe(v, e);
      if (v.el.textContent === destino) continue;
      if (animar && v.campo) scramble(v.el, destino, DUR[v.campo], RET[v.campo]);
      else v.el.textContent = destino;
    }
    medirViajes();
  }

  /* ============ curvas ============ */
  function tope(x, a, b){ return x < a ? a : (x > b ? b : x); }
  function abrir(x){ return 1 - Math.pow(1 - x, 2.4); }
  function suave(x){ return x * x * (3 - 2 * x); }

  /* ============ pintar ============ */
  var s0 = 0.12, anchoMarco = 900;
  var ant = { esc:[-1,-1,-1], op:[-1,-1,-1], ver:[-1,-1,-1], p:-1 };
  var hoverable = [false, false, false];
  var arrancado = false;

  function pintar(t){
    pIn  = suave(tope(t / VIAJE, 0, 1));
    pOut = suave(tope((t - VUELTA) / VIAJE, 0, 1));
    abierto = pIn * (1 - pOut);

    var vuelta = suave(tope((t - 3) / 0.32, 0, 1));
    var fin    = tope((t - 3.14) / 0.20, 0, 1);

    for (var i = 0; i < fotos.length; i++){
      var ini = (i === 0) ? IMG_INI : i;
      var entra = tope((t - ini) / CREZCA, 0, 1);

      var f   = abrir(entra) * (1 - vuelta);
      var esc = s0 + (1 - s0) * f;
      var nace   = (i === 0) ? tope((t - MINI) / 0.05, 0, 1) : tope((t - i) / 0.06, 0, 1);
      var tapada = (i < fotos.length - 1) ? tope((t - i - 1 - CREZCA) / 0.06, 0, 1) : 0;
      var op = nace * (1 - tapada) * (1 - fin);
      var centrado = f;
      var trans = "translate(-50%,-50%) scale(" + esc.toFixed(4) + ")";

      if (trans !== ant.esc[i]){ fotos[i].style.transform = trans; ant.esc[i] = trans; }

      if (Math.abs(op - ant.op[i]) > 0.004){
        fotos[i].style.opacity = op.toFixed(3);
        ant.op[i] = op;
      }
      /* el "View" y el hover propio, solo en la imagen que manda ahora y
         cuando ya está colocada del todo */
      var esActual = (i === Math.min(fotos.length - 1, Math.floor(t)));
      var v = esActual ? tope((centrado - 0.94) / 0.06, 0, 1) * op : 0;
      if (Math.abs(v - ant.ver[i]) > 0.004){
        veres[i].style.opacity = v.toFixed(3);
        var puede = v > 0.9;
        if (puede !== hoverable[i]){
          hoverable[i] = puede;
          fotos[i].style.pointerEvents = puede ? "auto" : "none";
          if (!puede && sobre === i) salirFoto(i);
        }
        ant.ver[i] = v;
      }
    }

    if (Math.abs(abierto - ant.p) > 0.002){
      ant.p = abierto;
      aplicarViaje();
      var vis = 1 - tope(abierto / 0.55, 0, 1);
      var cerrando = (t >= VUELTA) ? 1 : 0;
      var op0 = vis * cerrando;
      var op2 = vis * (1 - cerrando);
      /* en reposo (op = 1) se limpia el inline style para que siga
         funcionando el :hover{opacity:.55} de .selected-work__row */
      filas[0].style.opacity = op0 >= 0.999 ? "" : op0.toFixed(3);
      filas[2].style.opacity = op2 >= 0.999 ? "" : op2.toFixed(3);
      todo.style.opacity = vis.toFixed(3);
      todo.style.pointerEvents = vis < 0.6 ? "none" : "auto";
      lista.style.pointerEvents = vis < 0.6 ? "none" : "auto";
    }

    var e;
    if (t < ARRANQUE) e = -1;
    else if (t >= VUELTA) e = 3;
    else e = Math.min(2, Math.floor(t));
    ponerTextos(e, arrancado);
  }

  /* ============ hover de las fotos: solo cursor global (main.js) ============
     main.js ya hace crecer #cursor en cualquier <a> (incluidas estas fotos).
     Aquí solo nos aseguramos de que no se quede "crecido" si una foto deja
     de ser interactiva (pointer-events:none) mientras el ratón sigue quieto
     encima: eso no dispara mouseleave por sí solo. */
  var sobre = -1;
  function salirFoto(i){
    if (sobre === i){
      sobre = -1;
      if (cursor) cursor.classList.remove("is-grow");
    }
  }
  Array.prototype.forEach.call(fotos, function(el, i){
    el.addEventListener("mouseenter", function(){ sobre = i; });
    el.addEventListener("mouseleave", function(){ if (sobre === i) sobre = -1; });
  });

  /* ============ posición ============
     Del scroll sale un objetivo y lo pintado lo persigue con un amortiguado
     exponencial. */
  var mEntrada = pista.querySelector(".work-pin__mark-in");
  var mFase    = pista.querySelector(".work-pin__mark-fase");
  var hEntrada = 0, hFase = 1;

  function medir(){
    hEntrada = mEntrada.getBoundingClientRect().height;
    hFase    = mFase.getBoundingClientRect().height || 1;
    var thumb = parseFloat(getComputedStyle(pista).getPropertyValue("--work-thumb")) || 110;
    anchoMarco = fotos[0].offsetWidth || 900;
    s0 = tope(thumb / anchoMarco, 0.04, 0.6);
    ant.esc = [-1,-1,-1];
    medirViajes();
  }

  function objetivo(){
    var r = pista.getBoundingClientRect();
    var t = (-r.top - hEntrada) / hFase;
    if (t < 0) t = 0;
    if (t > TMAX) t = TMAX;
    return t;
  }

  var tObj = 0, tAct = 0, corriendo = false, ultimo = 0;
  var CONST = 110;

  function bucle(ahora){
    var dt = ultimo ? Math.min(ahora - ultimo, 100) : 16;
    ultimo = ahora;
    var alfa = 1 - Math.exp(-dt / CONST);
    tAct += (tObj - tAct) * alfa;
    if (Math.abs(tObj - tAct) < 0.0006){
      tAct = tObj; pintar(tAct);
      corriendo = false; ultimo = 0;
      return;
    }
    pintar(tAct);
    requestAnimationFrame(bucle);
  }
  function arrancarBucle(){
    if (corriendo) return;
    corriendo = true; ultimo = 0;
    requestAnimationFrame(bucle);
  }

  var pendiente = false;
  function alScroll(){
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function(){
      pendiente = false;
      var r = pista.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) arrancado = true;
      tObj = objetivo();
      arrancarBucle();
    });
  }

  function recolocar(){
    medir(); tObj = objetivo(); tAct = tObj; ant.p = -1; pintar(tAct);
  }

  window.addEventListener("scroll", alScroll, { passive:true });
  window.addEventListener("resize", recolocar);
  window.addEventListener("load", recolocar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recolocar);

  medir();
  tObj = objetivo(); tAct = tObj;
  pintar(tAct);
  alScroll();
})();
