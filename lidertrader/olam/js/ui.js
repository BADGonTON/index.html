/* ============================================================
   KRIPTO OLAMI — interfeys: ekranlar, panellar, modallar
   ============================================================ */
(function () {
  "use strict";
  var I = LT.icon, E;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  /* ---------------- ovoz ---------------- */
  var Sound = {
    on: false, ctx: null,
    init: function () {
      try { this.on = localStorage.getItem("lt_olam_snd") === "1"; } catch (e) {}
    },
    toggle: function () {
      this.on = !this.on;
      try { localStorage.setItem("lt_olam_snd", this.on ? "1" : "0"); } catch (e) {}
      if (this.on) this.play(660, 0.05);
      return this.on;
    },
    play: function (f, d, type) {
      if (!this.on) return;
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        this.ctx = this.ctx || new C();
        var o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || "triangle"; o.frequency.value = f;
        g.gain.value = 0.05;
        o.connect(g); g.connect(this.ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (d || 0.08));
        o.stop(this.ctx.currentTime + (d || 0.08));
      } catch (e) {}
    },
    ok: function () { this.play(720, 0.09); var s = this; setTimeout(function () { s.play(980, 0.1); }, 90); },
    bad: function () { this.play(220, 0.18, "square"); },
    click: function () { this.play(520, 0.03); },
    level: function () {
      var s = this;
      [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { s.play(f, 0.14); }, i * 110); });
    }
  };

  var UI = {
    screen: "boot",
    tipEl: null,

    init: function () {
      E = LT.Engine;
      Sound.init();
      this.bindChrome();
      this.bindEngine();
      this.renderBoot();
      this.updateHud();
    },

    /* ---------------- ekranlar ---------------- */
    show: function (name) {
      this.screen = name;
      $$(".screen").forEach(function (s) { s.classList.toggle("active", s.dataset.screen === name); });
      document.body.classList.toggle("in-game", name !== "boot");
      window.scrollTo(0, 0);
    },

    renderBoot: function () {
      var has = E.hasSave() && (E.state.xp > 0 || Object.keys(E.state.lessons).length);
      var st = E.stats();
      $("#boot-continue").style.display = has ? "inline-flex" : "none";
      $("#boot-save-info").innerHTML = has
        ? "Saqlangan o'yin: <b>" + E.level().title + "</b> · " + E.state.xp + " XP · " + st.lessons + "/" + st.lessonsTotal + " dars"
        : "Birinchi safar? \"Yangi o'yin\" ni bosing — hammasi noldan tushuntiriladi.";
    },

    startGame: function (fresh) {
      if (fresh) E.reset();
      this.show("world");
      if (!this.worldReady) {
        LT.Map.renderWorld($("#world-host"));
        this.renderWorldSide();
        this.worldReady = true;
      } else {
        LT.Map.refreshWorld();
        LT.Map.startTx();
      }
      this.updateHud();
      Sound.click();
    },

    /* ---------------- HUD ---------------- */
    updateHud: function () {
      var lv = E.level(), nx = E.nextLevel(), p = E.levelProgress();
      $("#hud-level").textContent = lv.lvl;
      $("#hud-title").textContent = lv.title;
      $("#hud-xp").textContent = E.state.xp + " XP";
      $("#hud-next").textContent = nx ? ("keyingi: " + nx.title + " · " + (nx.xp - E.state.xp) + " XP") : "maksimal daraja";
      $("#hud-bar-fill").style.width = (p * 100).toFixed(1) + "%";
      $("#hud-coins").textContent = LT.demoHelpers.fmt(E.state.coins, 0);
      var st = E.stats();
      $("#hud-progress").textContent = Math.round(E.totalProgress() * 100) + "%";
      $("#hud-badges").textContent = st.badges + "/" + st.badgesTotal;
      if (LT.Map.svg) LT.Map.refreshWorld();
      if (this.currentCity) LT.Map.refreshCity(this.currentCity);
    },

    bindEngine: function () {
      var self = this;
      E.on("change", function () { self.updateHud(); });
      E.on("xp", function (d) { if (d.n > 0) self.floatXp("+" + d.n + " XP", d.reason); });
      E.on("coins", function (d) { if (d.n) self.floatXp((d.n > 0 ? "+" : "") + d.n + " tanga", d.reason, d.n < 0); });
      E.on("levelup", function (lv) { self.levelUp(lv); });
      E.on("badge", function (b) { self.toast(LT.icon(b.icon) + " Nishon: <b>" + b.name + "</b> — " + b.desc, "ok"); Sound.ok(); });
      E.on("citydone", function (c) {
        if (!c) return;
        self.toast(LT.icon("crown") + " <b>" + c.name + "</b> to'liq tugatildi! +100 XP", "ok");
        Sound.level();
      });
    },

    floatXp: function (txt, reason, neg) {
      var f = h('<div class="xp-float' + (neg ? " neg" : "") + '">' + txt + (reason ? '<span>' + reason + '</span>' : '') + '</div>');
      $("#xp-floats").appendChild(f);
      setTimeout(function () { f.remove(); }, 2600);
    },

    levelUp: function (lv) {
      var ov = $("#levelup");
      $("#lu-lvl").textContent = lv.lvl;
      $("#lu-title").textContent = lv.title;
      $("#lu-note").textContent = lv.note;
      ov.classList.add("show");
      Sound.level();
      this.confetti();
      setTimeout(function () { ov.classList.remove("show"); }, 3200);
    },

    confetti: function () {
      var box = $("#confetti");
      box.innerHTML = "";
      var cols = ["#F5C542", "#59F0A8", "#7CD9FF", "#FF6B8A", "#B4B9FF"];
      for (var i = 0; i < 70; i++) {
        var p = document.createElement("i");
        p.style.left = Math.random() * 100 + "%";
        p.style.background = cols[i % cols.length];
        p.style.animationDelay = (Math.random() * 0.6).toFixed(2) + "s";
        p.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
        box.appendChild(p);
      }
      setTimeout(function () { box.innerHTML = ""; }, 3400);
    },

    toast: function (msg, kind) {
      var t = h('<div class="toast ' + (kind || "info") + '">' + msg + '</div>');
      $("#toasts").appendChild(t);
      setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, 4200);
    },

    /* ---------------- dunyo paneli ---------------- */
    renderWorldSide: function () {
      var host = $("#world-side");
      var union = LT.DATA.unions[0];
      host.innerHTML = "";
      host.appendChild(h(
        '<div class="side-card union">' +
        '  <div class="side-h">' + I("map") + ' EVM Ittifoqi</div>' +
        '  <p>' + union.blurb + '</p>' +
        '  <div class="chip-row">' + union.members.map(function (m) {
          var c = LT.Map.node(m);
          return '<span class="chip" style="border-color:' + c.color + ';color:' + c.color + '">' + c.name + '</span>';
        }).join("") + '</div>' +
        '  <button class="gbtn gbtn-ghost gbtn-sm" id="union-more">' + I("book") + ' Ittifoq nima degani?</button>' +
        '</div>'
      ));
      var list = h('<div class="side-card"><div class="side-h">' + I("compass") + ' O\'lkalar</div><div class="chain-list" id="chain-list"></div></div>');
      host.appendChild(list);
      var cl = $("#chain-list", list);
      LT.Map.allNodes().forEach(function (c) {
        var row = h(
          '<button class="chain-row-b" data-c="' + c.id + '">' +
          '  <span class="dot" style="background:' + c.color + '"></span>' +
          '  <span class="cr-n">' + c.name + '<small>' + c.real + ' · ' + c.coin + '</small></span>' +
          '  <span class="cr-p" data-p="' + c.id + '">0%</span>' +
          '</button>'
        );
        row.addEventListener("click", function () { UI.openCity(c.id); });
        cl.appendChild(row);
      });
      host.appendChild(h(
        '<div class="side-card tips">' +
        '  <div class="side-h">' + I("lightbulb") + ' Qanday o\'ynaladi</div>' +
        '  <ol>' +
        '    <li>Xaritadan shaharni tanlang (sichqoncha bilan surish va zoom ishlaydi).</li>' +
        '    <li>Shahardagi binoga bosing: dars, laboratoriya va test ochiladi.</li>' +
        '    <li>Test yechilsa — bino ✓ bo\'ladi. Shahar to\'lganda +100 XP.</li>' +
        '    <li>Yo\'lda tuzoqlar chiqadi: to\'g\'ri tanlov ball beradi.</li>' +
        '  </ol>' +
        '</div>'
      ));
      $("#union-more").addEventListener("click", function () {
        UI.openInfo("EVM Ittifoqi", union.lesson.join("<br><br>"), "map");
      });
      this.refreshWorldSide();
    },

    refreshWorldSide: function () {
      $$("[data-p]").forEach(function (el) {
        var p = E.cityProgress(el.getAttribute("data-p"));
        el.textContent = Math.round(p * 100) + "%";
        el.classList.toggle("full", p >= 1);
      });
    },

    showWorldTip: function (c) {
      var tip = $("#world-tip");
      tip.innerHTML =
        '<div class="wt-h" style="color:' + c.color + '">' + c.name + ' <small>' + c.real + '</small></div>' +
        '<p>' + c.role + '</p>' +
        '<div class="wt-grid">' +
        '<span>Konsensus</span><b>' + c.stats.consensus + '</b>' +
        '<span>Tezlik</span><b>' + c.stats.tps + '</b>' +
        '<span>Komissiya</span><b>' + c.stats.fee + '</b>' +
        '<span>Blok</span><b>' + c.stats.block + '</b>' +
        '<span>Manzil</span><b class="mono">' + c.addr + '</b>' +
        '</div>' +
        '<div class="wt-f">' + I("arrow") + ' bosib shaharga kirish</div>';
      tip.classList.add("show");
    },
    hideWorldTip: function () { $("#world-tip").classList.remove("show"); },

    /* ---------------- shahar ---------------- */
    openCity: function (chainId) {
      var c = LT.Map.node(chainId);
      if (!c) return;
      E.enterCity(chainId);
      this.currentCity = chainId;
      this.show("city");
      LT.Map.stopTx();
      Sound.click();

      $("#city-name").textContent = c.name;
      $("#city-real").textContent = c.real + " · " + c.coin;
      $("#city-role").textContent = c.role;
      $("#city-head").style.setProperty("--cc", c.color);

      $("#city-stats").innerHTML = Object.keys(c.stats).map(function (k) {
        var names = { consensus: "Konsensus", tps: "Tezlik", fee: "Komissiya", block: "Blok vaqti", final: "Yakunlanish" };
        return '<div class="cs"><span>' + (names[k] || k) + '</span><b>' + c.stats[k] + '</b></div>';
      }).join("");

      $("#city-story").innerHTML = c.story.map(function (p) { return "<p>" + p + "</p>"; }).join("");
      $("#city-pros").innerHTML = c.pros.length
        ? "<b>" + I("check") + " Kuchli tomonlari</b><ul>" + c.pros.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"
        : "";
      $("#city-cons").innerHTML = c.cons.length
        ? "<b>" + I("warning") + " Zaif tomonlari</b><ul>" + c.cons.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"
        : "";

      LT.Map.renderCity($("#city-host"), chainId);
      this.renderCityList(chainId);
      this.maybeTrap();
    },

    renderCityList: function (chainId) {
      var box = $("#city-locs");
      box.innerHTML = "";
      E.cityLocations(chainId).forEach(function (loc) {
        var done = E.locDone(loc.id), read = !!E.state.lessons[loc.id];
        var row = h(
          '<button class="loc-row ' + (done ? "done" : read ? "read" : "") + '" data-l="' + loc.id + '">' +
          '  <span class="lr-i">' + I(loc.icon) + '</span>' +
          '  <span class="lr-t"><b>' + loc.name + '</b><small>' + loc.tagline + '</small></span>' +
          '  <span class="lr-s">' + (done ? I("check") : read ? "•" : "?") + '</span>' +
          '</button>'
        );
        row.addEventListener("click", function () { UI.openLocation(loc.id); });
        box.appendChild(row);
      });
    },

    backToWorld: function () {
      this.currentCity = null;
      this.show("world");
      LT.Map.startTx();
      LT.Map.refreshWorld();
      this.refreshWorldSide();
      Sound.click();
    },

    /* ---------------- joy (dars) modali ---------------- */
    openLocation: function (locId) {
      var loc = E.loc(locId);
      if (!loc) return;
      var c = LT.Map.node(loc.chain);
      Sound.click();
      var self = this;

      var m = this.modal(
        '<div class="lm" style="--cc:' + c.color + '">' +
        '  <div class="lm-head">' +
        '    <span class="lm-icon">' + I(loc.icon) + '</span>' +
        '    <div><h3>' + loc.name + '</h3><small>' + c.name + ' · ' + loc.tagline + '</small></div>' +
        '  </div>' +
        '  <div class="lm-tabs">' +
        '    <button class="lm-tab on" data-t="lesson">' + I("book") + ' Dars</button>' +
        (loc.demo ? '    <button class="lm-tab" data-t="demo">' + I("flask") + ' Laboratoriya</button>' : "") +
        '    <button class="lm-tab" data-t="quiz">' + I("brain") + ' Test</button>' +
        '  </div>' +
        '  <div class="lm-body" id="lm-body"></div>' +
        '</div>'
      );

      var body = $("#lm-body", m);

      function renderLesson() {
        body.innerHTML =
          '<div class="analogy">' + I("lightbulb") + '<p>' + loc.analogy + '</p></div>' +
          loc.lesson.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
          '<div class="lm-foot">' +
          (E.state.lessons[loc.id]
            ? '<span class="done-tag">' + I("check") + ' Bu dars o\'qilgan</span>'
            : '<button class="gbtn gbtn-ok" id="l-read">' + I("check") + ' Tushundim (+' + Math.round(loc.xp * 0.45) + ' XP)</button>') +
          (loc.demo ? '<button class="gbtn gbtn-ghost" id="l-go-demo">' + I("flask") + ' Laboratoriyaga o\'tish</button>' : "") +
          '</div>';
        var rb = $("#l-read", body);
        if (rb) rb.addEventListener("click", function () {
          E.markLesson(loc.id);
          Sound.ok();
          self.updateHud();
          self.renderCityList(loc.chain);
          renderLesson();
        });
        var gd = $("#l-go-demo", body);
        if (gd) gd.addEventListener("click", function () { tab("demo"); });
      }

      function renderDemo() {
        body.innerHTML = "";
        var fn = LT.Demos[loc.demo];
        if (!fn) { body.innerHTML = "<p class='note'>Bu joyda laboratoriya yo'q.</p>"; return; }
        var wrap = document.createElement("div");
        body.appendChild(wrap);
        var awarded = E.state.demos[loc.demo];
        fn(wrap, {
          loc: loc,
          done: function () {
            if (awarded) return;
            awarded = true;
            E.markDemo(loc.demo, loc.id);
            Sound.ok();
            self.updateHud();
          }
        });
        if (!awarded) wrap.appendChild(h('<p class="note">Laboratoriyani oxirigacha sinab ko\'rsangiz +30 XP olasiz.</p>'));
      }

      function renderQuiz() {
        var rec = E.state.quizzes[loc.id];
        body.innerHTML =
          '<div class="quiz" id="quiz">' +
          (rec && rec.passed ? '<div class="quiz-passed">' + I("check") + ' Test yechilgan' + (rec.firstTry ? " — birinchi urinishda!" : "") + '</div>' : "") +
          loc.quiz.map(function (q, qi) {
            return '<div class="q" data-q="' + qi + '">' +
              '<div class="q-t"><b>' + (qi + 1) + '.</b> ' + q.q + '</div>' +
              '<div class="q-a">' + q.a.map(function (a, ai) {
                return '<button class="ans" data-q="' + qi + '" data-a="' + ai + '">' + a + '</button>';
              }).join("") + '</div>' +
              '<div class="q-why"></div>' +
              '</div>';
          }).join("") +
          '<div class="lm-foot"><button class="gbtn gbtn-ok" id="q-submit">' + I("check") + ' Javoblarni yuborish</button>' +
          '<span class="lab-status" id="q-status">' + loc.quiz.length + ' savol · hammasini to\'g\'ri yechish kerak</span></div>' +
          '</div>';

        var chosen = {};
        $$(".ans", body).forEach(function (b) {
          b.addEventListener("click", function () {
            var qi = b.dataset.q;
            chosen[qi] = +b.dataset.a;
            $$('.ans[data-q="' + qi + '"]', body).forEach(function (x) { x.classList.toggle("on", x === b); });
            Sound.click();
          });
        });

        $("#q-submit", body).addEventListener("click", function () {
          var correct = 0;
          loc.quiz.forEach(function (q, qi) {
            var qEl = $('.q[data-q="' + qi + '"]', body);
            var ok = chosen[qi] === q.c;
            if (ok) correct++;
            $$('.ans[data-q="' + qi + '"]', body).forEach(function (x, ai) {
              x.classList.toggle("right", ai === q.c && chosen[qi] !== undefined);
              x.classList.toggle("wrong", ai === chosen[qi] && !ok);
            });
            var why = $(".q-why", qEl);
            why.innerHTML = (ok ? "<b class='ok-t'>To'g'ri.</b> " : "<b class='bad-t'>To'g'ri javob: " + q.a[q.c] + ".</b> ") + q.why;
            why.classList.add("show");
          });
          var res = E.submitQuiz(loc.id, correct, loc.quiz.length);
          var status = $("#q-status", body);
          if (res.passed) {
            status.innerHTML = "<b class='ok-t'>Hammasi to'g'ri!</b> " + (res.firstTry ? "Birinchi urinishda — to'liq ball." : "Ball qo'shildi.");
            Sound.ok();
            self.toast(I("check") + " <b>" + loc.name + "</b> — test yechildi", "ok");
          } else {
            status.innerHTML = "<b class='warn-t'>" + correct + "/" + loc.quiz.length + " to'g'ri.</b> Tushuntirishni o'qib, qayta urinib ko'ring.";
            Sound.bad();
          }
          self.updateHud();
          self.renderCityList(loc.chain);
          LT.Map.refreshCity(loc.chain);
        });
      }

      function tab(name) {
        $$(".lm-tab", m).forEach(function (t) { t.classList.toggle("on", t.dataset.t === name); });
        if (name === "lesson") renderLesson();
        else if (name === "demo") renderDemo();
        else renderQuiz();
      }
      $$(".lm-tab", m).forEach(function (t) {
        t.addEventListener("click", function () { tab(t.dataset.t); Sound.click(); });
      });
      tab("lesson");
    },

    /* ---------------- tuzoqlar ---------------- */
    maybeTrap: function () {
      if (Math.random() >= 0.45) return;
      var self = this, waits = 0;
      var tick = setInterval(function () {
        waits++;
        if (self.screen !== "city" || waits > 40) { clearInterval(tick); return; }
        if (!self.anyModalOpen()) { clearInterval(tick); self.runTrapSeries(1); }
      }, 1400);
    },

    runTrapSeries: function (n, cb) {
      var self = this, left = n;
      function next() {
        if (left <= 0) { if (cb) cb(); return; }
        left--;
        var t = E.randomTrap();
        if (!t) { if (cb) cb(); return; }
        self.showTrap(t, next);
      }
      next();
    },

    showTrap: function (t, after) {
      var self = this;
      Sound.bad();
      var m = this.modal(
        '<div class="trap-modal">' +
        '  <div class="tm-head">' + I(t.icon) + '<div><h3>' + t.title + '</h3><small>' + (t.from || "") + '</small></div>' +
        '    <span class="tm-tag">' + I("warning") + ' TUZOQ</span></div>' +
        '  <div class="tm-msg">' + t.text + '</div>' +
        '  <div class="tm-choices" id="tm-ch"></div>' +
        '  <div class="tm-why" id="tm-why"></div>' +
        '</div>', true, 2
      );
      var box = $("#tm-ch", m);
      t.choices.forEach(function (ch) {
        var b = h('<button class="tm-c">' + ch.t + '</button>');
        b.addEventListener("click", function () {
          $$(".tm-c", box).forEach(function (x) { x.disabled = true; });
          b.classList.add(ch.ok ? "good" : "bad");
          E.resolveTrap(t.id, ch.ok);
          var why = $("#tm-why", m);
          why.innerHTML =
            '<div class="' + (ch.ok ? "ok" : "bad") + '-head">' + (ch.ok ? I("check") + " To'g'ri tanlov" : I("xmark") + " Bu tuzoq edi") + '</div>' +
            '<p>' + t.why + '</p>' +
            '<div class="lm-foot"><button class="gbtn ' + (ch.ok ? "gbtn-ok" : "gbtn-ghost") + '" id="tm-next">' +
            (ch.ok ? I("check") + " Davom etish (+" + t.xp + " XP)" : I("arrow") + " Tushundim, davom etaman") + '</button></div>';
          why.classList.add("show");
          ch.ok ? Sound.ok() : Sound.bad();
          $("#tm-next", why).addEventListener("click", function () {
            self.closeModal(2);
            self.updateHud();
            if (after) setTimeout(after, 350);
          });
        });
        box.appendChild(b);
      });
    },

    /* ---------------- profil ---------------- */
    openProfile: function () {
      var st = E.stats(), lv = E.level();
      var badges = LT.DATA.badges.map(function (b) {
        var has = E.state.badges.indexOf(b.id) > -1;
        return '<div class="bdg ' + (has ? "has" : "") + '">' + I(b.icon) + '<b>' + b.name + '</b><small>' + b.desc + '</small></div>';
      }).join("");
      var cities = LT.DATA.chains.map(function (c) {
        var p = Math.round(E.cityProgress(c.id) * 100);
        return '<div class="pc-row"><span class="dot" style="background:' + c.color + '"></span><b>' + c.name + '</b>' +
          '<div class="mini-bar"><i style="width:' + p + '%;background:' + c.color + '"></i></div><span>' + p + '%</span></div>';
      }).join("");
      this.modal(
        '<div class="profile">' +
        '  <div class="pf-head"><div class="pf-lvl">' + lv.lvl + '</div>' +
        '    <div><h3>' + lv.title + '</h3><small>' + E.state.xp + ' XP · ' + LT.demoHelpers.fmt(E.state.coins, 0) + ' tanga · ' + Math.round(E.totalProgress() * 100) + '% bajarildi</small></div></div>' +
        '  <div class="pf-grid">' +
        '    <div class="st"><span>Darslar</span><b>' + st.lessons + '/' + st.lessonsTotal + '</b></div>' +
        '    <div class="st"><span>Testlar</span><b>' + st.quizzes + '/' + st.lessonsTotal + '</b></div>' +
        '    <div class="st"><span>Laboratoriyalar</span><b>' + st.demos + '</b></div>' +
        '    <div class="st ok"><span>Tuzoqdan qutuldingiz</span><b>' + st.traps + '/' + st.trapsTotal + '</b></div>' +
        '    <div class="st"><span>Shaharlar</span><b>' + st.cities + '/' + st.citiesTotal + '</b></div>' +
        '    <div class="st"><span>Nishonlar</span><b>' + st.badges + '/' + st.badgesTotal + '</b></div>' +
        '  </div>' +
        '  <h4>' + I("map") + ' Shaharlar bo\'yicha</h4><div class="pf-cities">' + cities + '</div>' +
        '  <h4>' + I("trophy") + ' Nishonlar</h4><div class="bdg-grid">' + badges + '</div>' +
        '</div>'
      );
    },

    openInfo: function (title, html, icon) {
      this.modal('<div class="info-modal"><h3>' + I(icon || "book") + ' ' + title + '</h3><div class="info-body">' + html + '</div></div>');
    },

    openHelp: function () {
      this.openInfo("Qanday o'ynaladi",
        '<p><b>Maqsad:</b> olamning barcha shaharlarini tugatib, 10-darajaga (LIDER TRADER) yetish.</p>' +
        '<ul>' +
        '<li><b>Xarita:</b> sichqoncha g\'ildiragi bilan zoom, bosib surish bilan siljish. Har orol — alohida blokcheyn.</li>' +
        '<li><b>Shahar:</b> binoga bossangiz uch bo\'lim ochiladi — <i>Dars</i>, <i>Laboratoriya</i> (interaktiv mashq), <i>Test</i>.</li>' +
        '<li><b>Ball:</b> dars +XP, laboratoriya +30 XP, test to\'liq to\'g\'ri bo\'lsa katta bonus. Birinchi urinishda yechsangiz ko\'proq.</li>' +
        '<li><b>Tuzoqlar:</b> shaharga kirganda tasodifiy holat chiqadi (phishing, honeypot, soxta airdrop...). To\'g\'ri tanlov ball beradi, xato tanlov tanga oladi — lekin tushuntirish har doim beriladi.</li>' +
        '<li><b>Saqlash:</b> progress brauzerda avtomatik saqlanadi. "Boshidan" tugmasi hammasini tozalaydi.</li>' +
        '</ul>' +
        '<p class="note">Barcha ma\'lumot o\'quv maqsadida. Bu investitsiya maslahati emas va hech qanday real hamyon ishlatilmaydi.</p>', "lightbulb");
    },

    /* ---------------- modal (ikki qatlam) ----------------
       1-qatlam: darslar, profil, yordam
       2-qatlam: tuzoqlar — dars ustiga chiqadi va uni o'chirmaydi */
    modal: function (html, noClose, layer) {
      var back = $(layer === 2 ? "#modal2" : "#modal");
      back.innerHTML = "";
      var win = h('<div class="modal-win">' + html + '</div>');
      if (!noClose) {
        var x = h('<button class="modal-x" aria-label="Yopish">' + I("close") + '</button>');
        x.addEventListener("click", function () { UI.closeModal(layer); });
        win.appendChild(x);
      }
      back.appendChild(win);
      back.classList.add("show");
      document.body.classList.add("modal-open");
      return win;
    },
    closeModal: function (layer) {
      var back = $(layer === 2 ? "#modal2" : "#modal");
      back.classList.remove("show");
      back.innerHTML = "";
      if (!$("#modal").classList.contains("show") && !$("#modal2").classList.contains("show")) {
        document.body.classList.remove("modal-open");
      }
    },
    anyModalOpen: function () {
      return $("#modal").classList.contains("show") || $("#modal2").classList.contains("show");
    },
    trapOpen: function () { return $("#modal2").classList.contains("show"); },

    /* ---------------- boshqaruv ---------------- */
    bindChrome: function () {
      var self = this;
      $("#boot-new").addEventListener("click", function () { self.startGame(true); });
      $("#boot-continue").addEventListener("click", function () { self.startGame(false); });
      $("#boot-help").addEventListener("click", function () { self.openHelp(); });
      $("#hud-home").addEventListener("click", function () {
        if (self.screen === "city") self.backToWorld();
        else self.show("boot"), self.renderBoot();
      });
      $("#city-back").addEventListener("click", function () { self.backToWorld(); });
      $("#hud-profile").addEventListener("click", function () { self.openProfile(); });
      $("#hud-help").addEventListener("click", function () { self.openHelp(); });
      $("#hud-reset").addEventListener("click", function () {
        if (confirm("Butun progress o'chiriladi. Davom etamizmi?")) {
          E.reset();
          self.updateHud();
          self.renderBoot();
          self.show("boot");
          self.toast("Progress tozalandi", "info");
        }
      });
      var sb = $("#hud-sound");
      function paintSound() { sb.innerHTML = Sound.on ? I("sound") : I("mute"); sb.classList.toggle("off", !Sound.on); }
      paintSound();
      sb.addEventListener("click", function () { Sound.toggle(); paintSound(); });

      $("#zoom-in").addEventListener("click", function () { LT.Map.zoomBy(0.82); });
      $("#zoom-out").addEventListener("click", function () { LT.Map.zoomBy(1.22); });
      $("#zoom-reset").addEventListener("click", function () { LT.Map.resetView(); });

      $("#modal").addEventListener("click", function (e) {
        if (e.target === this) self.closeModal();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (self.trapOpen()) return;               /* tuzoqda tanlov qilish shart */
        if ($("#modal").classList.contains("show")) self.closeModal();
        else if (self.screen === "city") self.backToWorld();
      });
    },

    Sound: Sound
  };

  LT.UI = UI;
})();
