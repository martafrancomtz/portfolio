/* ==================================================================
   HERO: fondo "Grainient" (shader WebGL),
   título con efecto "melting blur" alrededor del cursor, y el
   cursor global creciendo sobre el título.
   Tamaño/posición del resto del hero: Figma; el color de todo el
   texto es inversión (mix-blend-mode, en styles.css).
   ================================================================== */
(function () {
  "use strict";

  var hero = document.getElementById("top");
  if (!hero) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  /* ============================================================
     1) TÍTULO: "melting blur" (WebGL): alrededor del cursor las
     letras se desenfocan y se derriten hacia abajo, con inercia.
     Las letras salen de los <path> de las máscaras del SVG, que
     queda debajo para el tamaño, la accesibilidad y como reserva.
     ============================================================ */
  var titleEl = document.getElementById("heroTitle");
  var titleWrap = document.getElementById("heroTitleWrap");
  var tCanvas = document.getElementById("heroTitleGL");

  /* Efecto y valores (la "marca
     fundida"): el cursor abre un charco de desenfoque a su alrededor y, al
     moverse, arrastra la tinta tras él; se derrite mientras te mueves y se
     rehace al parar. Las medidas en px son las de la referencia, donde la
     marca medía 594px de ancho: aquí se escalan con el ancho del título. */
  var MELT = {
    radius: 230,    // hasta dónde llega el charco
    spread: 58,     // cuánto se abre el desenfoque
    drag: 2.3,      // cuánto arrastra la tinta al moverse
    melt: 0.7,      // cuánto tira hacia abajo (goteo)
    inertia: 0.11,  // lo que el charco se acerca al ratón por fotograma (60 fps)
    samples: 20,    // pases del desenfoque (calidad)
    refWidth: 594   // ancho de la marca en la referencia
  };

  var MELT_FRAG = [
    "precision highp float;",
    "uniform sampler2D uTex;",
    "uniform vec2  uRes;",      // tamaño del canvas en px css
    "uniform float uDpr;",
    "uniform vec2  uPtr;",      // dónde está el charco
    "uniform vec2  uDrag;",     // cuánto se arrastra la tinta, en px css
    "uniform float uRadius;",
    "uniform float uSpread;",
    "uniform float uMelt;",
    "uniform float uOn;",       // 0..1
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.7))) * 43758.5453); }",
    "void main(){",
    "  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;",
    "  float d = distance(px, uPtr);",
    "  float f = 1.0 - smoothstep(uRadius * 0.12, uRadius, d);",
    "  f = pow(f, 1.3) * uOn;",
    "  if (f < 0.004){ gl_FragColor = vec4(texture2D(uTex, px / uRes).a); return; }",
    "  vec2 radial = d > 0.001 ? (px - uPtr) / d : vec2(0.0);",
    "  float sag = pow(f, 1.6);",
    /* primero se desplaza la tinta, después se desenfoca alrededor */
    "  vec2 base = uDrag * 0.6 * f + vec2(0.0, 1.0) * uSpread * uMelt * sag;",
    "  vec2 span = uDrag * 0.9 * f + radial * uSpread * f;",
    "  float jit = hash(px + uDrag);",
    "  float acc = 0.0, wsum = 0.0;",
    "  for (int i = 0; i < " + MELT.samples + "; i++){",
    "    float t = (float(i) + jit) / " + MELT.samples + ".0;",
    "    vec2 off = base + span * (t - 0.5);",
    "    float w = 1.0 - 0.55 * abs(t - 0.5) * 2.0;",
    "    acc += texture2D(uTex, (px - off) / uRes).a * w;",
    "    wsum += w;",
    "  }",
    "  gl_FragColor = vec4(acc / wsum);",   /* tinta blanca, alfa premultiplicado */
    "}"
  ].join("\n");

  var melt = null;
  var mx = -1e4, my = -1e4, sx = -1e4, sy = -1e4, mOn = 0, mWant = 0;

  function initMelt() {
    if (!titleEl || !titleWrap || !tCanvas) return null;
    var g = null;
    try { g = tCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }); } catch (e) { g = null; }
    if (!g) return null;
    function sh(type, src) {
      var s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
      return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(g.VERTEX_SHADER, "attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }");
    var fs = sh(g.FRAGMENT_SHADER, MELT_FRAG);
    if (!vs || !fs) return null;
    var p = g.createProgram();
    g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;
    g.useProgram(p);
    var b = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, b);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    var loc = g.getAttribLocation(p, "position");
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    var tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    var u = {};
    ["uTex", "uRes", "uDpr", "uPtr", "uDrag", "uRadius", "uSpread", "uMelt", "uOn"].forEach(function (n) { u[n] = g.getUniformLocation(p, n); });
    g.uniform1i(u.uTex, 0);
    g.clearColor(0, 0, 0, 0);
    return { gl: g, u: u, scale: 1, paths: Array.prototype.map.call(titleEl.querySelectorAll("mask path"), function (el) { return new Path2D(el.getAttribute("d")); }) };
  }

  /* coloca el canvas sobre el título (con aire alrededor para lo que se
     derrite y se arrastra) y pinta las letras en blanco en una textura */
  function layoutMelt() {
    if (!melt) return;
    var r = titleEl.getBoundingClientRect();
    if (!r.width) return;
    var sc = r.width / MELT.refWidth;
    var M = Math.round(MELT.spread * sc * 2.5);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = r.width + M * 2, ch = r.height + M * 2;
    tCanvas.style.left = -M + "px"; tCanvas.style.top = -M + "px";
    tCanvas.style.width = cw + "px"; tCanvas.style.height = ch + "px";
    tCanvas.width = Math.round(cw * dpr); tCanvas.height = Math.round(ch * dpr);
    melt.scale = sc;

    var off = document.createElement("canvas");
    off.width = tCanvas.width; off.height = tCanvas.height;
    var c = off.getContext("2d");
    var s = (r.width / 678.9) * dpr;
    c.setTransform(s, 0, 0, s, M * dpr, M * dpr);
    c.fillStyle = "#fff";
    melt.paths.forEach(function (path) { c.fill(path); });

    var g = melt.gl;
    g.viewport(0, 0, tCanvas.width, tCanvas.height);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, off);
    g.uniform2f(melt.u.uRes, cw, ch);
    g.uniform1f(melt.u.uDpr, tCanvas.width / cw);
    g.uniform1f(melt.u.uRadius, MELT.radius * sc);
    g.uniform1f(melt.u.uSpread, MELT.spread * sc);
    g.uniform1f(melt.u.uMelt, MELT.melt);
    drawMelt(0, 0);
  }

  function drawMelt(dragX, dragY) {
    var g = melt.gl;
    g.uniform2f(melt.u.uPtr, sx, sy);
    g.uniform2f(melt.u.uDrag, dragX, dragY);
    g.uniform1f(melt.u.uOn, mOn);
    g.clear(g.COLOR_BUFFER_BIT);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  melt = initMelt();
  if (melt) {
    hero.classList.add("is-title-gl");
    layoutMelt();
    window.addEventListener("load", layoutMelt);
  }

  /* el charco va con retraso respecto al ratón, y ese retraso es el arrastre */
  function updateMelt(dt) {
    if (!melt) return;
    var r = tCanvas.getBoundingClientRect();
    mx = tx - r.left; my = ty - r.top;
    var dentro = fine && !reduced && pointerInside &&
      mx >= 0 && my >= 0 && mx <= r.width && my <= r.height;
    if (dentro && mWant === 0) { sx = mx; sy = my; }
    mWant = dentro ? 1 : 0;

    var k = 1 - Math.pow(1 - MELT.inertia, dt * 60);
    sx += (mx - sx) * k; sy += (my - sy) * k;
    var antes = mOn;
    mOn += (mWant - mOn) * (1 - Math.exp(-dt / 0.16));
    if (mOn < 0.002) mOn = 0;
    if (mOn === 0 && antes === 0) return;   // quieto y fuera: no se repinta

    var gain = MELT.drag;
    drawMelt((mx - sx) * gain, (my - sy) * gain);
  }

  /* ============================================================
     2) CURSOR: reutiliza el círculo global (main.js); solo
     añadimos que crezca sobre el título, como en el prototipo
     ============================================================ */
  var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  var tx = cx, ty = cy, pointerInside = false;

  if (fine) {
    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      pointerInside = true;
    }, { passive: true });
    document.addEventListener("mouseleave", function () { pointerInside = false; });

    var cursorGlobal = document.getElementById("cursor");
    if (cursorGlobal && titleWrap) {
      titleWrap.addEventListener("mouseenter", function () { cursorGlobal.classList.add("is-grow"); });
      titleWrap.addEventListener("mouseleave", function () { cursorGlobal.classList.remove("is-grow"); });
    }
  }

  /* ============================================================
     3) FONDO: shader "Grainient" (mismo shader y paletas que el
     prototipo). Se pinta solo dentro del hero, no a toda página.
     ============================================================ */
  var PARAMS = {
    timeSpeed: 0.25, warpStrength: 1.0, warpFrequency: 5.0, warpSpeed: 2.0,
    warpAmplitude: 50.0, blendAngle: 0.0, blendSoftness: 0.05, rotationAmount: 500.0,
    noiseScale: 2.0, grainScale: 2.0, grainAnimated: 0.0, gamma: 1.0, saturation: 1.0, zoom: 0.9
  };

  /* paletas exactas del prototipo (día azul / atardecer naranja / noche
     azul-negro): "twilight" es el nombre que usan los botones del reloj
     para lo que el prototipo llama "dusk". */
  var PALETAS = {
    day: { c1: "#9BE4CC", c2: "#0057FF", c3: "#6FBCD4", balance: 0.00, contrast: 1.50, grain: 0.10, noche: 0.0 },
    twilight: { c1: "#F8474B", c2: "#FF7743", c3: "#FEC366", balance: 0.05, contrast: 1.55, grain: 0.10, noche: 0.0 },
    night: { c1: "#3E63AE", c2: "#111A34", c3: "#080C18", balance: 0.00, contrast: 1.05, grain: 0.07, noche: 1.0 }
  };

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [1, 1, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  }
  function copiaPaleta(p) {
    return {
      c1: hexToRgb(p.c1), c2: hexToRgb(p.c2), c3: hexToRgb(p.c3),
      balance: p.balance, contrast: p.contrast, grain: p.grain, noche: p.noche
    };
  }

  var canvas = document.getElementById("heroGL");
  var gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" }) ||
      canvas.getContext("experimental-webgl");
  } catch (e) { gl = null; }

  var VERT = ["attribute vec2 position;", "void main(){ gl_Position = vec4(position, 0.0, 1.0); }"].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2  iResolution;",
    "uniform float iTime;",
    "uniform float uTimeSpeed;",
    "uniform float uColorBalance;",
    "uniform float uWarpStrength;",
    "uniform float uWarpFrequency;",
    "uniform float uWarpSpeed;",
    "uniform float uWarpAmplitude;",
    "uniform float uBlendAngle;",
    "uniform float uBlendSoftness;",
    "uniform float uRotationAmount;",
    "uniform float uNoiseScale;",
    "uniform float uGrainAmount;",
    "uniform float uGrainScale;",
    "uniform float uGrainAnimated;",
    "uniform float uContrast;",
    "uniform float uGamma;",
    "uniform float uSaturation;",
    "uniform vec2  uCenterOffset;",
    "uniform float uZoom;",
    "uniform vec3  uColor1;",
    "uniform vec3  uColor2;",
    "uniform vec3  uColor3;",
    "uniform float uNight;",
    "#define S(a,b,t) smoothstep(a,b,t)",
    "mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}",
    "vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);",
    "  float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),",
    "                  dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),",
    "              mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),",
    "                  dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);",
    "  return 0.5+0.5*n;}",
    "float fbmN(vec2 p){float v=0.0,a=0.5;",
    "  for(int i=0;i<3;i++){ v += a*(noise(p)*2.0-1.0); p*=2.03; a*=0.5; }",
    "  return v;}",
    "void main(){",
    "  vec2 C = gl_FragCoord.xy;",
    "  float t = iTime * uTimeSpeed;",
    "  vec2 uv = C / iResolution.xy;",
    "  float ratio = iResolution.x / iResolution.y;",
    "  vec2 tuv = uv - 0.5 + uCenterOffset;",
    "  tuv /= max(uZoom, 0.001);",
    "  float degree = noise(vec2(t*0.1, tuv.x*tuv.y) * uNoiseScale);",
    "  tuv.y *= 1.0/ratio;",
    "  tuv *= Rot(radians((degree-0.5)*uRotationAmount + 180.0));",
    "  tuv.y *= ratio;",
    "  float frequency = uWarpFrequency;",
    "  float ws = max(uWarpStrength, 0.001);",
    "  float amplitude = uWarpAmplitude / ws;",
    "  float warpTime = t * uWarpSpeed;",
    "  tuv.x += sin(tuv.y*frequency + warpTime) / amplitude;",
    "  tuv.y += sin(tuv.x*(frequency*1.5) + warpTime) / (amplitude*0.5);",
    "  vec3 colLav = uColor1;",
    "  vec3 colOrg = uColor2;",
    "  vec3 colDark = uColor3;",
    "  float b = uColorBalance;",
    "  float s = max(uBlendSoftness, 0.0);",
    "  mat2 blendRot = Rot(radians(uBlendAngle));",
    "  float blendX = (tuv*blendRot).x;",
    "  float edge0 = -0.3 - b - s;",
    "  float edge1 =  0.2 - b + s;",
    "  float v0 =  0.5 - b + s;",
    "  float v1 = -0.3 - b - s;",
    "  vec3 layer1 = mix(colDark, colOrg, S(edge0, edge1, blendX));",
    "  vec3 layer2 = mix(colOrg, colLav, S(edge0, edge1, blendX));",
    "  vec3 col = mix(layer1, layer2, S(v0, v1, tuv.y));",
    "  vec2 grainUv = uv * max(uGrainScale, 0.001);",
    "  if (uGrainAnimated > 0.5){ grainUv += vec2(iTime*0.05); }",
    "  float grain = fract(sin(dot(grainUv, vec2(12.9898,78.233))) * 43758.5453);",
    "  col += (grain - 0.5) * uGrainAmount;",
    "  col = (col - 0.5) * uContrast + 0.5;",
    "  float luma = dot(col, vec3(0.2126,0.7152,0.0722));",
    "  col = mix(vec3(luma), col, uSaturation);",
    "  col = pow(max(col, 0.0), vec3(1.0/max(uGamma, 0.001)));",
    "  if (uNight > 0.002){",
    "    vec2 np = vec2(uv.x*ratio, uv.y);",
    "    float nube  = fbmN(np*2.3 - vec2(iTime*0.030, iTime*0.048));",
    "    float flash = pow(max(0.0, sin(iTime*0.21 + nube*3.4)), 30.0);",
    "    col += vec3(0.94,0.90,0.83) * flash * S(0.02,0.55,nube) * 0.24 * uNight;",
    "    float nm = S(0.30, 0.80, fbmN(np*3.0 + vec2(iTime*0.018, -iTime*0.026)));",
    "    vec3 neon = mix(vec3(1.00,0.13,0.50), vec3(0.08,0.92,1.00), S(-0.45,0.45, fbmN(np*1.6 + 7.3)));",
    "    neon = mix(neon, vec3(0.66,0.28,1.00), S(0.35,0.90,nm));",
    "    col += neon * nm * 0.30 * uNight * (0.30 + (1.0-uv.y)*0.80);",
    "  }",
    "  col = clamp(col, 0.0, 1.0);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var prog = null, uni = {}, dpr = 1;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }

  function initGL() {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { return false; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    ["iResolution", "iTime", "uTimeSpeed", "uColorBalance", "uWarpStrength", "uWarpFrequency",
      "uWarpSpeed", "uWarpAmplitude", "uBlendAngle", "uBlendSoftness", "uRotationAmount",
      "uNoiseScale", "uGrainAmount", "uGrainScale", "uGrainAnimated", "uContrast", "uGamma",
      "uSaturation", "uCenterOffset", "uZoom", "uColor1", "uColor2", "uColor3", "uNight"
    ].forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });

    gl.uniform1f(uni.uTimeSpeed, PARAMS.timeSpeed);
    gl.uniform1f(uni.uWarpStrength, PARAMS.warpStrength);
    gl.uniform1f(uni.uWarpFrequency, PARAMS.warpFrequency);
    gl.uniform1f(uni.uWarpSpeed, PARAMS.warpSpeed);
    gl.uniform1f(uni.uWarpAmplitude, PARAMS.warpAmplitude);
    gl.uniform1f(uni.uBlendAngle, PARAMS.blendAngle);
    gl.uniform1f(uni.uBlendSoftness, PARAMS.blendSoftness);
    gl.uniform1f(uni.uRotationAmount, PARAMS.rotationAmount);
    gl.uniform1f(uni.uNoiseScale, PARAMS.noiseScale);
    gl.uniform1f(uni.uGrainScale, PARAMS.grainScale);
    gl.uniform1f(uni.uGrainAnimated, PARAMS.grainAnimated);
    gl.uniform1f(uni.uGamma, PARAMS.gamma);
    gl.uniform1f(uni.uSaturation, PARAMS.saturation);
    gl.uniform1f(uni.uZoom, PARAMS.zoom);
    return true;
  }

  function resizeGL() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(rect.width * dpr);
    var h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var usaGL = false;
  if (gl && initGL()) { usaGL = true; resizeGL(); }
  else { hero.classList.add("is-no-webgl"); }

  /* fondo del menú hamburguesa: copia del degradado (sin WebGL se queda
     la imagen de reserva que pone el CSS) */
  var panelBg = document.getElementById("navPanelBg");
  var panelCtx = usaGL && panelBg ? panelBg.getContext("2d") : null;
  if (panelBg && !panelCtx) panelBg.style.display = "none";

  /* ---- paleta activa, con transición suave, enganchada al reloj ---- */
  var modoActivo = document.documentElement.dataset.franja || "day";
  var actual = copiaPaleta(PALETAS[modoActivo] || PALETAS.day);
  var destino = copiaPaleta(PALETAS[modoActivo] || PALETAS.day);

  function comprobarModo() {
    var m = document.documentElement.dataset.franja;
    if (!m || m === modoActivo || !PALETAS[m]) return;
    modoActivo = m;
    destino = copiaPaleta(PALETAS[m]);
  }

  function lerpArr(a, b, k) { a[0] += (b[0] - a[0]) * k; a[1] += (b[1] - a[1]) * k; a[2] += (b[2] - a[2]) * k; }

  /* ============================================================
     4) BUCLE
     ============================================================ */
  var t0 = null, tPrev = null, reloj = 0;
  function suave(dt, tau) { return 1 - Math.exp(-dt / tau); }
  var DERIVA = 0.075;
  var offX = 0, offY = 0;

  function frame(ts) {
    if (t0 === null) { t0 = ts; tPrev = ts; }
    var dt = Math.min((ts - tPrev) / 1000, 0.12);
    tPrev = ts;
    if (!reduced) reloj = (ts - t0) / 1000;

    updateMelt(dt);
    comprobarModo();

    if (usaGL) {
      resizeGL();

      var rect = hero.getBoundingClientRect();
      var oX = 0, oY = 0;
      if (fine && pointerInside && !reduced && ty >= rect.top && ty <= rect.bottom) {
        oX = ((tx - rect.left) / rect.width - 0.5) * DERIVA;
        oY = (0.5 - (ty - rect.top) / rect.height) * DERIVA;
      }
      var kd = suave(dt, 0.9);
      offX += (oX - offX) * kd;
      offY += (oY - offY) * kd;

      var k = reduced ? 1 : suave(dt, 0.45);
      lerpArr(actual.c1, destino.c1, k);
      lerpArr(actual.c2, destino.c2, k);
      lerpArr(actual.c3, destino.c3, k);
      actual.balance += (destino.balance - actual.balance) * k;
      actual.contrast += (destino.contrast - actual.contrast) * k;
      actual.grain += (destino.grain - actual.grain) * k;
      actual.noche += (destino.noche - actual.noche) * k;

      gl.uniform2f(uni.iResolution, canvas.width, canvas.height);
      gl.uniform1f(uni.iTime, reloj);
      gl.uniform2f(uni.uCenterOffset, offX, offY);
      gl.uniform1f(uni.uColorBalance, actual.balance);
      gl.uniform1f(uni.uContrast, actual.contrast);
      gl.uniform1f(uni.uGrainAmount, actual.grain);
      gl.uniform1f(uni.uNight, actual.noche);
      gl.uniform3fv(uni.uColor1, actual.c1);
      gl.uniform3fv(uni.uColor2, actual.c2);
      gl.uniform3fv(uni.uColor3, actual.c3);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // menú abierto: su fondo es este mismo degradado (se copia en el
      // mismo fotograma, antes de que el navegador limpie el canvas)
      if (panelCtx && document.documentElement.classList.contains("is-menu-open")) {
        if (panelBg.width !== canvas.width || panelBg.height !== canvas.height) {
          panelBg.width = canvas.width; panelBg.height = canvas.height;
        }
        panelCtx.drawImage(canvas, 0, 0);
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  window.addEventListener("resize", function () {
    layoutMelt();
    if (usaGL) resizeGL();
  }, { passive: true });
})();
