/* ============================================================
   KRIPTO OLAMI — o'yin dvigateli: holat, ball, saqlash
   ============================================================ */
(function () {
  "use strict";

  var KEY = "lt_olam_v2";

  var Engine = {
    state: null,
    listeners: {},

    /* ---------- Hodisalar ---------- */
    on: function (ev, fn) {
      (this.listeners[ev] = this.listeners[ev] || []).push(fn);
      return this;
    },
    emit: function (ev, data) {
      (this.listeners[ev] || []).forEach(function (fn) {
        try { fn(data); } catch (e) { console.warn(e); }
      });
    },

    /* ---------- Boshlang'ich holat ---------- */
    fresh: function () {
      return {
        v: 2,
        name: "",
        xp: 0,
        coins: 100,
        lessons: {},        // location id -> true (dars o'qildi)
        quizzes: {},        // location id -> { tries: n, passed: bool, firstTry: bool }
        demos: {},          // demo id -> true
        visitedCities: {},  // chain id -> true
        traps: {},          // trap id -> "ok" | "fail"
        badges: [],
        started: Date.now(),
        lastCity: null
      };
    },

    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* file:// cheklovi */ }
      if (raw) {
        try {
          var s = JSON.parse(raw);
          if (s && s.v === 2) { this.state = s; return true; }
        } catch (e) { /* buzilgan saqlov */ }
      }
      this.state = this.fresh();
      return false;
    },

    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* saqlanmasa ham o'yin ishlaydi */ }
    },

    reset: function () {
      this.state = this.fresh();
      this.save();
      this.emit("reset");
      this.emit("change");
    },

    hasSave: function () {
      try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
    },

    /* ---------- Ball ---------- */
    level: function () {
      var lv = LT.DATA.levels[0], xp = this.state.xp;
      LT.DATA.levels.forEach(function (l) { if (xp >= l.xp) lv = l; });
      return lv;
    },
    nextLevel: function () {
      var xp = this.state.xp;
      for (var i = 0; i < LT.DATA.levels.length; i++) {
        if (LT.DATA.levels[i].xp > xp) return LT.DATA.levels[i];
      }
      return null;
    },
    levelProgress: function () {
      var cur = this.level(), nxt = this.nextLevel();
      if (!nxt) return 1;
      return (this.state.xp - cur.xp) / (nxt.xp - cur.xp);
    },

    addXp: function (n, reason) {
      var before = this.level().lvl;
      this.state.xp = Math.max(0, this.state.xp + n);
      var after = this.level();
      this.save();
      this.emit("xp", { n: n, reason: reason });
      if (after.lvl > before) this.emit("levelup", after);
      this.emit("change");
    },

    addCoins: function (n, reason) {
      this.state.coins = Math.max(0, this.state.coins + n);
      this.save();
      this.emit("coins", { n: n, reason: reason });
      this.emit("change");
    },

    /* ---------- Nishonlar ---------- */
    giveBadge: function (id) {
      if (!id || this.state.badges.indexOf(id) > -1) return false;
      var b = LT.DATA.badges.filter(function (x) { return x.id === id; })[0];
      if (!b) return false;
      this.state.badges.push(id);
      this.addXp(40, "Nishon: " + b.name);
      this.save();
      this.emit("badge", b);
      return true;
    },

    /* ---------- Joylar ---------- */
    loc: function (id) {
      return LT.DATA.locations.filter(function (l) { return l.id === id; })[0];
    },
    chain: function (id) {
      return LT.DATA.chains.filter(function (c) { return c.id === id; })[0];
    },
    cityLocations: function (chainId) {
      return LT.DATA.locations.filter(function (l) { return l.chain === chainId; });
    },

    markLesson: function (id) {
      var loc = this.loc(id);
      if (!loc || this.state.lessons[id]) return;
      this.state.lessons[id] = true;
      this.addXp(Math.round(loc.xp * 0.45), "Dars: " + loc.name);
      this.addCoins(Math.round(loc.coins * 0.4), "Dars");
      if (Object.keys(this.state.lessons).length === 1) this.giveBadge("first");
      this.save();
      this.emit("lesson", loc);
      this.checkCity(loc.chain);
    },

    markDemo: function (demoId, locId) {
      if (!demoId || this.state.demos[demoId]) return;
      this.state.demos[demoId] = true;
      this.addXp(30, "Amaliyot bajarildi");
      this.addCoins(10, "Amaliyot");
      if (demoId === "hash") this.giveBadge("hash");
      this.save();
      this.emit("demo", { demo: demoId, loc: locId });
      if (locId) this.checkCity((this.loc(locId) || {}).chain);
    },

    submitQuiz: function (locId, correctCount, total) {
      var loc = this.loc(locId);
      if (!loc) return { passed: false };
      var rec = this.state.quizzes[locId] || { tries: 0, passed: false, firstTry: false };
      rec.tries++;
      var passed = correctCount === total;
      if (passed && !rec.passed) {
        rec.passed = true;
        rec.firstTry = rec.tries === 1;
        var bonus = rec.firstTry ? Math.round(loc.xp * 0.55) : Math.round(loc.xp * 0.3);
        this.addXp(bonus, "Test: " + loc.name);
        this.addCoins(loc.coins, "Test");
        if (loc.badge) this.giveBadge(loc.badge);
        var aces = 0, self = this;
        Object.keys(this.state.quizzes).forEach(function (k) {
          if (self.state.quizzes[k].firstTry) aces++;
        });
        if (aces >= 10) this.giveBadge("quizace");
      }
      this.state.quizzes[locId] = rec;
      this.save();
      this.emit("quiz", { loc: loc, passed: passed, rec: rec });
      this.checkCity(loc.chain);
      return { passed: passed, firstTry: rec.firstTry, tries: rec.tries };
    },

    locDone: function (id) {
      var q = this.state.quizzes[id];
      return !!(this.state.lessons[id] && q && q.passed);
    },

    cityProgress: function (chainId) {
      var locs = this.cityLocations(chainId), self = this;
      if (!locs.length) return 0;
      var done = locs.filter(function (l) { return self.locDone(l.id); }).length;
      return done / locs.length;
    },

    checkCity: function (chainId) {
      if (!chainId) return;
      if (this.cityProgress(chainId) < 1) return;
      if (this.state.visitedCities[chainId] === "done") return;
      this.state.visitedCities[chainId] = "done";
      var ch = this.chain(chainId);
      this.addXp(100, "Shahar tugatildi: " + (ch ? ch.name : chainId));
      this.addCoins(50, "Shahar bonusi");
      this.save();
      this.emit("citydone", ch);

      var doneCount = 0, self = this;
      LT.DATA.chains.forEach(function (c) {
        if (self.state.visitedCities[c.id] === "done") doneCount++;
      });
      if (doneCount >= 3) this.giveBadge("city3");
      if (doneCount >= LT.DATA.chains.length) this.giveBadge("cityall");
    },

    enterCity: function (chainId) {
      if (!this.state.visitedCities[chainId]) this.state.visitedCities[chainId] = "seen";
      this.state.lastCity = chainId;
      this.save();
    },

    /* ---------- Tuzoqlar ---------- */
    trapsAvoided: function () {
      var n = 0, s = this.state.traps;
      Object.keys(s).forEach(function (k) { if (s[k] === "ok") n++; });
      return n;
    },
    trapsHit: function () {
      var n = 0, s = this.state.traps;
      Object.keys(s).forEach(function (k) { if (s[k] === "fail") n++; });
      return n;
    },
    randomTrap: function () {
      var self = this;
      var pool = LT.DATA.traps.filter(function (t) { return !self.state.traps[t.id]; });
      if (!pool.length) pool = LT.DATA.traps.filter(function (t) { return self.state.traps[t.id] === "fail"; });
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    resolveTrap: function (trapId, ok) {
      var t = LT.DATA.traps.filter(function (x) { return x.id === trapId; })[0];
      if (!t) return;
      var prev = this.state.traps[trapId];
      this.state.traps[trapId] = ok ? "ok" : "fail";
      if (ok && prev !== "ok") {
        this.addXp(t.xp, "Tuzoqdan qutuldingiz");
        this.addCoins(t.coins, "Tuzoq");
      } else if (!ok) {
        this.addCoins(-Math.min(this.state.coins, 30), "Tuzoqqa tushdingiz");
      }
      var av = this.trapsAvoided();
      if (av >= 3) this.giveBadge("trap3");
      if (av >= 8) this.giveBadge("trap8");
      this.save();
      this.emit("trap", { trap: t, ok: ok });
    },

    /* ---------- Umumiy progress ---------- */
    totalProgress: function () {
      var locs = LT.DATA.locations, self = this;
      var done = locs.filter(function (l) { return self.locDone(l.id); }).length;
      var trapPart = this.trapsAvoided() / LT.DATA.traps.length;
      return (done / locs.length) * 0.8 + trapPart * 0.2;
    },

    stats: function () {
      var self = this;
      return {
        lessons: Object.keys(this.state.lessons).length,
        lessonsTotal: LT.DATA.locations.length,
        quizzes: Object.keys(this.state.quizzes).filter(function (k) { return self.state.quizzes[k].passed; }).length,
        demos: Object.keys(this.state.demos).length,
        traps: this.trapsAvoided(),
        trapsTotal: LT.DATA.traps.length,
        cities: LT.DATA.chains.filter(function (c) { return self.state.visitedCities[c.id] === "done"; }).length,
        citiesTotal: LT.DATA.chains.length,
        badges: this.state.badges.length,
        badgesTotal: LT.DATA.badges.length
      };
    }
  };

  LT.Engine = Engine;
})();
