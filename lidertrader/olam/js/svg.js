/* ============================================================
   KRIPTO OLAMI — grafika: ikonalar va bino generatori
   Ikonalar: FontAwesome (CDN). Internet bo'lmasa — emoji rejimi.
   Binolar: to'liq o'z SVG grafikamiz (hech qanday bog'liqlik yo'q).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Ikona jadvali: FA klass + emoji zaxira ---------- */
  var ICONS = {
    school:    ["fa-solid fa-graduation-cap", "🎓"],
    contract:  ["fa-solid fa-file-contract", "📜"],
    market:    ["fa-solid fa-store", "🏪"],
    factory:   ["fa-solid fa-industry", "🏭"],
    gallery:   ["fa-solid fa-image", "🖼️"],
    stake:     ["fa-solid fa-coins", "🪙"],
    bridge:    ["fa-solid fa-bridge", "🌉"],
    bank:      ["fa-solid fa-building-columns", "🏛️"],
    warning:   ["fa-solid fa-triangle-exclamation", "⚠️"],
    fuel:      ["fa-solid fa-gas-pump", "⛽"],
    layers:    ["fa-solid fa-layer-group", "🧱"],
    gate:      ["fa-solid fa-torii-gate", "🚧"],
    key:       ["fa-solid fa-key", "🔑"],
    coin:      ["fa-solid fa-circle-dollar-to-slot", "🪙"],
    app:       ["fa-solid fa-mobile-screen-button", "📱"],
    pickaxe:   ["fa-solid fa-gem", "⛏️"],
    vault:     ["fa-solid fa-vault", "🏦"],
    mail:      ["fa-solid fa-envelope", "✉️"],
    shieldlock:["fa-solid fa-user-secret", "🕵️"],
    mask:      ["fa-solid fa-mask", "🎭"],
    eye:       ["fa-solid fa-eye", "👁️"],
    speed:     ["fa-solid fa-gauge-high", "⚡"],
    museum:    ["fa-solid fa-landmark-dome", "🏛️"],
    shield:    ["fa-solid fa-shield-halved", "🛡️"],
    star:      ["fa-solid fa-star", "⭐"],
    cube:      ["fa-solid fa-cube", "🧊"],
    map:       ["fa-solid fa-map-location-dot", "🗺️"],
    crown:     ["fa-solid fa-crown", "👑"],
    brain:     ["fa-solid fa-brain", "🧠"],
    gift:      ["fa-solid fa-gift", "🎁"],
    chart:     ["fa-solid fa-chart-line", "📈"],
    swap:      ["fa-solid fa-right-left", "🔁"],
    megaphone: ["fa-solid fa-bullhorn", "📣"],
    copy:      ["fa-solid fa-clone", "📋"],
    lock:      ["fa-solid fa-lock", "🔒"],
    fire:      ["fa-solid fa-fire", "🔥"],
    users:     ["fa-solid fa-users", "👥"],
    pen:       ["fa-solid fa-signature", "✍️"],
    lifering:  ["fa-solid fa-life-ring", "🛟"],
    play:      ["fa-solid fa-play", "▶️"],
    check:     ["fa-solid fa-check", "✔️"],
    xmark:     ["fa-solid fa-xmark", "✖️"],
    bolt:      ["fa-solid fa-bolt", "⚡"],
    book:      ["fa-solid fa-book-open", "📖"],
    flask:     ["fa-solid fa-flask", "🧪"],
    trophy:    ["fa-solid fa-trophy", "🏆"],
    home:      ["fa-solid fa-house", "🏠"],
    arrow:     ["fa-solid fa-arrow-right", "➡️"],
    back:      ["fa-solid fa-arrow-left", "⬅️"],
    close:     ["fa-solid fa-xmark", "✕"],
    sound:     ["fa-solid fa-volume-high", "🔊"],
    mute:      ["fa-solid fa-volume-xmark", "🔇"],
    reset:     ["fa-solid fa-rotate-left", "↺"],
    people:    ["fa-solid fa-user-group", "👥"],
    clock:     ["fa-regular fa-clock", "🕒"],
    compass:   ["fa-solid fa-compass", "🧭"],
    lightbulb: ["fa-solid fa-lightbulb", "💡"],
    hammer:    ["fa-solid fa-hammer", "🔨"],
    route:     ["fa-solid fa-route", "🛣️"],
    ban:       ["fa-solid fa-ban", "🚫"]
  };

  function icon(name, extra) {
    var def = ICONS[name] || ICONS.star;
    return '<i class="' + def[0] + (extra ? " " + extra : "") + '" data-emoji="' + def[1] + '" aria-hidden="true"></i>';
  }

  /* FontAwesome yuklanganini aniqlash: yuklanmagan bo'lsa emoji rejimi */
  function detectFA() {
    var probe = document.createElement("i");
    probe.className = "fa-solid fa-star";
    probe.style.cssText = "position:absolute;left:-9999px;font-size:24px";
    document.body.appendChild(probe);
    var fam = "";
    try { fam = window.getComputedStyle(probe, ":before").fontFamily || ""; } catch (e) {}
    var w = probe.offsetWidth;
    document.body.removeChild(probe);
    var ok = /Font Awesome/i.test(fam) && w > 4;
    document.body.classList.toggle("no-fa", !ok);
    return ok;
  }

  /* ---------- SVG yordamchilari ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function windows(g, x, y, w, h, cols, rows, color) {
    var pw = 7, ph = 9;
    var gapx = (w - cols * pw) / (cols + 1);
    var gapy = (h - rows * ph) / (rows + 1);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var lit = Math.random() > 0.35;
        el("rect", {
          x: (x + gapx + c * (pw + gapx)).toFixed(1),
          y: (y + gapy + r * (ph + gapy)).toFixed(1),
          width: pw, height: ph, rx: 1.5,
          fill: lit ? color : "#0d1220",
          opacity: lit ? (0.55 + Math.random() * 0.45).toFixed(2) : 0.9,
          class: lit ? "win lit" : "win"
        }, g);
      }
    }
  }

  /* ---------- Bino generatori ----------
     Har bino 160x150 maydonga chiziladi (markaz pastda: 80,150) */
  function building(type, color) {
    var g = el("g", { class: "bld bld-" + type });
    var base = "#161d2e", edge = "rgba(255,255,255,.14)";

    function body(x, y, w, h, rx) {
      return el("rect", { x: x, y: y, width: w, height: h, rx: rx || 3, fill: base, stroke: edge, "stroke-width": 1.2 }, g);
    }
    function roofTri(x1, y1, x2, y2, x3, y3, fill) {
      return el("polygon", { points: x1 + "," + y1 + " " + x2 + "," + y2 + " " + x3 + "," + y3, fill: fill || color, opacity: 0.9 }, g);
    }
    function accent(attrs) { return el("rect", Object.assign({ fill: color, opacity: 0.85, rx: 2 }, attrs), g); }

    switch (type) {
      case "school":
        body(20, 60, 120, 80, 4);
        roofTri(10, 60, 80, 24, 150, 60);
        accent({ x: 74, y: 30, width: 12, height: 12, rx: 6 });
        windows(g, 30, 74, 100, 54, 4, 2, color);
        accent({ x: 62, y: 112, width: 36, height: 28, rx: 3, opacity: 0.35 });
        break;

      case "tower":
        body(48, 20, 64, 120, 4);
        roofTri(40, 22, 80, 0, 120, 22);
        windows(g, 56, 36, 48, 96, 2, 6, color);
        accent({ x: 78, y: -6, width: 4, height: 12 });
        break;

      case "market":
        body(16, 74, 128, 66, 3);
        for (var i = 0; i < 6; i++) {
          el("path", {
            d: "M" + (16 + i * 21.3) + ",74 q10.6,-22 21.3,0",
            fill: i % 2 ? color : "#e05a6a", opacity: 0.85
          }, g);
        }
        windows(g, 28, 92, 104, 40, 5, 1, color);
        accent({ x: 60, y: 108, width: 40, height: 32, rx: 2, opacity: 0.3 });
        break;

      case "factory":
        body(18, 82, 124, 58, 3);
        el("polygon", { points: "18,82 48,64 48,82 78,64 78,82 108,64 108,82 142,68 142,82", fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        accent({ x: 112, y: 18, width: 14, height: 66, rx: 2, opacity: 0.6 });
        el("circle", { cx: 119, cy: 12, r: 8, fill: color, opacity: 0.28, class: "smoke" }, g);
        el("circle", { cx: 126, cy: 2, r: 11, fill: color, opacity: 0.16, class: "smoke smoke2" }, g);
        windows(g, 28, 96, 76, 34, 4, 1, color);
        break;

      case "gallery":
        body(22, 52, 116, 88, 4);
        accent({ x: 22, y: 52, width: 116, height: 8, rx: 2 });
        el("rect", { x: 40, y: 72, width: 36, height: 30, rx: 2, fill: color, opacity: 0.35 }, g);
        el("rect", { x: 86, y: 72, width: 36, height: 30, rx: 2, fill: "#e05a6a", opacity: 0.32 }, g);
        el("rect", { x: 40, y: 110, width: 82, height: 22, rx: 2, fill: color, opacity: 0.18 }, g);
        break;

      case "vault":
        body(26, 56, 108, 84, 5);
        el("circle", { cx: 80, cy: 98, r: 26, fill: "none", stroke: color, "stroke-width": 4, opacity: 0.9 }, g);
        el("circle", { cx: 80, cy: 98, r: 11, fill: color, opacity: 0.5, class: "dial" }, g);
        el("path", { d: "M80 72v12 M80 112v12 M54 98h12 M94 98h12", stroke: color, "stroke-width": 3, opacity: 0.7 }, g);
        break;

      case "bank":
        body(24, 66, 112, 74, 3);
        roofTri(14, 66, 80, 34, 146, 66);
        for (var c = 0; c < 4; c++) {
          el("rect", { x: 36 + c * 24, y: 78, width: 9, height: 52, rx: 2, fill: color, opacity: 0.5 }, g);
        }
        accent({ x: 24, y: 132, width: 112, height: 8, rx: 2, opacity: 0.6 });
        break;

      case "alley":
        body(14, 44, 52, 96, 3);
        body(76, 62, 60, 78, 3);
        windows(g, 22, 56, 36, 74, 2, 5, "#e05a6a");
        windows(g, 84, 74, 44, 54, 2, 3, color);
        el("path", { d: "M68 140 L68 96 M60 96h16", stroke: "#e05a6a", "stroke-width": 2.4, opacity: 0.9 }, g);
        el("circle", { cx: 68, cy: 92, r: 7, fill: "#e05a6a", opacity: 0.8, class: "lamp" }, g);
        break;

      case "highway":
        el("path", { d: "M6 140 L54 30 M154 140 L106 30", stroke: "#2a344c", "stroke-width": 10, fill: "none" }, g);
        el("path", { d: "M80 140 L80 30", stroke: color, "stroke-width": 3, "stroke-dasharray": "12 10", fill: "none", class: "road-dash" }, g);
        el("circle", { cx: 80, cy: 120, r: 6, fill: color, class: "car" }, g);
        el("circle", { cx: 80, cy: 70, r: 5, fill: "#e05a6a", class: "car car2" }, g);
        break;

      case "workshop":
        body(20, 72, 120, 68, 3);
        el("polygon", { points: "20,72 60,44 100,72", fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        el("polygon", { points: "100,72 140,44 140,72", fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        el("circle", { cx: 80, cy: 104, r: 18, fill: "none", stroke: color, "stroke-width": 3.5, "stroke-dasharray": "7 5", class: "gear" }, g);
        el("circle", { cx: 80, cy: 104, r: 6, fill: color, opacity: 0.8 }, g);
        break;

      case "gate":
        /* chegara darvozasi: ikki minora, kamar va skaner nuri */
        el("rect", { x: 14, y: 36, width: 26, height: 104, rx: 3, fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        el("rect", { x: 120, y: 36, width: 26, height: 104, rx: 3, fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        el("path", { d: "M14 36 q66 -34 132 0", fill: "none", stroke: color, "stroke-width": 5, opacity: 0.9 }, g);
        accent({ x: 70, y: 4, width: 20, height: 10, rx: 3 });
        windows(g, 18, 52, 18, 74, 1, 4, color);
        windows(g, 124, 52, 18, 74, 1, 4, color);
        el("rect", { x: 46, y: 74, width: 68, height: 66, rx: 4, fill: "#0c1220", stroke: color, "stroke-width": 1.4, opacity: 0.9 }, g);
        el("path", { d: "M48 82h64", stroke: color, "stroke-width": 3, opacity: 0.85, class: "scan" }, g);
        el("circle", { cx: 80, cy: 128, r: 5, fill: color, opacity: 0.7, class: "pulse-dot" }, g);
        break;

      case "plaza":
        el("ellipse", { cx: 80, cy: 118, rx: 64, ry: 22, fill: "#101624", stroke: edge }, g);
        body(52, 58, 56, 60, 4);
        accent({ x: 52, y: 58, width: 56, height: 7, rx: 2 });
        windows(g, 60, 72, 40, 38, 2, 3, color);
        el("circle", { cx: 32, cy: 116, r: 7, fill: color, opacity: 0.6, class: "pulse-dot" }, g);
        el("circle", { cx: 128, cy: 116, r: 7, fill: color, opacity: 0.6, class: "pulse-dot d2" }, g);
        break;

      case "mine":
        el("path", { d: "M10 140 L46 66 L114 66 L150 140 Z", fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        el("path", { d: "M56 140 L70 96 L92 96 L104 140 Z", fill: "#0d1220", stroke: color, "stroke-width": 1.6 }, g);
        el("path", { d: "M46 66 L80 34 L114 66", fill: "none", stroke: color, "stroke-width": 3, opacity: 0.8 }, g);
        el("circle", { cx: 80, cy: 118, r: 7, fill: color, class: "pulse-dot" }, g);
        break;

      case "post":
        body(24, 68, 112, 72, 4);
        el("polygon", { points: "24,68 80,100 136,68", fill: "none", stroke: color, "stroke-width": 3, opacity: 0.9 }, g);
        accent({ x: 24, y: 68, width: 112, height: 5, rx: 2 });
        el("circle", { cx: 80, cy: 122, r: 8, fill: color, opacity: 0.45, class: "pulse-dot" }, g);
        break;

      case "museum":
        body(26, 70, 108, 70, 3);
        el("path", { d: "M80 26 a34 34 0 0 1 34 44 H46 A34 34 0 0 1 80 26 z", fill: base, stroke: edge, "stroke-width": 1.2 }, g);
        accent({ x: 78, y: 14, width: 4, height: 14 });
        for (var k = 0; k < 5; k++) el("rect", { x: 34 + k * 20, y: 80, width: 8, height: 50, rx: 2, fill: color, opacity: 0.45 }, g);
        break;

      case "bridge":
        el("path", { d: "M4 116 q76 -66 152 0", fill: "none", stroke: color, "stroke-width": 4, opacity: 0.9 }, g);
        el("path", { d: "M4 126 h152", stroke: "#2a344c", "stroke-width": 8 }, g);
        for (var b = 0; b < 6; b++) {
          var bx = 16 + b * 26;
          el("path", { d: "M" + bx + ",126 V" + (116 - Math.sin((b + 1) / 7 * Math.PI) * 40), stroke: color, "stroke-width": 1.6, opacity: 0.55 }, g);
        }
        el("rect", { x: 20, y: 126, width: 10, height: 24, fill: base, stroke: edge }, g);
        el("rect", { x: 130, y: 126, width: 10, height: 24, fill: base, stroke: edge }, g);
        el("circle", { cx: 20, cy: 126, r: 5, fill: "#59f0a8", class: "tx-dot" }, g);
        break;

      case "hq":
        body(30, 48, 100, 92, 4);
        el("path", { d: "M80 14 l40 16 v22 c0 26-18 40-40 46 -22-6-40-20-40-46 V30 z", fill: base, stroke: color, "stroke-width": 2 }, g);
        el("path", { d: "M80 40 v34", stroke: color, "stroke-width": 3.4, opacity: 0.9 }, g);
        windows(g, 40, 100, 80, 34, 4, 1, color);
        break;

      default:
        body(30, 60, 100, 80, 4);
        windows(g, 40, 74, 80, 54, 3, 3, color);
    }
    return g;
  }

  LT.Icons = ICONS;
  LT.Svg = { el: el, icon: icon, building: building, detectFA: detectFA, NS: NS };
  LT.icon = icon;
})();
