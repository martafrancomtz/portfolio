/* ==================================================================
   HERO: fondo "Grainient" (shader WebGL),
   desenfoque del título letra a letra siguiendo el cursor, y el
   cursor global creciendo sobre el título.
   Tamaño/posición/color del resto del hero: intactos (Figma).
   ================================================================== */
(function () {
  "use strict";

  var hero = document.getElementById("top");
  if (!hero) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  /* ============================================================
     1) TÍTULO LETRA A LETRA: desenfoque que sigue al cursor
     ============================================================ */
  var titleEl = document.getElementById("heroTitle");
  var chars = titleEl
    ? Array.prototype.slice.call(titleEl.querySelectorAll(".ch")).map(function (el) {
        return { el: el, x: 0, y: 0, v: 0, last: -1 };
      })
    : [];

  var RX = 240, RY = 150, MAXBLUR = 9, LIFT = 4;

  /* getBoundingClientRect() de un <g> enmascarado devuelve el rectángulo
     de la imagen SIN recortar (el mask no achica la geometría, solo lo
     que se pinta): por eso medimos el <path> de la máscara de cada letra
     y lo pasamos a coordenadas de pantalla con getScreenCTM(). */
  function measureChars() {
    if (!chars.length || !titleEl) return;
    for (var k = 0; k < chars.length; k++) chars[k].el.style.transform = "";
    var ctm = titleEl.getScreenCTM();
    if (!ctm) return;
    var pt = titleEl.createSVGPoint();
    var wSum = 0, lineH = 100;
    for (var i = 0; i < chars.length; i++) {
      var pathEl = titleEl.querySelector("#mk" + i + " path");
      var bbox = pathEl.getBBox();
      pt.x = bbox.x + bbox.width / 2;
      pt.y = bbox.y + bbox.height / 2;
      var screenPt = pt.matrixTransform(ctm);
      chars[i].x = screenPt.x;
      chars[i].y = screenPt.y;
      chars[i].last = -1;
      var screenW = bbox.width * ctm.a;
      wSum += screenW;
      if (i === 0) lineH = bbox.height * ctm.d;
    }
    var avgW = wSum / Math.max(chars.length, 1);
    RX = Math.max(avgW * 2.15, 90);
    RY = Math.max(lineH * 1.35, 70);
    MAXBLUR = Math.min(Math.max(lineH * 0.09, 3.5), 12);
    LIFT = Math.min(Math.max(lineH * 0.04, 2), 7);
  }

  measureChars();
  window.addEventListener("load", measureChars);
  setTimeout(measureChars, 1700);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(measureChars, 60); }).catch(function () {});
  }

  function updateChars(kBlur) {
    var activo = fine && pointerInside;
    for (var i = 0; i < chars.length; i++) {
      var s = chars[i], objetivo = 0;
      if (activo) {
        var dx = (cx - s.x) / RX, dy = (cy - s.y) / RY;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) objetivo = 0.5 + 0.5 * Math.cos(d * Math.PI);
      }
      if (reduced) s.v = objetivo;
      else s.v += (objetivo - s.v) * kBlur;
      if (s.v < 0.004) s.v = 0;

      var cambia = s.v === 0 ? s.last !== 0 : Math.abs(s.v - s.last) > 0.004;
      if (!cambia) continue;
      s.last = s.v;

      if (s.v === 0) {
        s.el.style.filter = ""; s.el.style.opacity = ""; s.el.style.transform = "";
      } else {
        s.el.style.filter = "blur(" + (MAXBLUR * s.v).toFixed(2) + "px)";
        s.el.style.opacity = (1 - 0.16 * s.v).toFixed(3);
        s.el.style.transform = "translateY(" + (-LIFT * s.v).toFixed(2) + "px)";
      }
    }
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
    if (cursorGlobal && titleEl) {
      titleEl.addEventListener("mouseenter", function () { cursorGlobal.classList.add("is-grow"); });
      titleEl.addEventListener("mouseleave", function () { cursorGlobal.classList.remove("is-grow"); });
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
    twilight: { c1: "#FFE0CB", c2: "#F5430A", c3: "#FF8FA8", balance: 0.05, contrast: 1.55, grain: 0.10, noche: 0.0 },
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

    updateChars(suave(dt, 0.10));
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
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  window.addEventListener("resize", function () {
    measureChars();
    if (usaGL) resizeGL();
  }, { passive: true });
})();
