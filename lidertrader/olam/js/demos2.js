/* ============================================================
   KRIPTO OLAMI — laboratoriyalar (2-qism)
   ============================================================ */
(function () {
  "use strict";
  var I = LT.icon, D = LT.Demos;
  var h = LT.demoHelpers.h, fmt = LT.demoHelpers.fmt, hash = LT.demoHelpers.hash, toast = LT.demoHelpers.toast;

  /* ============ 9) SEED-FRAZA ============ */
  D.seed = function (host, ctx) {
    var WORDS = ("olma daraxt qadam bulut chiroq daryo tepalik yulduz kitob oyna qalam soya temir bahor kumush " +
      "nurli quyosh paxta zilol shamol qirra tuman maysa bodom")
      .split(" ");
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("key") + ' <b>Laboratoriya:</b> 12 so\'z — butun boyligingiz' +
      '    <span class="lab-hint">Hamyon yarating, so\'ngra "qo\'llab-quvvatlash" xizmati bilan gaplashib ko\'ring</span>' +
      '  </div>' +
      '  <div class="panel">' +
      '    <div class="lab-actions"><button class="gbtn gbtn-ok" id="sd-gen">' + I("hammer") + ' Hamyon yaratish</button>' +
      '      <button class="gbtn gbtn-ghost" id="sd-toggle" disabled>' + I("eye") + ' Ko\'rsatish / yashirish</button></div>' +
      '    <div class="seed-grid blurred" id="sd-grid"></div>' +
      '    <div class="addr-line" id="sd-addr"></div>' +
      '  </div>' +
      '  <div class="chat" id="sd-chat" style="display:none">' +
      '    <div class="chat-head">' + I("users") + ' <b>TON Support Official</b><span class="verified">✓ rasmiy (?)</span></div>' +
      '    <div class="chat-body" id="sd-body"></div>' +
      '    <div class="chat-actions" id="sd-actions"></div>' +
      '  </div>' +
      '</div>'
    ));
    var grid = host.querySelector("#sd-grid"), words = [];
    host.querySelector("#sd-gen").addEventListener("click", function () {
      words = [];
      grid.innerHTML = "";
      for (var i = 0; i < 12; i++) {
        var w = WORDS[Math.floor(Math.random() * WORDS.length)];
        words.push(w);
        var c = document.createElement("div");
        c.className = "seed-w";
        c.style.animationDelay = (i * 0.05).toFixed(2) + "s";
        c.innerHTML = "<span>" + (i + 1) + "</span>" + w;
        grid.appendChild(c);
      }
      host.querySelector("#sd-addr").innerHTML = I("check") + " Manzil yaratildi: <code>UQBk" + hash(words.join("")).slice(0, 10) + "7dK2</code> — <b>bu manzilni hammaga berish mumkin</b>";
      host.querySelector("#sd-toggle").disabled = false;
      grid.classList.remove("blurred");
      setTimeout(function () {
        grid.classList.add("blurred");
        toast("Seed-fraza yashirildi. Endi uni hech kimga ko'rsatmang.", "info");
        chat();
      }, 2600);
    });
    host.querySelector("#sd-toggle").addEventListener("click", function () { grid.classList.toggle("blurred"); });

    function chat() {
      var box = host.querySelector("#sd-chat");
      box.style.display = "block";
      var body = host.querySelector("#sd-body"), acts = host.querySelector("#sd-actions");
      body.innerHTML = '<div class="msg in">Assalomu alaykum! Hamyoningizda texnik nosozlik aniqlandi. Mablag\'ni tiklash uchun 12 so\'zli frazangizni yuboring — 10 daqiqada hal qilamiz.</div>';
      acts.innerHTML = "";
      [["12 so'zni yuborish", false], ["Faqat 6 so'zini yuborish", false], ["Hech narsa yubormaslik va bloklash", true]].forEach(function (o) {
        var b = document.createElement("button");
        b.className = "gbtn " + (o[1] ? "gbtn-ok" : "gbtn-ghost");
        b.textContent = o[0];
        b.addEventListener("click", function () {
          acts.innerHTML = "";
          if (o[1]) {
            body.insertAdjacentHTML("beforeend", '<div class="msg out">—</div><div class="msg sys ok-t">✓ To\'g\'ri. Haqiqiy xizmat seed-frazani hech qachon so\'ramaydi. Suhbat shu joyda tugaydi.</div>');
            LT.Engine.addXp(35, "Seed tuzog'idan qutuldingiz");
            toast("+35 XP — kalitlaringizni himoya qildingiz", "ok");
          } else {
            body.insertAdjacentHTML("beforeend", '<div class="msg out">' + (o[0].indexOf("6") > -1 ? "olma daraxt qadam bulut chiroq daryo" : words.join(" ")) + '</div>' +
              '<div class="msg sys bad-t">✗ 4 sekunddan keyin hamyon bo\'shatildi. E\'tibor bering: hatto 6 so\'z ham yetarli bo\'lishi mumkin — qolganini kompyuter sanab topadi.</div>');
            grid.classList.add("stolen");
            LT.Engine.addCoins(-30, "Seed o'g'irlandi");
            toast("Hamyon bo'shatildi. Yaxshiyamki bu — simulyatsiya.", "bad");
          }
          ctx.done();
        });
        acts.appendChild(b);
      });
    }
  };

  /* ============ 10) PROOF OF WORK ============ */
  D.pow = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("pickaxe") + ' <b>Laboratoriya:</b> blok qanday "qazib olinadi"' +
      '    <span class="lab-hint">Qiyinlikni oshirib, ish hajmi qanday o\'sishini ko\'ring</span>' +
      '  </div>' +
      '  <div class="slider-row"><label>Qiynlik (boshidagi nol soni): <b id="w-diff-t">3</b></label>' +
      '    <input type="range" id="w-diff" min="1" max="5" step="1" value="3"></div>' +
      '  <div class="stat-row">' +
      '    <div class="st"><span>Sinab ko\'rilgan nonce</span><b id="w-tries">0</b></div>' +
      '    <div class="st"><span>Tezlik</span><b id="w-rate">0 h/s</b></div>' +
      '    <div class="st"><span>Sarflangan vaqt</span><b id="w-time">0.0 s</b></div>' +
      '    <div class="st ok"><span>Topilgan bloklar</span><b id="w-found">0</b></div>' +
      '  </div>' +
      '  <div class="hash-live"><code id="w-hash">—</code></div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ok" id="w-mine">' + I("play") + ' Konni ishga tushirish</button>' +
      '    <button class="gbtn gbtn-ghost" id="w-stop" disabled>To\'xtatish</button>' +
      '  </div>' +
      '  <div class="term" id="w-log"><div>$ mempool: 2 140 tranzaksiya kutib turmoqda</div></div>' +
      '</div>'
    ));
    var diff = host.querySelector("#w-diff"), running = false, raf = null, found = 0;
    diff.addEventListener("input", function () { host.querySelector("#w-diff-t").textContent = diff.value; });
    var log = host.querySelector("#w-log");
    function line(t) { var d = document.createElement("div"); d.innerHTML = t; log.appendChild(d); log.scrollTop = log.scrollHeight; }

    host.querySelector("#w-mine").addEventListener("click", function () {
      if (running) return;
      running = true;
      host.querySelector("#w-stop").disabled = false;
      var nonce = 0, t0 = performance.now(), target = "0".repeat(+diff.value);
      var blockData = "blok#" + (840000 + found) + "|2140 tx|";
      function chunk() {
        var end = performance.now() + 14;
        var hv = "";
        while (performance.now() < end) {
          nonce++;
          hv = hash(blockData + nonce);
          if (hv.slice(0, target.length) === target) {
            var secs = (performance.now() - t0) / 1000;
            found++;
            host.querySelector("#w-found").textContent = found;
            host.querySelector("#w-hash").innerHTML = "<b class='ok-t'>" + hv + "</b>";
            line("<span class='ok-t'>✓ BLOK TOPILDI</span> — nonce " + fmt(nonce, 0) + " · " + secs.toFixed(2) + " s · hash " + hv.slice(0, 12) + "… · mukofot: 3.125 BTC + komissiya");
            running = false;
            host.querySelector("#w-stop").disabled = true;
            ctx.done();
            return;
          }
        }
        host.querySelector("#w-tries").textContent = fmt(nonce, 0);
        host.querySelector("#w-hash").textContent = hv;
        var el = (performance.now() - t0) / 1000;
        host.querySelector("#w-time").textContent = el.toFixed(1) + " s";
        host.querySelector("#w-rate").textContent = fmt(nonce / Math.max(0.1, el), 0) + " h/s";
        if (running) raf = requestAnimationFrame(chunk);
      }
      line("Kon ishga tushdi · qiyinlik: hash " + target + "… bilan boshlanishi kerak");
      chunk();
    });
    host.querySelector("#w-stop").addEventListener("click", function () {
      running = false; if (raf) cancelAnimationFrame(raf);
      this.disabled = true;
      line("<span class='warn-t'>To'xtatildi.</span> Sarflangan quvvat qaytmaydi — konda mukofot faqat blok topganga tegadi.");
    });
  };

  /* ============ 11) MEMPOOL VA TASDIQLAR ============ */
  D.mempool = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("mail") + ' <b>Laboratoriya:</b> tranzaksiya yo\'li' +
      '    <span class="lab-hint">Komissiyani o\'zgartirib navbatdagi o\'rningizni ko\'ring</span>' +
      '  </div>' +
      '  <div class="slider-row"><label>Komissiya: <b id="m-fee-t">5</b> sat/vB</label>' +
      '    <input type="range" id="m-fee" min="1" max="60" step="1" value="5"></div>' +
      '  <div class="mempool" id="m-pool"></div>' +
      '  <div class="conf-row" id="m-confs"></div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ok" id="m-send">' + I("arrow") + ' Tranzaksiyani yuborish</button>' +
      '    <span class="lab-status" id="m-status">Navbat: 2 140 tranzaksiya</span>' +
      '  </div>' +
      '</div>'
    ));
    var fee = host.querySelector("#m-fee"), pool = host.querySelector("#m-pool");
    function fill() {
      pool.innerHTML = "";
      for (var i = 0; i < 46; i++) {
        var f = 1 + Math.floor(Math.random() * 45);
        var d = document.createElement("i");
        d.className = "mtx";
        d.style.height = (12 + f) + "px";
        d.style.opacity = 0.35 + f / 90;
        d.dataset.fee = f;
        pool.appendChild(d);
      }
    }
    fill();
    fee.addEventListener("input", function () {
      host.querySelector("#m-fee-t").textContent = fee.value;
      var higher = Array.prototype.filter.call(pool.children, function (c) { return +c.dataset.fee > +fee.value; }).length;
      host.querySelector("#m-status").textContent = "Sizdan oldin: ~" + (higher * 46) + " tranzaksiya";
    });
    host.querySelector("#m-send").addEventListener("click", function () {
      var f = +fee.value;
      var mine = document.createElement("i");
      mine.className = "mtx mine";
      mine.style.height = (12 + f) + "px";
      pool.appendChild(mine);
      var wait = f > 40 ? 1 : f > 20 ? 2 : f > 8 ? 3 : 6;
      host.querySelector("#m-status").innerHTML = "Yuborildi · <b>0 tasdiq</b> — bloklar kutilmoqda (taxminan " + wait * 10 + " daqiqa)";
      var confs = host.querySelector("#m-confs");
      confs.innerHTML = "";
      var i = 0;
      var iv = setInterval(function () {
        i++;
        var b = document.createElement("div");
        b.className = "cblk" + (i === wait ? " in" : "");
        b.innerHTML = "<span>blok</span><b>" + (i >= wait ? (i - wait + 1) : "—") + "</b>";
        confs.appendChild(b);
        if (i === wait) { mine.classList.add("mined"); }
        if (i >= wait) {
          var c = i - wait + 1;
          host.querySelector("#m-status").innerHTML = "<b class='ok-t'>" + c + " tasdiq</b>" + (c >= 3 ? " — katta summalar uchun yetarli" : " — kuting, 3–6 tasdiq ishonchli");
        }
        if (i >= wait + 5) { clearInterval(iv); ctx.done(); }
      }, 620);
    });
  };

  /* ============ 12) MAXFIYLIK (ZEC) ============ */
  D.privacy = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("shieldlock") + ' <b>Laboratoriya:</b> ochiq daftar va yopiq konvert' +
      '    <span class="lab-hint">Rejimni almashtirib, kuzatuvchi nimani ko\'rishini solishtiring</span>' +
      '  </div>' +
      '  <div class="toggle2">' +
      '    <button class="tg on" data-m="t">' + I("eye") + ' t-manzil (ochiq)</button>' +
      '    <button class="tg" data-m="z">' + I("shieldlock") + ' z-manzil (ekranlangan)</button>' +
      '  </div>' +
      '  <div class="two">' +
      '    <div class="panel"><div class="mini-title">Zanjirda yozilgani</div><div class="ledger" id="pv-ledger"></div></div>' +
      '    <div class="panel"><div class="mini-title">Kuzatuvchi xulosasi</div><div class="watcher" id="pv-watch"></div></div>' +
      '  </div>' +
      '  <div class="lab-actions"><button class="gbtn gbtn-bad" id="pv-leak" disabled>' + I("warning") + ' Ekranlangan pulni ochiq manzilga chiqarish</button></div>' +
      '</div>'
    ));
    var rows = [
      { from: "t1Kd…9f2", to: "t1Ax…77b", amt: "820.00 ZEC", note: "maosh" },
      { from: "t1Ax…77b", to: "t1Qw…4dd", amt: "140.50 ZEC", note: "ijara" },
      { from: "t1Ax…77b", to: "t1Zz…8kk", amt: "38.20 ZEC", note: "xarid" }
    ];
    function draw(mode) {
      var L = host.querySelector("#pv-ledger"), W = host.querySelector("#pv-watch");
      L.innerHTML = ""; 
      rows.forEach(function (r, i) {
        var d = document.createElement("div");
        d.className = "lrow";
        d.style.animationDelay = (i * 0.08) + "s";
        d.innerHTML = mode === "t"
          ? '<code>' + r.from + '</code>' + I("arrow") + '<code>' + r.to + '</code><b>' + r.amt + '</b>'
          : '<code class="hid">shielded</code>' + I("arrow") + '<code class="hid">shielded</code><b class="hid">•••• ZEC</b><span class="zk">zk-isbot ✓</span>';
        L.appendChild(d);
      });
      W.innerHTML = mode === "t"
        ? '<p class="bad-t"><b>Kuzatuvchi hammasini bildi:</b></p><ul><li>Bu hisobga oyiga 820 ZEC tushadi — ehtimol maosh.</li><li>Ijara 140.50 ZEC, har oy bir xil manzilga.</li><li>Xarid tarixi va qolgan balans ham ochiq.</li><li>Manzil bir marta kimgadir tegishli bo\'lsa — butun tarix odamga bog\'lanadi.</li></ul>'
        : '<p class="ok-t"><b>Kuzatuvchi nimani biladi?</b></p><ul><li>Tranzaksiya bo\'lganini va <b>qoidaga mos</b> ekanini.</li><li>Summani, yuboruvchini va oluvchini — <b>bilmaydi</b>.</li><li>Tarmoq baribir tekshirishi mumkin: zk-isbot buni ta\'minlaydi.</li></ul><p class="note">Kerak bo\'lsa, <b>ko\'rish kaliti</b> bilan faqat auditorga ochib berasiz.</p>';
      host.querySelector("#pv-leak").disabled = mode !== "z";
    }
    draw("t");
    Array.prototype.forEach.call(host.querySelectorAll(".tg"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(host.querySelectorAll(".tg"), function (x) { x.classList.toggle("on", x === b); });
        draw(b.dataset.m);
        if (b.dataset.m === "z") ctx.done();
      });
    });
    host.querySelector("#pv-leak").addEventListener("click", function () {
      host.querySelector("#pv-watch").innerHTML =
        '<p class="bad-t"><b>Maxfiylik buzildi — sabab: foydalanuvchi.</b></p><ul>' +
        '<li>Ekranlangan mablag\' ochiq t-manzilga chiqdi.</li>' +
        '<li>Kuzatuvchi kirish va chiqish vaqtini, summani solishtirib bog\'liqlikni tikladi.</li>' +
        '<li>Qoida: ekranlangan pulni ekranlangan holatda saqlang.</li></ul>';
      toast("Kriptografiya ishladi, lekin odat buzdi", "bad");
    });
  };

  /* ============ 13) ZANJIRLAR POYGASI ============ */
  D.speed = function (host, ctx) {
    var rows = [
      { id: "btc", n: "Satoshi qal'asi (BTC)", tps: 7, fee: 6.0, fin: 3600, col: "#F7931A" },
      { id: "eth", n: "Etheria (ETH)", tps: 15, fee: 4.2, fin: 780, col: "#8A92FF" },
      { id: "bsc", n: "Binansgrad (BNB)", tps: 100, fee: 0.18, fin: 7, col: "#F0B90B" },
      { id: "polygon", n: "Poligonsk (POL)", tps: 2000, fee: 0.01, fin: 120, col: "#A36CF5" },
      { id: "ton", n: "Telegramgrad (TON)", tps: 1000, fee: 0.006, fin: 6, col: "#3BA3F0" },
      { id: "sol", n: "Tezlik vodiysi (SOL)", tps: 2500, fee: 0.0008, fin: 13, col: "#59F0A8" }
    ];
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("speed") + ' <b>Laboratoriya:</b> tezlik, narx va xavfsizlik' +
      '    <span class="lab-hint">Uchburchak qoidasi: hamma narsani birdan olib bo\'lmaydi</span>' +
      '  </div>' +
      '  <div class="toggle2" id="sp-tabs">' +
      '    <button class="tg on" data-k="tps">Tezlik (TPS)</button>' +
      '    <button class="tg" data-k="fee">Komissiya ($)</button>' +
      '    <button class="tg" data-k="fin">Yakunlanish vaqti</button>' +
      '  </div>' +
      '  <div class="bars big" id="sp-bars"></div>' +
      '  <p class="note" id="sp-note">Diqqat: tez zanjirlar odatda markazlashuv yoki murakkablik bilan to\'laydi. "Eng yaxshi zanjir" yo\'q — vazifaga mos zanjir bor.</p>' +
      '</div>'
    ));
    function draw(k) {
      var max = Math.max.apply(null, rows.map(function (r) { return r[k]; }));
      var box = host.querySelector("#sp-bars");
      box.innerHTML = "";
      rows.slice().sort(function (a, b) { return k === "tps" ? b.tps - a.tps : a[k] - b[k]; }).forEach(function (r, i) {
        var val = k === "tps" ? fmt(r.tps, 0) + " tx/s" : k === "fee" ? "$" + r.fee : (r.fin >= 60 ? (r.fin / 60).toFixed(0) + " daq" : r.fin + " sek");
        var w = Math.max(3, (r[k] / max) * 100);
        box.appendChild(h(
          '<div class="bar-row"><span>' + r.n + '</span>' +
          '<div class="bar"><i style="width:0;background:linear-gradient(90deg,' + r.col + ',' + r.col + '99)" data-w="' + w.toFixed(1) + '"></i></div>' +
          '<b>' + val + '</b></div>'
        ));
      });
      setTimeout(function () {
        Array.prototype.forEach.call(box.querySelectorAll(".bar i"), function (b, i) {
          setTimeout(function () { b.style.width = b.dataset.w + "%"; }, i * 90);
        });
      }, 40);
      var notes = {
        tps: "Tezlik foydali, lekin uni qanday qo'lga kiritgani muhim: parallel ishlov (SOL), rollup (Polygon) yoki kam validator (BSC) — har biri boshqa narxga tushadi.",
        fee: "Komissiya arzon bo'lsa mashq qilish oson. Lekin arzonlik ko'pincha markazlashuv hisobiga keladi.",
        fin: "Yakunlanish (finality) — tranzaksiya \"orqaga qaytmaydi\" deb hisoblanadigan payt. Katta summalarda tezlikdan ko'ra shu muhim."
      };
      host.querySelector("#sp-note").textContent = notes[k];
    }
    draw("tps");
    Array.prototype.forEach.call(host.querySelectorAll("#sp-tabs .tg"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(host.querySelectorAll("#sp-tabs .tg"), function (x) { x.classList.toggle("on", x === b); });
        draw(b.dataset.k);
        ctx.done();
      });
    });
  };

  /* ============ 14) HALVING ============ */
  D.halving = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("vault") + ' <b>Laboratoriya:</b> 21 million qanday to\'ladi' +
      '    <span class="lab-hint">Halvinglarni birma-bir o\'tkazib ko\'ring</span>' +
      '  </div>' +
      '  <canvas id="hv-canvas" width="880" height="300" class="canvas"></canvas>' +
      '  <div class="stat-row">' +
      '    <div class="st"><span>Davr</span><b id="hv-era">1 (2009)</b></div>' +
      '    <div class="st"><span>Blok mukofoti</span><b id="hv-rew">50 BTC</b></div>' +
      '    <div class="st"><span>Chiqarilgan</span><b id="hv-sup">0</b></div>' +
      '    <div class="st ok"><span>Qolgan</span><b id="hv-left">21 000 000</b></div>' +
      '  </div>' +
      '  <div class="lab-actions"><button class="gbtn gbtn-ok" id="hv-next">' + I("arrow") + ' Keyingi halving</button>' +
      '    <button class="gbtn gbtn-ghost" id="hv-all">Hammasini o\'tkazish</button></div>' +
      '  <p class="note" id="hv-note">Har 210 000 blokda mukofot ikki barobar kamayadi. Bu narx kafolati emas — bu taklif jadvali.</p>' +
      '</div>'
    ));
    var cv = host.querySelector("#hv-canvas"), g = cv.getContext("2d");
    var era = 0, supply = 0, pts = [];
    function drawChart() {
      var W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = "rgba(120,160,220,.14)";
      g.lineWidth = 1;
      for (var i = 0; i <= 5; i++) { var y = 20 + i * (H - 50) / 5; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 10, y); g.stroke(); }
      g.fillStyle = "rgba(200,220,255,.5)"; g.font = "11px monospace";
      g.fillText("21 mln", 2, 26); g.fillText("0", 26, H - 26);
      /* to'liq egri chiziq (och) */
      g.beginPath();
      var s = 0, rew = 50;
      for (var e = 0; e < 33; e++) {
        s += 210000 * rew; rew /= 2;
        var x = 40 + (e / 32) * (W - 60), y = H - 30 - (s / 21000000) * (H - 60);
        e ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = "rgba(247,147,26,.25)"; g.lineWidth = 2; g.stroke();
      /* bosib o'tilgan qism */
      if (pts.length) {
        g.beginPath();
        pts.forEach(function (p, i) { i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
        g.strokeStyle = "#F7931A"; g.lineWidth = 3; g.stroke();
        var last = pts[pts.length - 1];
        g.beginPath(); g.arc(last.x, last.y, 5, 0, 7); g.fillStyle = "#FFC46B"; g.fill();
      }
    }
    function step() {
      if (era >= 32) { toast("Barcha 21 million chiqarildi — taxminan 2140-yil", "ok"); return; }
      var rew = 50 / Math.pow(2, era);
      supply += 210000 * rew;
      era++;
      var x = 40 + ((era - 1) / 32) * (cv.width - 60);
      var y = cv.height - 30 - (supply / 21000000) * (cv.height - 60);
      pts.push({ x: x, y: y });
      drawChart();
      host.querySelector("#hv-era").textContent = era + " (" + (2009 + (era - 1) * 4) + ")";
      host.querySelector("#hv-rew").textContent = (50 / Math.pow(2, era)).toFixed(era > 5 ? 4 : 3) + " BTC";
      host.querySelector("#hv-sup").textContent = fmt(supply, 0);
      host.querySelector("#hv-left").textContent = fmt(21000000 - supply, 0);
      if (era === 4) host.querySelector("#hv-note").innerHTML = "E'tibor bering: <b>birinchi 4 davrda</b> deyarli hamma tanga chiqib bo'ldi. Qolgan 100+ yil — juda kichik qoldiqlar uchun.";
      if (era >= 3) ctx.done();
    }
    drawChart();
    host.querySelector("#hv-next").addEventListener("click", step);
    host.querySelector("#hv-all").addEventListener("click", function () {
      var iv = setInterval(function () { step(); if (era >= 32) clearInterval(iv); }, 120);
    });
  };

  /* ============ 15) CEX SAQLOVI ============ */
  D.custody = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("bank") + ' <b>Laboratoriya:</b> kalit kimda?' +
      '    <span class="lab-hint">Ikki holatni sinab ko\'ring: bank va o\'z hamyoni</span>' +
      '  </div>' +
      '  <div class="two">' +
      '    <div class="panel bad-border">' +
      '      <div class="mini-title">' + I("bank") + ' Birjadagi hisob (custodial)</div>' +
      '      <div class="wallet-card"><span>Balans</span><b id="cu-b1">5 000 USDT</b><small>kalit: <b class="bad-t">birjada</b></small></div>' +
      '      <div class="lab-actions">' +
      '        <button class="gbtn gbtn-ghost" id="cu-w1">Yechib olish</button>' +
      '        <button class="gbtn gbtn-bad" id="cu-freeze">Birja hisobni muzlatdi</button>' +
      '      </div>' +
      '      <div class="term small" id="cu-l1"><div>$ hisob ochiq</div></div>' +
      '    </div>' +
      '    <div class="panel ok-border">' +
      '      <div class="mini-title">' + I("key") + ' O\'z hamyoni (non-custodial)</div>' +
      '      <div class="wallet-card"><span>Balans</span><b id="cu-b2">5 000 USDT</b><small>kalit: <b class="ok-t">sizda</b></small></div>' +
      '      <div class="lab-actions">' +
      '        <button class="gbtn gbtn-ghost" id="cu-w2">Yechib olish</button>' +
      '        <button class="gbtn gbtn-bad" id="cu-lose">Seed-frazani yo\'qotdim</button>' +
      '      </div>' +
      '      <div class="term small" id="cu-l2"><div>$ hamyon ulandi</div></div>' +
      '    </div>' +
      '  </div>' +
      '  <p class="note">Ikkisi ham risk — lekin <b>boshqa xil risk</b>: birinchisida ishonch (kompaniyaga), ikkinchisida javobgarlik (o\'zingizga).</p>' +
      '</div>'
    ));
    var frozen = false, lost = false;
    function put(sel, t) { var l = host.querySelector(sel); var d = document.createElement("div"); d.innerHTML = t; l.appendChild(d); l.scrollTop = l.scrollHeight; }
    host.querySelector("#cu-w1").addEventListener("click", function () {
      if (frozen) { put("#cu-l1", "<span class='bad-t'>✗ Rad etildi:</span> \"hisob tekshiruvda, 30 kun kuting\""); return; }
      put("#cu-l1", "<span class='ok-t'>✓ 5 000 USDT chiqarildi</span> — birja ruxsat berdi");
      ctx.done();
    });
    host.querySelector("#cu-freeze").addEventListener("click", function () {
      frozen = true;
      host.querySelector("#cu-b1").classList.add("bad-t");
      host.querySelector("#cu-b1").textContent = "5 000 USDT 🔒";
      put("#cu-l1", "<span class='bad-t'>Hisob muzlatildi.</span> Balans ko'rinadi, lekin harakatlantirilmaydi. Kalit sizda bo'lmagani uchun tanlov ham sizda emas.");
      toast("\"Kalit sizda bo'lmasa, tanga ham sizda emas\"", "bad");
      ctx.done();
    });
    host.querySelector("#cu-w2").addEventListener("click", function () {
      if (lost) { put("#cu-l2", "<span class='bad-t'>✗ Imkonsiz:</span> kalit yo'q — hisobni hech kim tiklab bera olmaydi"); return; }
      put("#cu-l2", "<span class='ok-t'>✓ O'tkazma bajarildi</span> — ruxsat faqat sizdan so'raldi");
      ctx.done();
    });
    host.querySelector("#cu-lose").addEventListener("click", function () {
      lost = true;
      put("#cu-l2", "<span class='bad-t'>Kalit yo'qoldi.</span> Mablag' zanjirda ko'rinib turadi, lekin unga hech kim tega olmaydi — na siz, na boshqa odam. Shuning uchun seed nusxasi ikki joyda, qog'ozda saqlanadi.");
      toast("Non-custodial risk: javobgarlik to'liq sizda", "bad");
    });
  };

  /* ============ 16) TUZOQLAR POLIGONI ============ */
  D.traps = function (host, ctx) {
    var st = LT.Engine.state;
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("warning") + ' <b>Poligon:</b> tuzoqlar ustma-ust keladi' +
      '    <span class="lab-hint">Uch holat ketma-ket. To\'g\'ri tanlov — ball, xato — tushuntirish</span>' +
      '  </div>' +
      '  <div class="trap-stats">' +
      '    <div class="st ok"><span>Qutulgan</span><b id="tp-ok">0</b></div>' +
      '    <div class="st bad"><span>Tushgan</span><b id="tp-bad">0</b></div>' +
      '    <div class="st"><span>Jami tuzoq</span><b>' + LT.DATA.traps.length + '</b></div>' +
      '  </div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-bad" id="tp-run">' + I("play") + ' 3 tuzoqni ishga tushirish</button>' +
      '    <button class="gbtn gbtn-ghost" id="tp-one">Bitta tasodifiy tuzoq</button>' +
      '  </div>' +
      '  <div class="trap-list" id="tp-list"></div>' +
      '</div>'
    ));
    function refresh() {
      host.querySelector("#tp-ok").textContent = LT.Engine.trapsAvoided();
      host.querySelector("#tp-bad").textContent = LT.Engine.trapsHit();
      var list = host.querySelector("#tp-list");
      list.innerHTML = "";
      LT.DATA.traps.forEach(function (t) {
        var s = LT.Engine.state.traps[t.id];
        list.appendChild(h('<div class="tl-row ' + (s || "new") + '">' + LT.icon(t.icon) + '<span>' + t.title + '</span><b>' +
          (s === "ok" ? "qutuldingiz" : s === "fail" ? "tushdingiz" : "hali ko'rilmagan") + '</b></div>'));
      });
    }
    refresh();
    host.querySelector("#tp-run").addEventListener("click", function () {
      LT.UI.runTrapSeries(3, function () { refresh(); ctx.done(); });
    });
    host.querySelector("#tp-one").addEventListener("click", function () {
      LT.UI.runTrapSeries(1, function () { refresh(); ctx.done(); });
    });
  };

  /* ============ 17) CHAINSHIELD TERMINALI ============ */
  D.shield = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("shield") + ' <b>Laboratoriya:</b> to\'liq audit terminali' +
      '    <span class="lab-hint">Alohida sahifada ochiladi</span>' +
      '  </div>' +
      '  <div class="shield-card">' +
      '    <div>' +
      '      <h4>CHAINSHIELD // Terminal v1.0</h4>' +
      '      <p>Shartnoma auditi (honeypot, yashirin soliq, qulflanmagan likvidlik), "VIP signal va haqiqat" grafigi va P2P tuzog\'ining pul oqimi — uchtasi bitta panelda.</p>' +
      '      <div class="lab-actions">' +
      '        <a class="gbtn gbtn-ok" href="../terminal.html" target="_blank" rel="noopener" id="sh-open">' + I("bolt") + ' Terminalni ochish</a>' +
      '      </div>' +
      '    </div>' +
      '    <div class="shield-check">' +
      '      <b>10 nuqtali tekshiruv</b>' +
      '      <ol>' +
      '        <li>Kod tasdiqlanganmi?</li><li>Likvidlik qulflanganmi?</li><li>Owner huquqi topshirilganmi?</li>' +
      '        <li>Top-10 hamyon necha foiz?</li><li>Sotish tranzaksiyalari bormi?</li><li>Soliq o\'zgartiriladimi?</li>' +
      '        <li>Mint funksiyasi ochiqmi?</li><li>Jamoa ochiqmi?</li><li>Daromad qayerdan keladi?</li><li>Shoshiltirish bormi?</li>' +
      '      </ol>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    ));
    host.querySelector("#sh-open").addEventListener("click", function () { ctx.done(); });
  };
})();
