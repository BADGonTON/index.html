/* ============================================================
   KRIPTO OLAMI — interaktiv laboratoriyalar (animatsion demolar)
   Har bir demo: fn(host, ctx) — ctx.done() bajarilganda ball beradi
   ============================================================ */
(function () {
  "use strict";

  var I = LT.icon;

  /* ---------- yordamchilar ---------- */
  function h(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }
  function fmt(n, d) {
    if (n === undefined || n === null || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 2 : d });
  }
  /* oddiy, tez hash (o'quv maqsadida) */
  function hash(str) {
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i);
      h1 = (h1 * 16777619) >>> 0;
      h2 = ((h2 << 5) + h2 + str.charCodeAt(i)) >>> 0;
    }
    var a = h1.toString(16).padStart(8, "0");
    var b = h2.toString(16).padStart(8, "0");
    var c = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
    return (a + b + c).slice(0, 24);
  }
  function toast(msg, kind) { LT.UI.toast(msg, kind); }

  var Demos = {};

  /* ============================================================
     1) HASH VA ZANJIR
     ============================================================ */
  Demos.hash = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("cube") + ' <b>Laboratoriya:</b> blokni buzib ko\'ring' +
      '    <span class="lab-hint">1-blok matnini o\'zgartiring va zanjirga nima bo\'lishini kuzating</span>' +
      '  </div>' +
      '  <div class="chain-row" id="chain-row"></div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ghost" id="h-fix">' + I("reset") + ' Zanjirni qayta hisoblash</button>' +
      '    <span class="lab-status" id="h-status">Zanjir butun: har blokning muhri joyida.</span>' +
      '  </div>' +
      '</div>'
    ));

    var blocks = [
      { n: 1, data: "Ali → Vali: 50 TON" },
      { n: 2, data: "Vali → Zuhra: 12 TON" },
      { n: 3, data: "Zuhra → Ali: 3 TON" }
    ];
    var row = host.querySelector("#chain-row");
    var status = host.querySelector("#h-status");
    var broke = false;

    function recompute(fixAll) {
      var prev = "0000000000000000";
      blocks.forEach(function (b) {
        b.prev = prev;
        b.hash = hash(b.n + b.data + prev);
        if (fixAll) b.storedPrev = prev;
        prev = b.hash;
      });
      if (fixAll) blocks.forEach(function (b) { b.storedPrev = b.prev; });
    }
    recompute(true);

    function draw() {
      row.innerHTML = "";
      blocks.forEach(function (b, i) {
        var valid = b.storedPrev === b.prev;
        var card = h(
          '<div class="blk ' + (valid ? "ok" : "bad") + '">' +
          '  <div class="blk-top"><span>BLOK #' + b.n + '</span><span class="blk-dot"></span></div>' +
          '  <label>Ma\'lumot' +
          '    <input type="text" value="' + b.data.replace(/"/g, "&quot;") + '" data-i="' + i + '">' +
          '  </label>' +
          '  <div class="blk-f"><span>Oldingi muhr</span><code>' + b.storedPrev.slice(0, 16) + '</code></div>' +
          '  <div class="blk-f"><span>Bu blok muhri</span><code class="hl">' + b.hash.slice(0, 16) + '</code></div>' +
          '  <div class="blk-badge">' + (valid ? I("check") + " to'g'ri" : I("xmark") + " buzilgan") + '</div>' +
          '</div>'
        );
        row.appendChild(card);
        if (i < blocks.length - 1) row.appendChild(h('<div class="blk-link ' + (blocks[i + 1].storedPrev === blocks[i + 1].prev ? "" : "cut") + '">⛓</div>'));
      });
      Array.prototype.forEach.call(row.querySelectorAll("input"), function (inp) {
        inp.addEventListener("input", function () {
          blocks[+this.dataset.i].data = this.value;
          recompute(false);
          var bad = blocks.filter(function (b) { return b.storedPrev !== b.prev; }).length;
          draw();
          if (bad) {
            status.innerHTML = "<b class='bad-t'>Zanjir buzildi:</b> " + bad + " blokning ko'chirma muhri to'g'ri kelmayapti. Tarmoq bu nusxani rad etadi.";
            if (!broke) { broke = true; ctx.done(); toast("Siz zanjirni buzdingiz — endi nega bu imkonsizligini bilasiz", "ok"); }
          } else {
            status.innerHTML = "Zanjir butun: har blokning muhri joyida.";
          }
        });
      });
    }
    draw();

    host.querySelector("#h-fix").addEventListener("click", function () {
      recompute(true);
      draw();
      status.innerHTML = "Barcha bloklar qayta hisoblandi. Haqiqiy tarmoqda buni qilish uchun dunyodagi maynerlarning yarmidan ko'pini ortda qoldirish kerak bo'ladi.";
      toast("Qayta hisoblandi — lekin tarmoqda bu 'yarim dunyoni ortda qoldirish' degani", "info");
    });
  };

  /* ============================================================
     2) SMART-KONTRAKT (honeypot)
     ============================================================ */
  Demos.contract = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("contract") + ' <b>Laboratoriya:</b> kontrakt ichida nima yozilgan?' +
      '    <span class="lab-hint">Avval sotib oling, keyin sotishga harakat qiling</span>' +
      '  </div>' +
      '  <div class="two">' +
      '    <div class="panel">' +
      '      <div class="mini-title">MOONX tokeni</div>' +
      '      <div class="big-num" id="c-bal">0 MOONX</div>' +
      '      <div class="lab-actions">' +
      '        <button class="gbtn gbtn-ok" id="c-buy">' + I("bolt") + ' Sotib olish (100$)</button>' +
      '        <button class="gbtn gbtn-bad" id="c-sell">' + I("swap") + ' Sotish</button>' +
      '      </div>' +
      '      <div class="term" id="c-log"><div>$ kontrakt yuklandi: 0x71C4...9B3F</div></div>' +
      '    </div>' +
      '    <div class="panel">' +
      '      <div class="mini-title">Kontrakt kodi</div>' +
      '      <pre class="code"><span class="c-cmt">// sotib olish — hammaga ruxsat</span>\nfunction <span class="c-fn">buy</span>() { _balance[msg.sender] += amt; }\n\n<span class="c-cmt">// sotish — faqat egaga ruxsat</span>\nfunction <span class="c-fn">sell</span>() {\n  <span class="c-bad">require(_canSell[msg.sender], "FAILED");</span>\n}</pre>' +
      '      <p class="note">Uchinchi qator — butun tuzoqning o\'zi. <code>_canSell</code> ro\'yxatida faqat kontrakt egasi bor.</p>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    ));
    var bal = 0, tries = 0;
    var out = host.querySelector("#c-bal"), log = host.querySelector("#c-log");
    function line(t, cls) {
      var d = document.createElement("div");
      if (cls) d.className = cls;
      d.innerHTML = t;
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    host.querySelector("#c-buy").addEventListener("click", function () {
      bal += 4200000;
      out.textContent = fmt(bal, 0) + " MOONX";
      out.classList.remove("flash"); void out.offsetWidth; out.classList.add("flash");
      line("<span class='ok-t'>✓ buy() bajarildi</span> — 4 200 000 MOONX qo'shildi. Grafik yuqoriga ketdi.");
    });
    host.querySelector("#c-sell").addEventListener("click", function () {
      tries++;
      line("<span class='bad-t'>✗ sell() rad etildi:</span> \"TRANSFER_FAILED\" — sotish ruxsati yo'q.");
      if (tries === 1) toast("Sotish ishlamadi. Bu honeypot.", "bad");
      if (tries === 2) {
        line("<span class='warn-t'>Xulosa:</span> tokenni sotib olish mumkin, sotish mumkin emas. Grafik faqat o'sadi, chunki chiqish yo'q.");
        ctx.done();
      }
    });
  };

  /* ============================================================
     3) LIKVIDLIK PULI (DEX)
     ============================================================ */
  Demos.pool = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("market") + ' <b>Laboratoriya:</b> likvidlik pulida narx qanday siljiydi' +
      '    <span class="lab-hint">Xarid hajmini o\'zgartirib slippage\'ni kuzating</span>' +
      '  </div>' +
      '  <div class="pool-vis">' +
      '    <div class="jar"><div class="jar-fill" id="j-a"></div><span>TOKEN</span><b id="j-at">10 000</b></div>' +
      '    <div class="jar-mid">' + I("swap") + '</div>' +
      '    <div class="jar"><div class="jar-fill usdt" id="j-b"></div><span>USDT</span><b id="j-bt">10 000</b></div>' +
      '  </div>' +
      '  <div class="slider-row">' +
      '    <label>Xarid hajmi: <b id="p-amt">500</b> USDT</label>' +
      '    <input type="range" id="p-range" min="50" max="9000" step="50" value="500">' +
      '  </div>' +
      '  <div class="stat-row">' +
      '    <div class="st"><span>Boshlang\'ich narx</span><b>1.00 $</b></div>' +
      '    <div class="st"><span>Siz olgan o\'rtacha narx</span><b id="p-avg">—</b></div>' +
      '    <div class="st"><span>Yangi narx</span><b id="p-new">—</b></div>' +
      '    <div class="st bad"><span>Slippage (yo\'qotish)</span><b id="p-slip">—</b></div>' +
      '  </div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ok" id="p-buy">' + I("bolt") + ' Xarid qilish</button>' +
      '    <button class="gbtn gbtn-bad" id="p-rug">' + I("fire") + ' Egasi likvidlikni olib qo\'ydi (rug pull)</button>' +
      '    <button class="gbtn gbtn-ghost" id="p-reset">' + I("reset") + ' Qaytadan</button>' +
      '  </div>' +
      '  <div class="term" id="p-log"><div>$ pul: 10 000 TOKEN / 10 000 USDT — narx 1.00$</div></div>' +
      '</div>'
    ));

    var A = 10000, B = 10000, did = false;
    var r = host.querySelector("#p-range"), log = host.querySelector("#p-log");
    function line(t) { var d = document.createElement("div"); d.innerHTML = t; log.appendChild(d); log.scrollTop = log.scrollHeight; }
    function jars() {
      host.querySelector("#j-at").textContent = fmt(A, 0);
      host.querySelector("#j-bt").textContent = fmt(B, 0);
      host.querySelector("#j-a").style.height = Math.max(4, Math.min(100, A / 200)) + "%";
      host.querySelector("#j-b").style.height = Math.max(4, Math.min(100, B / 200)) + "%";
    }
    function preview() {
      var amt = +r.value;
      host.querySelector("#p-amt").textContent = fmt(amt, 0);
      if (A <= 0 || B <= 0) return;
      var k = A * B;
      var newB = B + amt, newA = k / newB;
      var got = A - newA;
      var avg = amt / got;
      var newPrice = newB / newA;
      host.querySelector("#p-avg").textContent = avg.toFixed(4) + " $";
      host.querySelector("#p-new").textContent = newPrice.toFixed(4) + " $";
      var slip = ((avg / (B / A)) - 1) * 100;
      var sl = host.querySelector("#p-slip");
      sl.textContent = slip.toFixed(1) + " %";
      sl.parentElement.classList.toggle("danger", slip > 15);
    }
    r.addEventListener("input", preview);
    jars(); preview();

    host.querySelector("#p-buy").addEventListener("click", function () {
      if (A <= 0) { toast("Pul bo'sh — sotib olish uchun likvidlik yo'q", "bad"); return; }
      var amt = +r.value, k = A * B;
      var newB = B + amt, newA = k / newB, got = A - newA;
      var avg = amt / got, slip = ((avg / (B / A)) - 1) * 100;
      A = newA; B = newB;
      jars(); preview();
      line("Xarid: " + fmt(amt, 0) + " USDT → " + fmt(got, 0) + " TOKEN · o'rtacha narx " + avg.toFixed(4) + "$ · slippage <b class='" + (slip > 15 ? "bad-t" : "warn-t") + "'>" + slip.toFixed(1) + "%</b>");
      if (slip > 25) line("<span class='bad-t'>Diqqat:</span> siz narxni o'zingiz ko'tardingiz. Chiqishda xuddi shu narsa teskari tomonga ishlaydi.");
      if (!did) { did = true; ctx.done(); }
    });
    host.querySelector("#p-rug").addEventListener("click", function () {
      A = 20; B = 15; jars();
      host.querySelector("#p-avg").textContent = "—";
      host.querySelector("#p-new").textContent = "0.0001 $";
      line("<span class='bad-t'>RUG PULL:</span> likvidlik olib ketildi. Idishda 15 USDT qoldi — tokeningizni sotib oladigan hech kim yo'q.");
      toast("Rug pull: token qo'lingizda qoldi, xaridor yo'q", "bad");
      ctx.done();
    });
    host.querySelector("#p-reset").addEventListener("click", function () {
      A = 10000; B = 10000; jars(); preview();
      line("$ pul tiklandi: 10 000 / 10 000");
    });
  };

  /* ============================================================
     4) TOKEN ZAVODI
     ============================================================ */
  Demos.factory = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("factory") + ' <b>Laboratoriya:</b> o\'z tokeningizni chiqaring' +
      '    <span class="lab-hint">Bir necha daqiqada "o\'z tangam bor" degan loyiha tug\'iladi</span>' +
      '  </div>' +
      '  <div class="two">' +
      '    <div class="panel">' +
      '      <label class="fl">Token nomi<input type="text" id="f-name" value="LIDER" maxlength="10"></label>' +
      '      <label class="fl">Emissiya: <b id="f-sup-t">420 000 000 000</b>' +
      '        <input type="range" id="f-sup" min="6" max="12" step="1" value="11">' +
      '      </label>' +
      '      <label class="fl">Jamoa qo\'lidagi ulush: <b id="f-team-t">40%</b>' +
      '        <input type="range" id="f-team" min="0" max="90" step="5" value="40">' +
      '      </label>' +
      '      <label class="fl">Likvidlikka qo\'yiladigan pul: <b id="f-liq-t">3 000$</b>' +
      '        <input type="range" id="f-liq" min="500" max="50000" step="500" value="3000">' +
      '      </label>' +
      '      <button class="gbtn gbtn-ok" id="f-mint">' + I("hammer") + ' Tokenni chiqarish</button>' +
      '    </div>' +
      '    <div class="panel">' +
      '      <div class="mini-title">Natija</div>' +
      '      <div class="stat-row col">' +
      '        <div class="st"><span>Bozor "kapitalizatsiyasi"</span><b id="f-mc">—</b></div>' +
      '        <div class="st"><span>Haqiqiy likvidlik</span><b id="f-liq2">—</b></div>' +
      '        <div class="st bad"><span>Jamoa bir kunda sotsa</span><b id="f-dump">—</b></div>' +
      '        <div class="st"><span>Chiqarish narxi</span><b id="f-cost">—</b></div>' +
      '      </div>' +
      '      <div class="bars" id="f-bars"></div>' +
      '      <p class="note" id="f-note">Tokenni chiqarib ko\'ring va ikkita raqamni taqqoslang: reklamada ko\'rsatiladigan "kapitalizatsiya" va haqiqatda idishda turgan pul.</p>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    ));

    var sup = host.querySelector("#f-sup"), team = host.querySelector("#f-team"), liq = host.querySelector("#f-liq");
    function supply() { return Math.pow(10, +sup.value) * 4.2; }
    function upd() {
      host.querySelector("#f-sup-t").textContent = fmt(supply(), 0);
      host.querySelector("#f-team-t").textContent = team.value + "%";
      host.querySelector("#f-liq-t").textContent = fmt(+liq.value, 0) + "$";
    }
    [sup, team, liq].forEach(function (i) { i.addEventListener("input", upd); });
    upd();

    host.querySelector("#f-mint").addEventListener("click", function () {
      var S = supply(), L = +liq.value, T = +team.value;
      var price = L / (S * 0.02);
      var mc = price * S;
      var dump = L * 0.92;
      host.querySelector("#f-mc").textContent = "$" + fmt(mc, 0);
      host.querySelector("#f-liq2").textContent = "$" + fmt(L, 0);
      host.querySelector("#f-dump").textContent = "narx −" + (98 - (100 - T) * 0.1).toFixed(0) + "% → sizga $" + fmt(dump, 0);
      host.querySelector("#f-cost").textContent = "~$" + fmt(12 + Math.random() * 20, 0) + " (gas)";
      var ratio = Math.max(1, mc / Math.max(1, L));
      host.querySelector("#f-bars").innerHTML =
        '<div class="bar-row"><span>Reklamadagi "kapitalizatsiya"</span><div class="bar"><i style="width:100%;background:linear-gradient(90deg,#e05a6a,#ff9d5c)"></i></div><b>$' + fmt(mc, 0) + '</b></div>' +
        '<div class="bar-row"><span>Haqiqiy likvidlik</span><div class="bar"><i style="width:' + Math.max(0.6, 100 / ratio).toFixed(2) + '%;background:linear-gradient(90deg,#59f0a8,#7cd9ff)"></i></div><b>$' + fmt(L, 0) + '</b></div>';
      host.querySelector("#f-note").innerHTML =
        "<b>" + host.querySelector("#f-name").value + "</b> tokeni tayyor. Reklamada <b>$" + fmt(mc, 0) +
        "</b> deb yoziladi, lekin idishda faqat <b>$" + fmt(L, 0) + "</b> bor — ya'ni " + fmt(ratio, 0) +
        " barobar farq. Jamoa qo'lidagi " + T + "% bir kunda sotilsa, narx nolga yaqinlashadi va siz chiqa olmaysiz.";
      toast("Token chiqarildi — endi \"o'z tangamiz bor\" degan gapning qiymatini bilasiz", "ok");
      ctx.done();
    });
  };

  /* ============================================================
     5) NFT
     ============================================================ */
  Demos.nft = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("gallery") + ' <b>Laboratoriya:</b> NFT nimani saqlaydi?' +
      '    <span class="lab-hint">NFT yarating, keyin rasm serverini o\'chiring</span>' +
      '  </div>' +
      '  <div class="two">' +
      '    <div class="panel nft-panel">' +
      '      <div class="nft-frame" id="n-frame"><div class="nft-art" id="n-art"></div><div class="nft-broken" id="n-broken">' + I("ban") + ' rasm topilmadi<br><span>server javob bermadi</span></div></div>' +
      '      <div class="lab-actions">' +
      '        <button class="gbtn gbtn-ok" id="n-mint">' + I("hammer") + ' NFT yaratish (mint)</button>' +
      '        <button class="gbtn gbtn-bad" id="n-kill" disabled>' + I("ban") + ' Rasm serverini o\'chirish</button>' +
      '      </div>' +
      '    </div>' +
      '    <div class="panel">' +
      '      <div class="mini-title">Zanjirda nima yozildi?</div>' +
      '      <pre class="code" id="n-meta">— hali mint qilinmagan —</pre>' +
      '      <p class="note" id="n-note">Diqqat qiling: zanjirda <b>rasm emas</b>, rasmga <b>havola</b> yoziladi.</p>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    ));
    var art = host.querySelector("#n-art"), broken = host.querySelector("#n-broken");
    var killBtn = host.querySelector("#n-kill");
    host.querySelector("#n-mint").addEventListener("click", function () {
      var id = 1000 + Math.floor(Math.random() * 8999);
      art.className = "nft-art gen" + (1 + Math.floor(Math.random() * 4));
      art.style.display = "block"; broken.style.display = "none";
      killBtn.disabled = false;
      host.querySelector("#n-meta").innerHTML =
        '{\n  "tokenId": ' + id + ',\n  "owner": "<span class="c-fn">0x71C4...9B3F</span>",\n' +
        '  "name": "Lider Badger #' + id + '",\n  "image": "<span class="c-bad">https://cdn.loyiha.site/' + id + '.png</span>"\n}';
      host.querySelector("#n-note").innerHTML = "NFT sizga tegishli — bu zanjirda yozilgan. Lekin <b>image</b> qatoriga qarang: rasm oddiy serverda turadi.";
      toast("NFT yaratildi. Endi serverni o'chirib ko'ring.", "info");
    });
    killBtn.addEventListener("click", function () {
      art.style.display = "none"; broken.style.display = "grid";
      host.querySelector("#n-note").innerHTML =
        "<b class='bad-t'>Rasm yo'qoldi, guvohnoma qoldi.</b> Zanjirdagi yozuv joyida, lekin u faqat havolani saqlagan. " +
        "Shu sababli yaxshi loyihalar rasmni IPFS kabi tarqatilgan saqlashda yoki to'g'ridan-to'g'ri zanjir ichida (on-chain SVG) qo'yadi.";
      toast("Server o'chdi — NFT bo'sh ramkaga aylandi", "bad");
      ctx.done();
    });
  };

  /* ============================================================
     6) STAKING
     ============================================================ */
  Demos.stake = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("stake") + ' <b>Laboratoriya:</b> haqiqiy staking va "kuniga 3%"' +
      '    <span class="lab-hint">Ikkisini yonma-yon ishga tushirib ko\'ring</span>' +
      '  </div>' +
      '  <div class="slider-row"><label>Garov: <b id="s-amt">1 000</b> TON</label>' +
      '    <input type="range" id="s-range" min="100" max="20000" step="100" value="1000"></div>' +
      '  <div class="two">' +
      '    <div class="panel ok-border">' +
      '      <div class="mini-title">' + I("check") + ' Haqiqiy staking (yillik ~5%)</div>' +
      '      <div class="big-num" id="s-real">0.00 TON</div>' +
      '      <div class="spark" id="s-spark1"></div>' +
      '      <p class="note">Mukofot tarmoq emissiyasi va komissiyalardan keladi. Manbasi bor.</p>' +
      '    </div>' +
      '    <div class="panel bad-border">' +
      '      <div class="mini-title">' + I("warning") + ' "Kuniga 3% kafolatlangan"</div>' +
      '      <div class="big-num bad-t" id="s-scam">0.00 TON</div>' +
      '      <div class="spark" id="s-spark2"></div>' +
      '      <p class="note" id="s-note">Manba: yangi kelganlarning puli. Piramida hisob-kitobi.</p>' +
      '    </div>' +
      '  </div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ok" id="s-run">' + I("play") + ' 365 kunni tezlashtirib ko\'rish</button>' +
      '    <span class="lab-status" id="s-day">0-kun</span>' +
      '  </div>' +
      '</div>'
    ));
    var range = host.querySelector("#s-range");
    range.addEventListener("input", function () { host.querySelector("#s-amt").textContent = fmt(+range.value, 0); });
    var running = false;

    host.querySelector("#s-run").addEventListener("click", function () {
      if (running) return;
      running = true;
      var base = +range.value, day = 0, real = base, scam = base, dead = 0;
      var sp1 = host.querySelector("#s-spark1"), sp2 = host.querySelector("#s-spark2");
      sp1.innerHTML = ""; sp2.innerHTML = "";
      var iv = setInterval(function () {
        day++;
        real = real * (1 + 0.05 / 365);
        if (!dead) scam = scam * 1.03;
        if (day === 47) { dead = 1; host.querySelector("#s-note").innerHTML = "<b class='bad-t'>47-kun: to'lovlar to'xtadi.</b> Yangi kelganlar oqimi kamayishi bilan piramida qulaydi — hisobda ko'ringan raqam chiqarib bo'lmaydigan raqamga aylanadi."; }
        host.querySelector("#s-real").textContent = fmt(real - base, 2) + " TON";
        host.querySelector("#s-scam").textContent = dead ? "0.00 TON (yechib bo'lmaydi)" : fmt(scam - base, 2) + " TON";
        host.querySelector("#s-day").textContent = day + "-kun";
        if (day % 6 === 0) {
          var b1 = document.createElement("i"); b1.style.height = Math.min(100, (real - base) / base * 900 + 3) + "%"; sp1.appendChild(b1);
          var b2 = document.createElement("i"); b2.style.height = dead ? "2%" : Math.min(100, (scam - base) / base * 22 + 3) + "%";
          b2.className = dead ? "dead" : ""; sp2.appendChild(b2);
        }
        if (day >= 365) { clearInterval(iv); running = false; ctx.done(); toast("Bir yil o'tdi: haqiqiy staking — kichik, lekin bor. Piramida — 47-kunda tugadi.", "ok"); }
      }, 18);
    });
  };

  /* ============================================================
     7) KO'PRIK
     ============================================================ */
  Demos.bridge = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("bridge") + ' <b>Laboratoriya:</b> ko\'prik qanday ishlaydi' +
      '    <span class="lab-hint">Lock → Mint → Burn → Unlock</span>' +
      '  </div>' +
      '  <div class="bridge-vis">' +
      '    <div class="bshore left"><b>Etheria</b><div class="bwallet" id="b-l">1.0 ETH</div><div class="bvault" id="b-vault">Seyf: bo\'sh</div></div>' +
      '    <div class="bspan"><div class="btrack"><div class="bpacket" id="b-pkt">' + I("coin") + '</div></div><div class="bsteps" id="b-steps"></div></div>' +
      '    <div class="bshore right"><b>Poligonsk</b><div class="bwallet" id="b-r">0.0 WETH</div><div class="bvault" id="b-mint">Chiqarilgan: 0</div></div>' +
      '  </div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ok" id="b-go">' + I("arrow") + ' Ko\'prikdan o\'tkazish</button>' +
      '    <button class="gbtn gbtn-ghost" id="b-back" disabled>' + I("back") + ' Qaytarish (burn → unlock)</button>' +
      '    <button class="gbtn gbtn-bad" id="b-hack" disabled>' + I("fire") + ' Ko\'prik buzildi</button>' +
      '  </div>' +
      '  <div class="term" id="b-log"><div>$ ikkita zanjir bir-birini ko\'rmaydi — o\'tish uchun ko\'prik kerak</div></div>' +
      '</div>'
    ));
    var log = host.querySelector("#b-log"), pkt = host.querySelector("#b-pkt");
    var steps = host.querySelector("#b-steps");
    function line(t) { var d = document.createElement("div"); d.innerHTML = t; log.appendChild(d); log.scrollTop = log.scrollHeight; }
    function setStep(t) { steps.textContent = t; }

    host.querySelector("#b-go").addEventListener("click", function () {
      this.disabled = true;
      setStep("1. LOCK — aktiv Etheriada qulflanadi");
      host.querySelector("#b-l").textContent = "0.0 ETH";
      host.querySelector("#b-vault").textContent = "Seyf: 1.0 ETH 🔒";
      line("<span class='warn-t'>lock()</span> — 1.0 ETH ko'prik kontraktida qulflandi");
      pkt.classList.add("move");
      setTimeout(function () {
        setStep("2. MINT — Poligonskda tilxat chiqariladi");
        host.querySelector("#b-r").textContent = "1.0 WETH";
        host.querySelector("#b-mint").textContent = "Chiqarilgan: 1.0 WETH";
        line("<span class='ok-t'>mint()</span> — Poligonskda 1.0 WETH chiqarildi. Bu ETH emas, <b>ETH tilxati</b>.");
        host.querySelector("#b-back").disabled = false;
        host.querySelector("#b-hack").disabled = false;
        ctx.done();
      }, 1700);
    });
    host.querySelector("#b-back").addEventListener("click", function () {
      setStep("3. BURN → UNLOCK — tilxat yoqiladi, asl aktiv ochiladi");
      pkt.classList.remove("move"); pkt.classList.add("move-back");
      host.querySelector("#b-r").textContent = "0.0 WETH";
      host.querySelector("#b-mint").textContent = "Chiqarilgan: 0";
      setTimeout(function () {
        host.querySelector("#b-l").textContent = "1.0 ETH";
        host.querySelector("#b-vault").textContent = "Seyf: bo'sh";
        line("<span class='ok-t'>burn() + unlock()</span> — tilxat yoqildi, 1.0 ETH qaytarildi. Aylanish yopildi.");
      }, 1400);
    });
    host.querySelector("#b-hack").addEventListener("click", function () {
      host.querySelector("#b-vault").textContent = "Seyf: BO'SHATILDI ⚠";
      host.querySelector("#b-vault").classList.add("bad-t");
      line("<span class='bad-t'>EXPLOIT:</span> ko'prik seyfi bo'shatildi. Poligonskdagi 1.0 WETH qog'ozda qoldi — ortida aktiv yo'q, narx nolga tushdi.");
      setStep("Tilxat — chiqargan tizimga bog'liq risk");
      toast("Ko'prik xavfi: tilxat faqat seyf to'la turganida qiymatga ega", "bad");
      ctx.done();
    });
  };

  /* ============================================================
     8) ROLLUP (L2)
     ============================================================ */
  Demos.rollup = function (host, ctx) {
    host.appendChild(h(
      '<div class="lab">' +
      '  <div class="lab-head">' + I("layers") + ' <b>Laboratoriya:</b> nega L2 arzon?' +
      '    <span class="lab-hint">Tranzaksiyalarni bitta paketga yig\'ib ko\'ring</span>' +
      '  </div>' +
      '  <div class="roll-vis">' +
      '    <div class="roll-l2"><span>L2 — Poligonsk</span><div class="tx-pool" id="r-pool"></div></div>' +
      '    <div class="roll-arrow" id="r-arrow">' + I("arrow") + ' bitta paket</div>' +
      '    <div class="roll-l1"><span>L1 — Etheria</span><div class="l1-block" id="r-block">bo\'sh blok</div></div>' +
      '  </div>' +
      '  <div class="stat-row">' +
      '    <div class="st"><span>Tranzaksiya soni</span><b id="r-n">0</b></div>' +
      '    <div class="st"><span>L1\'da to\'lanadigan umumiy narx</span><b id="r-total">$0</b></div>' +
      '    <div class="st ok"><span>Bitta odamga tushadigan narx</span><b id="r-each">—</b></div>' +
      '  </div>' +
      '  <div class="lab-actions">' +
      '    <button class="gbtn gbtn-ghost" id="r-add">+ 50 tranzaksiya</button>' +
      '    <button class="gbtn gbtn-ok" id="r-batch">' + I("layers") + ' Paketni L1\'ga yuborish</button>' +
      '  </div>' +
      '  <p class="note" id="r-note">Marshrutka printsipi: yo\'l puli bitta, yo\'lovchi ko\'p.</p>' +
      '</div>'
    ));
    var n = 0, pool = host.querySelector("#r-pool");
    host.querySelector("#r-add").addEventListener("click", function () {
      for (var i = 0; i < 50; i++) {
        var d = document.createElement("i");
        d.style.animationDelay = (Math.random() * 0.6).toFixed(2) + "s";
        pool.appendChild(d);
      }
      n += 50;
      host.querySelector("#r-n").textContent = fmt(n, 0);
      host.querySelector("#r-total").textContent = "$18.40";
      host.querySelector("#r-each").textContent = "$" + (18.4 / n).toFixed(4);
    });
    host.querySelector("#r-batch").addEventListener("click", function () {
      if (!n) { toast("Avval tranzaksiya qo'shing", "info"); return; }
      host.querySelector("#r-arrow").classList.add("fire");
      pool.classList.add("suck");
      var blk = host.querySelector("#r-block");
      blk.textContent = n + " tranzaksiya · 1 isbot";
      blk.classList.add("filled");
      host.querySelector("#r-note").innerHTML =
        "<b>" + n + "</b> ta tranzaksiya L1'ga <b>bitta</b> yozuv bo'lib tushdi. L1 narxi o'zgarmadi ($18.40), " +
        "lekin u " + n + " kishiga bo'lindi: har biriga <b>$" + (18.4 / n).toFixed(4) + "</b>. " +
        "Xavfsizlik esa L1'dan keladi — shuning uchun rollup \"Ethereum xavfsizligiga tayanadi\" deyiladi.";
      toast("Paket yuborildi: " + n + " tranzaksiya → 1 L1 yozuvi", "ok");
      ctx.done();
    });
  };

  LT.Demos = Demos;
  LT.demoHelpers = { h: h, fmt: fmt, hash: hash, toast: toast };
})();
