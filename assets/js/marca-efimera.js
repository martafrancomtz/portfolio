/* ==================================================================
   MARCA EFÍMERA: el logo del footer. Sin controles: el hueco está vacío
   y el logo solo aparece por donde pasa el ratón (o el dedo); la tinta
   aflora difuminada tras el cursor, aguanta unos segundos y se deshace.
   Valores = los de la referencia. Las medidas en px de la referencia
   (escenario de 760px) se escalan al ancho real del hueco.
   Sin fondo (transparente): solo se ve la tinta, en --text (el negro de
   la web), por donde pasa el ratón. Lo descubre quien pasa por encima.
   ================================================================== */
(function () {
  "use strict";

  var stage = document.getElementById("marcaEfimera");
  if (!stage) return;
  var cv = stage.querySelector("canvas");
  var gl = null;
  try { gl = cv.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
  if (!gl) { stage.classList.add("is-no-webgl"); return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ajustes de la referencia (px sobre un escenario de 760 de ancho) */
  var CFG = { radius: 150, spread: 60, drag: 1.8, melt: 0.55, inertia: 0.13, quality: 20,
              hold: 10, tin: 0.35, tout: 2.5 };
  var REF_W = 760;

  /* el logo (el mismo que en la referencia) */
  var VB = { x: 0, y: 0, w: 176.98, h: 153.21 };
  var shape = new Path2D(
    "M176.98,71.5v10.21c0,4.07-3.3,7.37-7.37,7.37h-33.9c-4.54,0-8.49,3.11-9.55,7.53l-11.8,49.08c-1.06,4.41-5.01,7.53-9.55,7.53h-34.41c-4.54,0-8.49-3.11-9.55-7.53L32.35,27.13c-.31-1.28-1.46-2.19-2.78-2.19h0c-1.58,0-2.86,1.28-2.86,2.86v118.04c0,4.07-3.3,7.37-7.37,7.37H7.37c-4.07,0-7.37-3.3-7.37-7.37V7.37C0,3.3,3.3,0,7.37,0h40.47c3.4,0,6.35,2.32,7.16,5.63l29.29,120.47c.45,1.85,2.11,3.15,4.01,3.15h0c1.9,0,3.56-1.3,4.01-3.14l9.12-37.03,4.76-19.34c.81-3.29,3.76-5.61,7.15-5.61h56.27c4.07,0,7.37,3.3,7.37,7.37Z " +
    "M176.98,7.37v10.21c0,4.07-3.3,7.37-7.37,7.37h-43c-4.78,0-8.29-4.48-7.15-9.13l2.51-10.21c.81-3.29,3.76-5.61,7.15-5.61h40.49c4.07,0,7.37,3.3,7.37,7.37Z " +
    "M155.87 128.27H169.61A7.37 7.37 0 0 1 176.98 135.64V145.84A7.37 7.37 0 0 1 169.61 153.21H155.87A7.37 7.37 0 0 1 148.5 145.84V135.64A7.37 7.37 0 0 1 155.87 128.27Z"
  );

  var root = document.documentElement;
  var W = 0, H = 0, dpr = 1, sc = 1;
  var tinta = [0.2, 0.2, 0.2];

  function leerColores() {
    var c = document.createElement("canvas").getContext("2d");
    c.fillStyle = getComputedStyle(root).getPropertyValue("--text").trim() || "#333";
    var m = /^#([0-9a-f]{6})$/i.exec(c.fillStyle);
    if (m) {
      var n = parseInt(m[1], 16);
      tinta = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
  }

  /* ---------- la marca nítida que el shader difumina (solo su forma:
     transparente fuera, opaca dentro; el color lo pone el shader) ---------- */
  var plate = document.createElement("canvas");
  var pctx = plate.getContext("2d");
  function paintPlate() {
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, plate.width, plate.height);
    var s = Math.min(W / VB.w, H / VB.h) * 0.86 * dpr;
    pctx.setTransform(s, 0, 0, s,
      (plate.width - VB.w * s) / 2 - VB.x * s,
      (plate.height - VB.h * s) / 2 - VB.y * s);
    pctx.fillStyle = "#fff";
    pctx.fill(shape);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- el rastro: por dónde ha aflorado la tinta ---------- */
  var MS = 0.34;
  var inkc = document.createElement("canvas"), ictx = inkc.getContext("2d");
  var softc = document.createElement("canvas"), sctx = softc.getContext("2d");
  var trail = [];

  function radius() { return CFG.radius * sc; }

  function addTrail(x, y, now) {
    var last = trail[trail.length - 1];
    var step = Math.max(4, radius() * 0.22);
    if (!last) { trail.push({ x: x, y: y, t: now }); return; }
    var dx = x - last.x, dy = y - last.y, L = Math.hypot(dx, dy);
    if (L < step) return;
    var n = Math.min(26, Math.max(1, Math.round(L / step)));
    for (var k = 1; k <= n; k++) trail.push({ x: last.x + dx * k / n, y: last.y + dy * k / n, t: now });
    if (trail.length > 1100) trail.splice(0, trail.length - 1100);
  }

  // lo presente que está una marca: aflora, aguanta y se deshace
  function strength(p, now) {
    var age = (now - p.t) / 1000;
    var a = age < CFG.tin ? age / CFG.tin : 1;
    if (age > CFG.hold) a *= Math.max(0, 1 - (age - CFG.hold) / CFG.tout);
    return a;
  }

  function paintMask(now) {
    var w = inkc.width, h = inkc.height;
    var life = CFG.hold + CFG.tout;
    while (trail.length && (now - trail[0].t) / 1000 > life) trail.shift();

    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.fillStyle = "#000";
    ictx.fillRect(0, 0, w, h);
    ictx.strokeStyle = "#fff";
    ictx.lineCap = "round";
    ictx.lineJoin = "round";
    ictx.lineWidth = Math.max(2, radius() * MS * 1.1);

    var BK = 12;
    var band = function (p) { return Math.round(strength(p, now) * BK) / BK; };
    var i = 0;
    while (i < trail.length) {
      var a = band(trail[i]);
      var j = i;
      while (j + 1 < trail.length && band(trail[j + 1]) === a) j++;
      if (a > 0.02) {
        ictx.globalAlpha = a;
        ictx.beginPath();
        ictx.moveTo(trail[i].x * MS, trail[i].y * MS);
        for (var k = i + 1; k <= j; k++) ictx.lineTo(trail[k].x * MS, trail[k].y * MS);
        var nxt = trail[j + 1];
        if (nxt) ictx.lineTo(nxt.x * MS, nxt.y * MS);
        else if (i === j) ictx.lineTo(trail[i].x * MS + 0.01, trail[i].y * MS);
        ictx.stroke();
      }
      i = j + 1;
    }
    ictx.globalAlpha = 1;

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.filter = "none";
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, w, h);
    sctx.filter = "blur(" + Math.max(1, radius() * MS * 0.32).toFixed(1) + "px)";
    sctx.drawImage(inkc, 0, 0);
    sctx.filter = "none";
  }

  /* ---------- webgl (shader de la referencia) ---------- */
  var VERT =
    "attribute vec2 aPos; varying vec2 vUv;" +
    "void main(){ vUv = vec2((aPos.x + 1.0) * 0.5, 1.0 - (aPos.y + 1.0) * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }";

  var N = CFG.quality;
  var FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D uTex;",
    "uniform sampler2D uMask;",
    "uniform vec2 uRes;",
    "uniform vec2 uPtr;",
    "uniform vec2 uDrag;",
    "uniform float uRadius;",
    "uniform float uSpread;",
    "uniform float uMelt;",
    "uniform float uOn;",
    "uniform vec3 uInk;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.7))) * 43758.5453); }",
    "void main(){",
    "  float m = texture2D(uMask, vUv).r;",
    "  if (m < 0.004){ gl_FragColor = vec4(0.0); return; }",
    "  vec2 px = vUv * uRes;",
    "  float d = distance(px, uPtr);",
    "  float f = pow(1.0 - smoothstep(uRadius * 0.12, uRadius, d), 1.3) * uOn;",
    "  vec2 rl = d > 0.001 ? (px - uPtr) / d : vec2(0.0);",
    "  vec2 c = px - uRes * 0.5;",
    "  float lc = length(c);",
    "  vec2 og = lc > 0.001 ? c / lc : vec2(0.0);",
    /* la tinta nunca es nítida: brumosa en el centro del rastro y casi
       deshecha en sus bordes */
    "  float haze = 0.42 + 1.3 * (1.0 - m);",
    "  float sag = pow(f, 1.6);",
    "  vec2 base = uDrag * 0.55 * f + vec2(0.0, 1.0) * uSpread * uMelt * (sag + 0.4 * haze);",
    "  vec2 span = uDrag * 0.85 * f + rl * uSpread * f + og * uSpread * haze;",
    "  float jit = hash(px + uDrag);",
    "  float acc = 0.0;",
    "  float wsum = 0.0;",
    "  for (int i = 0; i < " + N + "; i++){",
    "    float t = (float(i) + jit) / " + N + ".0;",
    "    vec2 off = base + span * (t - 0.5);",
    "    float w = 1.0 - 0.55 * abs(t - 0.5) * 2.0;",
    "    acc += texture2D(uTex, (px - off) / uRes).a * w;",
    "    wsum += w;",
    "  }",
    "  float a = (acc / wsum) * m;",
    "  gl_FragColor = vec4(uInk * a, a);",   /* tinta sin fondo (alfa premultiplicado) */
    "}"
  ].join("\n");

  function compile(src, type) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  }
  var vs = compile(VERT, gl.VERTEX_SHADER), fs = compile(FRAG, gl.FRAGMENT_SHADER);
  if (!vs || !fs) { stage.classList.add("is-no-webgl"); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { stage.classList.add("is-no-webgl"); return; }
  gl.useProgram(prog);

  var loc = {};
  ["uTex", "uMask", "uRes", "uPtr", "uDrag", "uRadius", "uSpread", "uMelt", "uOn", "uInk"].forEach(function (u) {
    loc[u] = gl.getUniformLocation(prog, u);
  });
  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(loc.uTex, 0);
  gl.uniform1i(loc.uMask, 1);

  function makeTex() {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  var texPlate = makeTex(), texMask = makeTex();

  function uploadPlate() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texPlate);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
  }
  function uploadMask() {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, softc);
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    sc = W / REF_W;
    cv.width = plate.width = Math.round(W * dpr);
    cv.height = plate.height = Math.round(H * dpr);
    inkc.width = softc.width = Math.max(2, Math.round(W * MS));
    inkc.height = softc.height = Math.max(2, Math.round(H * MS));
    leerColores();
    paintPlate(); uploadPlate();
    gl.viewport(0, 0, cv.width, cv.height);
    arrancar();
  }

  /* ---------- puntero ---------- */
  var mx = -1e4, my = -1e4, sx = -1e4, sy = -1e4, on = 0, want = 0;

  stage.addEventListener("pointermove", function (e) {
    var r = stage.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    if (want === 0) { sx = mx; sy = my; }
    want = 1;
    addTrail(mx, my, performance.now());
    arrancar();
  });
  stage.addEventListener("pointerdown", function (e) {
    stage.dispatchEvent(new PointerEvent("pointermove", e));
  });
  stage.addEventListener("pointerleave", function () { want = 0; });
  window.addEventListener("resize", resize);
  // si cambian los colores de la web (fondo oscuro de What I do), se repinta
  new MutationObserver(function () { resize(); }).observe(root, { attributes: true, attributeFilter: ["class"] });

  /* solo se anima mientras hay tinta o ratón encima; si no, se queda quieto */
  var prev = 0, corriendo = false;
  function arrancar() {
    if (corriendo) return;
    corriendo = true; prev = 0;
    requestAnimationFrame(frame);
  }
  function frame(now) {
    var dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0.016;
    prev = now;
    var k = 1 - Math.pow(1 - (reduced.matches ? 0.5 : CFG.inertia), dt * 60);
    sx += (mx - sx) * k; sy += (my - sy) * k;
    on += (want - on) * (1 - Math.exp(-dt / 0.16));

    paintMask(now);
    uploadMask();

    var gain = reduced.matches ? 0 : CFG.drag;
    gl.uniform2f(loc.uRes, W, H);
    gl.uniform2f(loc.uPtr, sx, sy);
    gl.uniform2f(loc.uDrag, (mx - sx) * gain, (my - sy) * gain);
    gl.uniform1f(loc.uRadius, radius());
    gl.uniform1f(loc.uSpread, CFG.spread * sc);
    gl.uniform1f(loc.uMelt, CFG.melt);
    gl.uniform1f(loc.uOn, on);
    gl.uniform3f(loc.uInk, tinta[0], tinta[1], tinta[2]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (trail.length || want || on > 0.001) requestAnimationFrame(frame);
    else corriendo = false;
  }

  resize();
})();
