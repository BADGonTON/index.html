/* ============================================================
   KRIPTO OLAMI — dunyo xaritasi va shahar ko'rinishi
   ============================================================ */
(function () {
  "use strict";

  var S = LT.Svg, el = S.el;

  /* ChainShield shtabi — zanjir emas, alohida nuqta */
  var HQ = {
    id: "hq", name: "ChainShield shtabi", coin: "LAB", real: "Xavfsizlik laboratoriyasi",
    role: "Tuzoqlar xavfsiz muhitda ochiladi",
    color: "#00E5FF", glow: "#9BF2FF", x: 196, y: 700, r: 66,
    stats: { consensus: "—", tps: "—", fee: "—", block: "—", final: "—" },
    addr: "lab://chainshield",
    story: ["Bu zanjir emas — laboratoriya. Bu yerda shartnoma auditi, \"VIP signal\" grafigi va P2P tuzog'i simulyatorlari turadi."],
    pros: [], cons: []
  };

  var Map = {
    svg: null, root: null, txAnims: [],
    view: { x: 0, y: 0, w: 1600, h: 900 },
    dragging: false,

    allNodes: function () { return LT.DATA.chains.concat([HQ]); },
    node: function (id) {
      return this.allNodes().filter(function (c) { return c.id === id; })[0];
    },

    /* ---------------- DUNYO XARITASI ---------------- */
    renderWorld: function (host) {
      host.innerHTML = "";
      var svg = el("svg", { viewBox: "0 0 1600 900", class: "world-svg", preserveAspectRatio: "xMidYMid meet" }, host);
      this.svg = svg;

      var defs = el("defs", {}, svg);
      /* okean gradienti */
      var og = el("radialGradient", { id: "g-ocean", cx: "50%", cy: "40%", r: "75%" }, defs);
      el("stop", { offset: "0%", "stop-color": "#101b31" }, og);
      el("stop", { offset: "100%", "stop-color": "#070a12" }, og);
      /* har zanjir uchun gradient */
      this.allNodes().forEach(function (c) {
        var g = el("radialGradient", { id: "g-" + c.id, cx: "38%", cy: "32%", r: "72%" }, defs);
        el("stop", { offset: "0%", "stop-color": c.glow, "stop-opacity": "0.95" }, g);
        el("stop", { offset: "55%", "stop-color": c.color, "stop-opacity": "0.55" }, g);
        el("stop", { offset: "100%", "stop-color": c.color, "stop-opacity": "0.12" }, g);
      });
      var blur = el("filter", { id: "f-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
      el("feGaussianBlur", { stdDeviation: "14", result: "b" }, blur);
      var m = el("feMerge", {}, blur);
      el("feMergeNode", { in: "b" }, m);
      el("feMergeNode", { in: "SourceGraphic" }, m);

      el("rect", { x: 0, y: 0, width: 1600, height: 900, fill: "url(#g-ocean)" }, svg);

      var root = el("g", { class: "world-root" }, svg);
      this.root = root;

      /* to'r chiziqlari */
      var grid = el("g", { class: "grid" }, root);
      for (var gx = 0; gx <= 1600; gx += 80) el("line", { x1: gx, y1: 0, x2: gx, y2: 900, stroke: "rgba(120,160,220,.07)", "stroke-width": 1 }, grid);
      for (var gy = 0; gy <= 900; gy += 80) el("line", { x1: 0, y1: gy, x2: 1600, y2: gy, stroke: "rgba(120,160,220,.07)", "stroke-width": 1 }, grid);

      /* EVM ittifoqi konturi */
      var union = LT.DATA.unions[0];
      var ug = el("g", { class: "union-zone", "data-union": union.id }, root);
      el("ellipse", {
        cx: 478, cy: 480, rx: 246, ry: 258, transform: "rotate(-12 478 480)",
        fill: "rgba(124,140,255,.07)", stroke: "rgba(124,140,255,.45)",
        "stroke-width": 2, "stroke-dasharray": "14 10", class: "union-ring"
      }, ug);
      var ul = el("text", { x: 420, y: 174, class: "union-label", "text-anchor": "middle" }, ug);
      ul.textContent = union.name.toUpperCase();
      var us = el("text", { x: 420, y: 196, class: "union-sub", "text-anchor": "middle" }, ug);
      us.textContent = "bir xil pasport · bir xil til · uchta davlat";

      /* ko'priklar */
      var bg = el("g", { class: "bridges" }, root);
      var self = this;
      this.txAnims = [];
      LT.DATA.bridges.forEach(function (br, i) {
        var a = self.node(br.a), b = self.node(br.b);
        if (!a || !b) return;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var dx = b.x - a.x, dy = b.y - a.y;
        var bend = br.kind === "internal" ? 0.06 : 0.16;
        var cx = mx - dy * bend, cy = my + dx * bend;
        var d = "M" + a.x + "," + a.y + " Q" + cx + "," + cy + " " + b.x + "," + b.y;
        el("path", {
          d: d, fill: "none",
          stroke: br.kind === "internal" ? "rgba(124,140,255,.5)" : "rgba(140,190,255,.28)",
          "stroke-width": br.kind === "internal" ? 2.5 : 2,
          "stroke-dasharray": br.kind === "internal" ? "none" : "9 9",
          class: "bridge-line " + br.kind
        }, bg);
        var path = el("path", { d: d, fill: "none", stroke: "none" }, bg);
        var dot = el("circle", { r: 4.5, fill: i % 2 ? "#59f0a8" : "#7cd9ff", class: "tx-dot" }, bg);
        self.txAnims.push({ path: path, dot: dot, t: Math.random(), speed: 0.0016 + Math.random() * 0.0022 });
      });

      /* zanjir orollari */
      var ng = el("g", { class: "nodes" }, root);
      this.allNodes().forEach(function (c) { self.drawNode(ng, c); });

      this.startTx();
      this.bindPanZoom(host);
      this.refreshWorld();
      return svg;
    },

    drawNode: function (parent, c) {
      var g = el("g", {
        class: "node-g" + (c.id === "hq" ? " node-hq" : ""),
        "data-chain": c.id, transform: "translate(" + c.x + "," + c.y + ")",
        tabindex: "0", role: "button", "aria-label": c.name
      }, parent);

      el("circle", { r: c.r + 26, fill: "url(#g-" + c.id + ")", opacity: 0.35, class: "isle-halo" }, g);
      el("circle", { r: c.r, fill: "url(#g-" + c.id + ")", stroke: c.color, "stroke-width": 2, class: "isle" }, g);
      el("circle", { r: c.r + 10, fill: "none", stroke: c.color, "stroke-width": 1.4, opacity: 0.5, class: "isle-pulse" }, g);

      /* shahar silueti */
      var sil = el("g", { class: "sil", transform: "translate(0," + (c.r * 0.18) + ")" }, g);
      var n = c.id === "hq" ? 3 : 6;
      for (var i = 0; i < n; i++) {
        var w = 9 + (i % 3) * 5, h = 18 + ((i * 7) % 26);
        var x = -c.r * 0.55 + i * (c.r * 1.1 / n);
        el("rect", { x: x.toFixed(1), y: (-h).toFixed(1), width: w, height: h, rx: 1.5, fill: "#0b1220", stroke: c.color, "stroke-width": 0.9, opacity: 0.9 }, sil);
        el("rect", { x: (x + 2).toFixed(1), y: (-h + 4).toFixed(1), width: 3, height: 3, fill: c.glow, opacity: 0.9, class: "sil-win" }, sil);
      }
      el("line", { x1: -c.r * 0.72, y1: c.r * 0.18, x2: c.r * 0.72, y2: c.r * 0.18, stroke: c.color, "stroke-width": 1.2, opacity: 0.5 }, g);

      /* progress halqasi */
      var rr = c.r + 18, circ = 2 * Math.PI * rr;
      el("circle", { r: rr, fill: "none", stroke: "rgba(255,255,255,.08)", "stroke-width": 5 }, g);
      el("circle", {
        r: rr, fill: "none", stroke: c.color, "stroke-width": 5, "stroke-linecap": "round",
        "stroke-dasharray": circ, "stroke-dashoffset": circ,
        transform: "rotate(-90)", class: "prog-ring", "data-circ": circ
      }, g);

      /* yozuvlar */
      var t1 = el("text", { y: c.r + 46, class: "node-name", "text-anchor": "middle" }, g);
      t1.textContent = c.name;
      var t2 = el("text", { y: c.r + 66, class: "node-sub", "text-anchor": "middle" }, g);
      t2.textContent = c.real + " · " + c.coin;

      var badge = el("g", { class: "node-badge", transform: "translate(" + (c.r * 0.62) + "," + (-c.r * 0.72) + ")" }, g);
      el("circle", { r: 15, fill: "#0b1220", stroke: c.color, "stroke-width": 1.6 }, badge);
      var bt = el("text", { class: "node-badge-t", "text-anchor": "middle", y: 5 }, badge);
      bt.textContent = "0%";

      g.addEventListener("click", function () { LT.UI.openCity(c.id); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); LT.UI.openCity(c.id); } });
      g.addEventListener("mouseenter", function () { LT.UI.showWorldTip(c); });
      g.addEventListener("mouseleave", function () { LT.UI.hideWorldTip(); });
    },

    refreshWorld: function () {
      if (!this.svg) return;
      var E = LT.Engine;
      this.allNodes().forEach(function (c) {
        var g = this.svg.querySelector('.node-g[data-chain="' + c.id + '"]');
        if (!g) return;
        var p = E.cityProgress(c.id);
        var ring = g.querySelector(".prog-ring");
        var circ = parseFloat(ring.getAttribute("data-circ"));
        ring.setAttribute("stroke-dashoffset", circ * (1 - p));
        g.querySelector(".node-badge-t").textContent = Math.round(p * 100) + "%";
        g.classList.toggle("done", p >= 1);
      }, this);
    },

    startTx: function () {
      var self = this;
      if (this._raf) cancelAnimationFrame(this._raf);
      function step() {
        self.txAnims.forEach(function (a) {
          var len = 0;
          try { len = a.path.getTotalLength(); } catch (e) { return; }
          a.t += a.speed;
          if (a.t > 1) a.t = 0;
          var pt;
          try { pt = a.path.getPointAtLength(len * a.t); } catch (e) { return; }
          a.dot.setAttribute("cx", pt.x);
          a.dot.setAttribute("cy", pt.y);
        });
        self._raf = requestAnimationFrame(step);
      }
      step();
    },

    stopTx: function () { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; },

    /* ---------------- Pan / Zoom ---------------- */
    setView: function (v) {
      this.view = v;
      this.svg.setAttribute("viewBox", v.x + " " + v.y + " " + v.w + " " + v.h);
    },
    zoomBy: function (k, cx, cy) {
      var v = this.view;
      var nw = Math.min(1600, Math.max(420, v.w * k));
      var nh = nw * (900 / 1600);
      var px = cx === undefined ? v.x + v.w / 2 : cx;
      var py = cy === undefined ? v.y + v.h / 2 : cy;
      var rx = (px - v.x) / v.w, ry = (py - v.y) / v.h;
      var nx = px - rx * nw, ny = py - ry * nh;
      nx = Math.max(-120, Math.min(1720 - nw, nx));
      ny = Math.max(-80, Math.min(980 - nh, ny));
      this.setView({ x: nx, y: ny, w: nw, h: nh });
    },
    resetView: function () { this.setView({ x: 0, y: 0, w: 1600, h: 900 }); },

    bindPanZoom: function (host) {
      var self = this, last = null;
      host.addEventListener("wheel", function (e) {
        e.preventDefault();
        var pt = self.clientToSvg(e.clientX, e.clientY);
        self.zoomBy(e.deltaY > 0 ? 1.12 : 0.89, pt.x, pt.y);
      }, { passive: false });

      host.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".node-g")) return;
        last = { x: e.clientX, y: e.clientY };
        self.dragging = true;
        host.classList.add("grabbing");
      });
      window.addEventListener("pointermove", function (e) {
        if (!self.dragging || !last) return;
        var rect = self.svg.getBoundingClientRect();
        var sx = self.view.w / rect.width, sy = self.view.h / rect.height;
        var v = self.view;
        self.setView({ x: v.x - (e.clientX - last.x) * sx, y: v.y - (e.clientY - last.y) * sy, w: v.w, h: v.h });
        last = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener("pointerup", function () {
        self.dragging = false; last = null; host.classList.remove("grabbing");
      });
    },

    clientToSvg: function (cx, cy) {
      var rect = this.svg.getBoundingClientRect(), v = this.view;
      return { x: v.x + (cx - rect.left) / rect.width * v.w, y: v.y + (cy - rect.top) / rect.height * v.h };
    },

    /* Shahardagi joylar uchun o'rinlar: orqa qator kichikroq (perspektiva) */
    cityLayout: function (n) {
      var slots = [];
      function row(count, y, s, from, to) {
        for (var i = 0; i < count; i++) {
          var t = count === 1 ? 0.5 : i / (count - 1);
          slots.push({ x: from + t * (to - from), y: y, s: s });
        }
      }
      if (n <= 3) {                       /* bitta qator — bo'sh joy qolmaydi */
        row(n, 596, 1, n === 1 ? 520 : 230, n === 1 ? 520 : 810);
      } else {                            /* orqa qator kichikroq (perspektiva) */
        var backN = Math.ceil(n / 2), frontN = n - backN;
        row(backN, 318, 0.76, backN > 3 ? 150 : 250, backN > 3 ? 876 : 800);
        row(frontN, 612, 1, frontN > 2 ? 196 : 300, frontN > 2 ? 836 : 740);
      }
      return slots;
    },

    /* ---------------- SHAHAR KO'RINISHI ---------------- */
    renderCity: function (host, chainId) {
      var c = this.node(chainId);
      var locs = LT.Engine.cityLocations(chainId);
      host.innerHTML = "";
      var svg = el("svg", { viewBox: "0 0 1040 700", class: "city-svg", preserveAspectRatio: "xMidYMid meet" }, host);

      var defs = el("defs", {}, svg);
      var sky = el("linearGradient", { id: "g-sky", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
      el("stop", { offset: "0%", "stop-color": c.color, "stop-opacity": "0.20" }, sky);
      el("stop", { offset: "55%", "stop-color": "#0a0f1a", "stop-opacity": "0.9" }, sky);
      el("stop", { offset: "100%", "stop-color": "#080c15" }, sky);

      el("rect", { x: 0, y: 0, width: 1040, height: 700, fill: "url(#g-sky)" }, svg);

      /* yulduzlar */
      var stars = el("g", { class: "stars" }, svg);
      for (var i = 0; i < 60; i++) {
        el("circle", {
          cx: (Math.random() * 1040).toFixed(0), cy: (Math.random() * 300).toFixed(0),
          r: (Math.random() * 1.4 + 0.4).toFixed(1), fill: "#cfe6ff",
          opacity: (0.2 + Math.random() * 0.6).toFixed(2), class: "star"
        }, stars);
      }

      /* uzoqdagi siluet */
      var far = el("g", { class: "skyline", opacity: "0.35" }, svg);
      var x = -20;
      while (x < 1060) {
        var w = 26 + Math.random() * 44, h = 60 + Math.random() * 130;
        el("rect", { x: x.toFixed(0), y: (376 - h).toFixed(0), width: w.toFixed(0), height: h.toFixed(0), fill: "#0d1524", stroke: c.color, "stroke-width": 0.6, opacity: 0.8 }, far);
        x += w + 6 + Math.random() * 12;
      }

      /* yer va yo'llar */
      el("rect", { x: 0, y: 376, width: 1040, height: 324, fill: "#0a1020" }, svg);
      var roads = el("g", { class: "roads" }, svg);
      el("path", { d: "M0 566 H1040", stroke: "#131c2e", "stroke-width": 46 }, roads);
      el("path", { d: "M0 566 H1040", stroke: c.color, "stroke-width": 2, "stroke-dasharray": "26 22", opacity: 0.45, class: "road-flow" }, roads);
      el("path", { d: "M520 700 V376", stroke: "#131c2e", "stroke-width": 36 }, roads);
      el("path", { d: "M520 700 V376", stroke: c.color, "stroke-width": 1.6, "stroke-dasharray": "18 16", opacity: 0.3, class: "road-flow" }, roads);

      /* binolar — orqa va old qatorga bo'lib, perspektiva bilan */
      var bg = el("g", { class: "city-bld" }, svg);
      var self = this;
      var slots = this.cityLayout(locs.length);
      locs.forEach(function (loc, li) {
        var sl = slots[li];
        var g = el("g", {
          class: "loc-g", "data-loc": loc.id, tabindex: "0", role: "button",
          "aria-label": loc.name,
          transform: "translate(" + (sl.x - 80 * sl.s).toFixed(1) + "," + (sl.y - 150 * sl.s).toFixed(1) + ") scale(" + sl.s + ")"
        }, bg);

        el("ellipse", { cx: 80, cy: 152, rx: 76, ry: 16, fill: "#000", opacity: 0.45 }, g);
        el("ellipse", { cx: 80, cy: 152, rx: 90, ry: 22, fill: c.color, opacity: 0.09, class: "loc-glow" }, g);
        g.appendChild(S.building(loc.type, c.color));

        /* nom plitasi */
        var plate = el("g", { class: "plate", transform: "translate(80,178)" }, g);
        var label = loc.name;
        var pw = Math.max(150, label.length * 8.6 + 30);
        el("rect", { x: (-pw / 2).toFixed(0), y: -16, width: pw.toFixed(0), height: 32, rx: 9, fill: "rgba(9,13,22,.92)", stroke: c.color, "stroke-width": 1.2 }, plate);
        var tx = el("text", { class: "plate-t", "text-anchor": "middle", y: 5 }, plate);
        tx.textContent = label;

        /* holat nishoni — nom plitasining yonida */
        var flip = (sl.x + (pw / 2 + 34) * sl.s) > 1020;
        var stx = flip ? (80 - pw / 2 - 19) : (80 + pw / 2 + 19);
        var st = el("g", { class: "loc-state", transform: "translate(" + stx.toFixed(0) + ",178)" }, g);
        el("circle", { r: 14, fill: "#0b1220", stroke: c.color, "stroke-width": 1.6 }, st);
        var stt = el("text", { class: "loc-state-t", "text-anchor": "middle", y: 5 }, st);
        stt.textContent = "?";

        g.addEventListener("click", function () { LT.UI.openLocation(loc.id); });
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); LT.UI.openLocation(loc.id); } });
      });

      /* gorizont nuri */
      el("rect", { x: 0, y: 362, width: 1040, height: 26, fill: c.color, opacity: 0.12 }, svg);
      el("line", { x1: 0, y1: 376, x2: 1040, y2: 376, stroke: c.color, "stroke-width": 1.4, opacity: 0.5 }, svg);

      /* old plan chiroqlari va detallar */
      var lamps = el("g", { class: "lamps" }, svg);
      for (var l = 0; l < 7; l++) {
        var lx = 70 + l * 150;
        el("path", { d: "M" + lx + ",692 v-90 h20", stroke: "#1c2740", "stroke-width": 4, fill: "none" }, lamps);
        el("circle", { cx: lx + 22, cy: 604, r: 6, fill: c.glow, opacity: 0.75, class: "lamp-light" }, lamps);
        el("ellipse", { cx: lx + 22, cy: 642, rx: 26, ry: 8, fill: c.glow, opacity: 0.07 }, lamps);
      }

      /* yo'ldagi "tranzaksiya" mashinalari */
      var traffic = el("g", { class: "traffic" }, svg);
      [[0, 3.2], [1, 5.1], [2, 4.1]].forEach(function (t, i) {
        var dot = el("rect", { x: -20, y: 560, width: 26, height: 11, rx: 3, fill: i % 2 ? c.glow : "#59f0a8", opacity: 0.85 }, traffic);
        dot.setAttribute("class", "tx-car");
        dot.style.animationDuration = t[1] + "s";
        dot.style.animationDelay = (i * 1.4) + "s";
      });

      /* antennalar va bayroqlar */
      var props = el("g", { class: "props", opacity: "0.8" }, svg);
      [[54, 446], [990, 430]].forEach(function (pp, i) {
        el("path", { d: "M" + pp[0] + "," + pp[1] + " v-70", stroke: "#243049", "stroke-width": 3 }, props);
        el("circle", { cx: pp[0], cy: pp[1] - 74, r: 4, fill: c.color, class: "pulse-dot", opacity: 0.9 }, props);
        el("path", { d: "M" + pp[0] + "," + (pp[1] - 60) + " l18,8 -18,8 z", fill: c.color, opacity: 0.45 }, props);
      });

      /* binolar va nom plitalari eng ustida turishi kerak */
      svg.appendChild(bg);

      this.citySvg = svg;
      this.refreshCity(chainId);
      return svg;
    },

    refreshCity: function (chainId) {
      if (!this.citySvg) return;
      var E = LT.Engine;
      Array.prototype.forEach.call(this.citySvg.querySelectorAll(".loc-g"), function (g) {
        var id = g.getAttribute("data-loc");
        var done = E.locDone(id);
        var read = !!E.state.lessons[id];
        g.classList.toggle("done", done);
        g.classList.toggle("read", read && !done);
        var t = g.querySelector(".loc-state-t");
        if (t) t.textContent = done ? "✓" : (read ? "•" : "?");
      });
    }
  };

  LT.Map = Map;
  LT.HQ = HQ;
})();
