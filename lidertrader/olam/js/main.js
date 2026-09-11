/* ============================================================
   KRIPTO OLAMI — ishga tushirish
   ============================================================ */
(function () {
  "use strict";
  function boot() {
    /* FontAwesome yuklanganini tekshirish (yuklanmasa — emoji rejimi) */
    LT.Svg.detectFA();
    setTimeout(function () { LT.Svg.detectFA(); }, 1200);

    LT.Engine.load();
    LT.UI.init();

    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    document.body.classList.remove("loading");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
