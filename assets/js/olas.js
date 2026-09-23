/* Superficie de agua en hover: al pasar el ratón
   por una imagen-enlace (.media-link: Selected work de la home, galería de
   Work), va soltando gotas por donde pasa y la imagen se ondula como agua.
   Sustituye al zoom de .media-link.

   Un solo lienzo WebGL compartido: se mete en el marco de la imagen que
   tiene el ratón (el padre de la <img>, que la recorta) y se quita cuando
   las ondas se apagan (los navegadores limitan cuántos WebGL pueden
   convivir, así que uno por foto no vale). El lienzo copia la foto tal y
   como se ve en ese momento dentro del marco (object-fit, object-position,
   parallax de Selected work), así que el encuadre no cambia.
   Sin WebGL, sin ratón o con movimiento reducido no se monta nada y queda
   el zoom de siempre (la clase .has-olas en <html> es la que lo quita). */
(() => {
  'use strict';

  if (!matchMedia('(pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const marcos = [...new Set([...document.querySelectorAll('.media-link img')].map((img) => img.parentElement))];
  if (!marcos.length) return;

  /* ================== AJUSTES (los de la referencia) ================== */
  const AJUSTES = {
    velocidad:  0.45,  // a qué velocidad se expande cada anillo
    frecuencia: 85,    // cuántos rizos lleva cada anillo
    grosor:     45,    // lo estrecho que es el anillo: más alto, más fino
    desvanece:  1.2,   // en cuánto se apaga cada onda con la edad
    amplitud:   0.03,  // cuánto desplaza la imagen
    vaiven:     0.12,  // ondulación de fondo, como agua en calma
    cada:       70     // ms entre gota y gota mientras se mueve el ratón
  };
  const GOTAS = 12;    // cuántas ondas pueden convivir en la superficie
  const VIDA = 3;      // segundos que dura una gota antes de olvidarla
  const DPR = Math.min(2, devicePixelRatio || 1);

  const VERTEX = `
attribute vec2 punto;
varying vec2 uv;
void main() { uv = punto * 0.5 + 0.5; gl_Position = vec4(punto, 0.0, 1.0); }`;

  // Cada gota es un anillo de ondas que se expande desde donde estaba el
  // ratón; sumando todas sale la superficie del agua.
  const FRAGMENT = `
precision highp float;
varying vec2 uv;
uniform sampler2D imagen;
uniform vec3 gotas[${GOTAS}];   // x, y y edad en segundos (edad < 0 = hueco libre)
uniform float aspecto, tiempo, abre;
uniform float velocidad, frecuencia, grosor, desvanece, amplitud, vaiven;

void main() {
  vec2 escala = vec2(aspecto, 1.0);   // para que los anillos salgan redondos
  vec2 p = uv * escala;
  vec2 desvio = vec2(0.0);

  for (int i = 0; i < ${GOTAS}; i++) {
    vec3 gota = gotas[i];
    vec2 hacia = p - gota.xy * escala;
    float radio = length(hacia) + 0.0001;
    float frente = radio - gota.z * velocidad;
    float onda = sin(frente * frecuencia)
               * exp(-frente * frente * grosor)
               * exp(-gota.z * desvanece);
    desvio += hacia / radio * onda * step(0.0, gota.z);
  }

  desvio += vec2(sin(p.y * 9.0 + tiempo * 1.1), cos(p.x * 11.0 + tiempo * 0.9)) * vaiven;

  vec2 punto = uv + desvio * amplitud * abre / escala;
  gl_FragColor = texture2D(imagen, clamp(punto, 0.0, 1.0));
}`;

  /* ================== WEBGL ================== */
  const lienzo = document.createElement('canvas');
  lienzo.className = 'olas';
  lienzo.setAttribute('aria-hidden', 'true');
  const gl = lienzo.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return;

  const programa = gl.createProgram();
  for (const [tipo, codigo] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
    const shader = gl.createShader(tipo);
    gl.shaderSource(shader, codigo);
    gl.compileShader(shader);
    gl.attachShader(programa, shader);
  }
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return;
  gl.useProgram(programa);

  // un triángulo que tapa todo el lienzo
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPunto = gl.getAttribLocation(programa, 'punto');
  gl.enableVertexAttribArray(aPunto);
  gl.vertexAttribPointer(aPunto, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const sitio = (nombre) => gl.getUniformLocation(programa, nombre);
  const uGotas = sitio('gotas[0]');
  const uTiempo = sitio('tiempo');
  const uAbre = sitio('abre');
  const uAspecto = sitio('aspecto');
  for (const nombre of ['velocidad', 'frecuencia', 'grosor', 'desvanece', 'amplitud', 'vaiven']) {
    gl.uniform1f(sitio(nombre), AJUSTES[nombre]);
  }

  document.documentElement.classList.add('has-olas');   // quita el zoom (styles.css)

  function desactivar() {
    document.documentElement.classList.remove('has-olas');
    lienzo.remove();
    activo = null;
  }

  // La foto, reducida a más o menos su tamaño en pantalla (así no salen
  // dientes de sierra ni se redibuja cada vez una foto de 4000px)
  function reducida(img, escala) {
    const k = Math.min(1, escala * DPR * 1.25);
    const ancho = Math.max(1, Math.round(img.naturalWidth * k));
    const alto = Math.max(1, Math.round(img.naturalHeight * k));
    if (!img._olas || img._olas.width !== ancho || img._olas.height !== alto) {
      const c = document.createElement('canvas');
      c.width = ancho;
      c.height = alto;
      c.getContext('2d').drawImage(img, 0, 0, ancho, alto);
      img._olas = c;
    }
    return img._olas;
  }

  // object-position a fracción (0..1) del hueco que sobra; admite % y px
  function posicion(valor, sobra) {
    const n = parseFloat(valor) || 0;
    if (valor.endsWith('%')) return n / 100;
    return sobra ? n / sobra : 0;
  }

  // Dibuja en "copia" (del tamaño del lienzo) la foto tal y como se ve dentro
  // del marco: su caja real (con transform/parallax) y el object-fit cover
  const copia = document.createElement('canvas');
  const ctx = copia.getContext('2d');
  let geometria = '';

  function copiar(marco, img) {
    const fr = marco.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(ir.width / iw, ir.height / ih);            // cover
    const dw = iw * s, dh = ih * s;
    const [px = '50%', py = px] = getComputedStyle(img).objectPosition.split(' ');
    const x = ir.left - fr.left + (ir.width - dw) * posicion(px, ir.width - dw);
    const y = ir.top - fr.top + (ir.height - dh) * posicion(py, ir.height - dh);

    const clave = [lienzo.width, lienzo.height, x, y, dw, dh].map(Math.round).join();
    if (clave === geometria) return false;        // se ve igual que antes
    geometria = clave;

    copia.width = lienzo.width;
    copia.height = lienzo.height;
    ctx.fillStyle = getComputedStyle(marco).backgroundColor;
    ctx.fillRect(0, 0, copia.width, copia.height);
    ctx.drawImage(reducida(img, s), x * DPR, y * DPR, dw * DPR, dh * DPR);
    return true;
  }

  // sube la copia a la textura; false si el navegador no deja leer la foto
  function subir(marco) {
    const img = marco.querySelector('img');
    if (!copiar(marco, img)) return true;
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, copia);
    } catch (e) {
      desactivar();          // p. ej. abierto como file://: la foto no se puede leer
      return false;
    }
    return true;
  }

  /* ================== ESTADO ================== */
  const gotas = new Float32Array(GOTAS * 3).fill(-1);
  const nacimiento = new Float32Array(GOTAS).fill(-Infinity);
  let activo = null, siguiente = 0, ultima = 0, apertura = 0;
  let dentro = false, animando = false;

  function pintar(segundos) {
    gl.uniform3fv(uGotas, gotas);
    gl.uniform1f(uTiempo, segundos);
    gl.uniform1f(uAbre, apertura);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Mete el lienzo en el marco con su foto. Devuelve false si no se puede.
  function montar(marco) {
    const img = marco.querySelector('img');
    if (!img || !img.complete || !img.naturalWidth) return false;

    const caja = marco.getBoundingClientRect();
    if (!caja.width || !caja.height) return false;
    const ancho = Math.round(caja.width * DPR);
    const alto = Math.round(caja.height * DPR);

    lienzo.width = ancho;
    lienzo.height = alto;
    geometria = '';
    if (!subir(marco)) return false;
    gl.viewport(0, 0, ancho, alto);
    gl.uniform1f(uAspecto, caja.width / caja.height);

    gotas.fill(-1);
    nacimiento.fill(-Infinity);
    apertura = 0;
    pintar(performance.now() / 1000);   // primer fotograma ya pintado: sin parpadeo
    marco.append(lienzo);
    activo = marco;
    return true;
  }

  function fotograma(ahora) {
    const segundos = ahora / 1000;
    apertura += ((dentro ? 1 : 0) - apertura) * 0.12;

    for (let i = 0; i < GOTAS; i++) {
      const edad = segundos - nacimiento[i];
      gotas[i * 3 + 2] = edad < VIDA ? edad : -1;
    }
    pintar(segundos);

    // las ondas van multiplicadas por la apertura: al salir se apagan con ella
    animando = dentro || apertura > 0.004;
    if (animando) {
      requestAnimationFrame(fotograma);
    } else {
      lienzo.remove();       // debajo está la foto tal cual
      activo = null;
    }
  }

  function animar() {
    if (!animando) { animando = true; requestAnimationFrame(fotograma); }
  }

  function soltarGota(e, marco) {
    const ahora = performance.now();
    if (ahora - ultima < AJUSTES.cada) return;
    ultima = ahora;
    const caja = marco.getBoundingClientRect();
    gotas[siguiente * 3] = (e.clientX - caja.left) / caja.width;
    gotas[siguiente * 3 + 1] = 1 - (e.clientY - caja.top) / caja.height;  // la textura va al revés
    nacimiento[siguiente] = ahora / 1000;
    siguiente = (siguiente + 1) % GOTAS;
    animar();
  }

  marcos.forEach((marco) => {
    function entrar(e) {
      if (activo !== marco && !montar(marco)) return false;
      dentro = true;
      ultima = 0;
      soltarGota(e, marco);
      return true;
    }
    marco.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || entrar(e)) return;
      // la foto es lazy: si aún no ha cargado, se monta en cuanto cargue
      // (si el ratón sigue encima)
      const img = marco.querySelector('img');
      if (img && !img.complete) {
        img.addEventListener('load', () => { if (marco.matches(':hover')) entrar(e); }, { once: true });
      }
    });
    marco.addEventListener('pointermove', (e) => {
      if (activo === marco) soltarGota(e, marco);
    });
    marco.addEventListener('pointerleave', () => {
      if (activo !== marco) return;
      dentro = false;
      animar();
    });
  });

  // Con scroll la foto puede moverse dentro del marco (parallax de Selected
  // work): mientras hay ondas, la copia se rehace si ha cambiado lo que se ve.
  // Si cambia el tamaño del marco, se monta de nuevo.
  let pendiente = false;
  function seguir() {
    if (!activo || pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      if (!activo) return;
      const caja = activo.getBoundingClientRect();
      if (Math.round(caja.width * DPR) !== lienzo.width || Math.round(caja.height * DPR) !== lienzo.height) {
        const marco = activo;
        activo = null;
        if (!montar(marco)) lienzo.remove();
        else dentro = marco.matches(':hover');
      } else {
        subir(activo);
      }
    });
  }
  addEventListener('scroll', seguir, { passive: true });
  addEventListener('resize', seguir);
})();
