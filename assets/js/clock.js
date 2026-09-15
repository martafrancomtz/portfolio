/* ==================================================================
   Reloj de Sevilla + selector de franja horaria (auto / day / twilight / night)
   ================================================================== */
(function () {
  "use strict";

  var ZONA = "Europe/Madrid";

  var elTime = document.getElementById("clockTime");
  var botones = Array.prototype.slice.call(document.querySelectorAll(".tm"));
  if (!elTime || !botones.length) return;

  var modoUsuario = "auto";

  function horaSevilla() {
    var partes = new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short"
    }).formatToParts(new Date());

    var datos = {};
    partes.forEach(function (p) { datos[p.type] = p.value; });
    return { hora: parseInt(datos.hour, 10), texto: datos.hour + ":" + datos.minute + " " + datos.timeZoneName };
  }

  function franjaDe(hora) {
    if (hora >= 7 && hora < 19) return "day";
    if ((hora >= 19 && hora < 22) || (hora >= 5 && hora < 7)) return "twilight";
    return "night";
  }

  function marcarActivo(modo) {
    botones.forEach(function (b) {
      b.classList.toggle("is-on", b.dataset.mode === modo);
    });
  }

  function refrescar() {
    var ahora = horaSevilla();
    elTime.textContent = ahora.texto;
    var franjaActiva = modoUsuario === "auto" ? franjaDe(ahora.hora) : modoUsuario;
    marcarActivo(modoUsuario === "auto" ? "auto" : franjaActiva);
  }

  botones.forEach(function (b) {
    b.addEventListener("click", function () {
      modoUsuario = b.dataset.mode;
      refrescar();
    });
  });

  refrescar();
  setInterval(refrescar, 15000);
})();
