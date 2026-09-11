/* LiderTrader — kichik interaktiv qismlar */
(function () {
  "use strict";

  // Mobil menyu
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Joriy sahifani navigatsiyada belgilash
  var path = location.pathname.split("/").pop() || "index.html";
  Array.prototype.forEach.call(document.querySelectorAll(".nav-links a[href]"), function (a) {
    if (a.getAttribute("href") === path) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  // Joriy yil
  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // Ro'yxatdan o'tish formasi (statik sayt — backend yo'q, Telegramga yo'naltiradi)
  var form = document.querySelector("[data-signup-form]");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (form.elements.name.value || "").trim();
      var contact = (form.elements.contact.value || "").trim();
      var course = form.elements.course.value;

      if (name.length < 2 || contact.length < 5) {
        status.textContent = "Iltimos, ism va aloqa ma'lumotini to'liq kiriting.";
        status.className = "form-status err";
        return;
      }

      var text =
        "LiderTrader — ro'yxatdan o'tish\n" +
        "Ism: " + name + "\n" +
        "Aloqa: " + contact + "\n" +
        "Kurs: " + course;

      status.textContent = "Rahmat, " + name + "! Xabaringiz tayyor — Telegram oynasida yuborishni tasdiqlang.";
      status.className = "form-status ok";
      window.open("https://t.me/lidertrader?text=" + encodeURIComponent(text), "_blank", "noopener");
      form.reset();
    });
  }
})();
