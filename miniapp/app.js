/* ═══════════════════════════════════════════════════════════════════════════
   Gift Arenda — Mini App klienti

   Katalogda ~8 000 gift va ~120 kolleksiya bor. Shuning uchun:

     • Ochilishda giftlar YUKLANMAYDI. `/api/bootstrap` faqat foydalanuvchi,
       balans, ijaralar va kolleksiyalar ro'yxatini beradi (bir necha KB).
     • Giftlar `/api/gifts` dan 60 tadan keladi; pastga tushganda keyingi
       sahifa so'raladi.
     • Qidiruv, saralash va kolleksiya filtri ham SERVERDA bajariladi —
       8 000 elementni klientga tashib, u yerda filtrlash mobil qurilmada
       ham sekin, ham ortiqcha trafik.
     • Narx hisob-kitobi (kun × kunlik + xizmat haqi) klientda — slayder
       tortilganda so'rov ketmaydi. Server to'lovda narxni baribir qayta
       hisoblaydi, ya'ni klientdagi hisob faqat ko'rsatish uchun.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const tg = window.Telegram?.WebApp;

// ───────────────────────────── Holat ─────────────────────────────

const state = {
  user: null,
  balance: 0,
  pricing: { ton_rate_uzs: 20000, service_fee_uzs: 2000 },
  settings: { page_size: 60 },
  collections: [],
  rentals: [],

  catalog: { version: '', ready: false, loading: false, total_gifts: 0 },

  // Market ro'yxati (serverdan sahifalab keladi)
  feed: {
    items: [],
    offset: 0,
    total: 0,
    hasMore: true,
    busy: false,
    version: '',
  },

  collection: null,   // null = barchasi
  sort: 'asc',
  search: '',

  gift: null,
  days: 1,

  // To'plamlar (3/6/9/12 ta bir mavzudagi gift)
  bundleCfg: { min_days: 7, sizes: [3, 6, 9, 12], markup_pct: 10, total: 0 },
  bundles: { items: [], offset: 0, total: 0, hasMore: true, busy: false, kind: '', version: '' },
  bundle: null,
  bundleSize: 3,
  bundleDays: 7,

  rental: null,
  extendDays: 1,

  screen: 'market',
  world: 'gift',
  history: [],

  // ── Reklama bo'limi ──
  ads: {
    enabled: false,
    ready: false,
    cfg: null,        // /ads/bootstrap javobi
    refs: null,       // davlatlar / tillar / mavzular
    items: [],        // mening reklamalarim
    current: null,    // ochilgan reklama
    stats: [],
    statsDays: 7,
    // Forma holati
    target: 'channels',
    placement: 'channel_post',
    media: null,      // {kind:'photo'|'video', id, url}
    sel: {
      chLangs: new Set(), chTopics: new Set(), channels: [], exChannels: [],
      countries: new Set(), locations: [], uLangs: new Set(), uTopics: new Set(),
      uChannels: [], audiences: new Set(), bots: [], queries: [],
    },
    schedule: new Array(7).fill(0),
  },
};

// ───────────────────────────── Yordamchilar ─────────────────────────────

const $  = (id) => document.getElementById(id);
const el = (sel, root = document) => root.querySelector(sel);

function fmtNum(n) {
  return Math.round(Number(n) || 0).toLocaleString('ru-RU');
}
function fmtSom(n) {
  return fmtNum(n) + " so'm";
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function haptic(type = 'light') {
  try {
    if (type === 'success' || type === 'error' || type === 'warning') {
      tg?.HapticFeedback?.notificationOccurred(type);
    } else {
      tg?.HapticFeedback?.impactOccurred(type);
    }
  } catch { /* qo'llab-quvvatlanmasa — muhim emas */ }
}

let toastTimer = null;
function toast(message, kind = '') {
  const node = $('toast');
  node.textContent = message;
  node.className = 'toast is-open' + (kind ? ` is-${kind}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = 'toast'; }, 3200);
}

function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.innerHTML = '<span class="spin"></span>' + (label ? ` ${label}` : '');
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// ───────────────────────────── Telegram bilan bog'lanish ─────────────────────────────

const initData = tg?.initData || '';

/**
 * Ilova Telegram ichida ochilganmi?
 *
 * `initData` bo'sh bo'lsa — sahifa oddiy brauzerda ochilgan. Bunda oldin
 * "Avtorizatsiya xatosi" degan tushunarsiz yozuv chiqardi; endi nima
 * qilish kerakligi aniq aytiladi.
 */
const insideTelegram = Boolean(tg && initData);

function showGate(title, text, retry = false) {
  $('gate-title').textContent = title;
  $('gate-text').textContent = text;
  $('gate-btn').hidden = !retry;
  $('gate').hidden = false;
  $('app').hidden = true;
  $('splash')?.classList.add('is-done');
}

/**
 * Ushlanmagan xatoni EKRANDA ko'rsatadi.
 *
 * Busiz JS xatosi ilovani jimgina o'ldirardi: splash ekrani abadiy aylanib
 * turardi va foydalanuvchi ham, biz ham sababni bilmasdik. Telefonda konsolni
 * ochish deyarli imkonsiz, shuning uchun xato matni to'g'ridan-to'g'ri
 * ko'rsatiladi va uni nusxalab yuborish mumkin.
 */
let fatalShown = false;
function showFatal(source, error) {
  if (fatalShown) return;
  fatalShown = true;

  const detail = [
    `${source}: ${error?.message || error}`,
    error?.stack ? String(error.stack).split('\n').slice(0, 3).join(' | ') : '',
    `${navigator.userAgent.slice(0, 90)}`,
    `tg=${tg?.version || 'yo\'q'} platform=${tg?.platform || '?'}`,
  ].filter(Boolean).join('\n');

  showGate('Ilovada xatolik', detail, true);

  const btn = $('gate-btn');
  btn.textContent = 'Xato matnini nusxalash';
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(detail);
      btn.textContent = 'Nusxalandi ✓';
    } catch {
      btn.textContent = 'Nusxalab bo\'lmadi — skrinshot oling';
    }
  };
}

window.addEventListener('error', (e) => showFatal('JS xatosi', e.error || e));
window.addEventListener('unhandledrejection', (e) => showFatal('Promise xatosi', e.reason));

// ───────────────────────────── API ─────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${initData}`,
      ...(options.headers || {}),
    },
  });

  let data = {};
  try { data = await res.json(); } catch { /* bo'sh javob */ }

  if (!res.ok) {
    // Seans muddati tugagan bo'lsa, boshqa har qanday so'rov ham ishlamaydi —
    // foydalanuvchini bir marta ogohlantirib, qayta ochishni taklif qilamiz.
    if (res.status === 401 && data.reason === 'expired') {
      showGate(
        'Seans muddati tugadi',
        'Ilovani yopib, botdagi «Gift Arenda» tugmasidan qaytadan oching.',
        true
      );
    }
    const err = new Error(data.error || `Xatolik (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// ───────────────────────────── Navigatsiya ─────────────────────────────

/**
 * Ilovada IKKITA dunyo bor va ularning o'z tab paneli:
 *
 *   gift — Market / To'plam / Giftlarim / Balans   (+ "Reklama" tugmasi)
 *   ads  — Reklama / Reklamalarim / Profil        (+ "Gift Arenda" tugmasi)
 *
 * Har bir panelning OXIRGI tugmasi ikkinchi dunyoga o'tkazadi. Tarix
 * dunyolar bo'yicha ALOHIDA yuritiladi, aks holda "orqaga" tugmasi
 * foydalanuvchini kutilmaganda boshqa dunyoga tashlab yuborardi.
 */
const GIFT_TABS = ['market', 'bundles', 'mine', 'balance'];
const ADS_TABS  = ['ads-create', 'ads-mine', 'ads-profile'];
const TABS = [...GIFT_TABS, ...ADS_TABS];

/** Ekran qaysi dunyoga tegishli. */
function worldOf(name) {
  return name.startsWith('ads-') ? 'ads' : 'gift';
}

function showScreen(name, { push = true } = {}) {
  if (state.screen === name) return;

  const world = worldOf(name);
  if (push && !TABS.includes(name)) state.history.push(state.screen);
  if (TABS.includes(name)) state.history = [];

  state.screen = name;
  state.world = world;

  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.toggle('is-active', s.dataset.screen === name);
  });
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.dataset.tab === name);
  });

  // Faqat shu dunyoning paneli ko'rinadi.
  $('tabbar-gift').hidden = world !== 'gift';
  $('tabbar-ads').hidden  = world !== 'ads';

  window.scrollTo({ top: 0 });
  syncBackButton();

  if (name === 'mine') renderMine();
  if (name === 'balance') renderBalance();
  // To'plamlar ro'yxati faqat KERAK BO'LGANDA yuklanadi — ilova ochilishi
  // shu sabab sekinlashmaydi.
  if (name === 'bundles' && state.bundles.items.length === 0) loadBundles({ reset: true });

  if (name === 'ads-create') onAdsCreateOpen();
  if (name === 'ads-mine') loadMyAds();
  if (name === 'ads-profile') renderAdsProfile();
}

function goBack() {
  const fallback = state.world === 'ads' ? 'ads-mine' : 'market';
  const target = state.history.pop() || fallback;
  state.screen = '';
  showScreen(target, { push: false });
}

function syncBackButton() {
  if (!tg?.BackButton) return;
  if (TABS.includes(state.screen)) tg.BackButton.hide();
  else tg.BackButton.show();
}

// ───────────────────────────── Rasm ─────────────────────────────

/**
 * Rasm yuklanmasa emoji fallback qoladi, yuklansa yumshoq paydo bo'ladi.
 * Konteynerdagi boshqa elementlar (masalan "3–30 kun" belgisi) o'chmaydi.
 */
function mountImage(container, url, fallbackEmoji = '🎁') {
  container.querySelectorAll('.fallback, img').forEach((n) => n.remove());

  const fallback = document.createElement('span');
  fallback.className = 'fallback';
  fallback.textContent = fallbackEmoji;
  container.appendChild(fallback);

  if (!url) return;

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = '';
  wireImage(img, fallback);

  // MUHIM: avval DOM ga qo'shamiz, KEYIN src beramiz.
  //
  // `loading="lazy"` faqat element hujjatda bo'lgandagina ishlaydi. Avval
  // `new Image()` ga src berib, keyin qo'shardik — natijada brauzer 60 ta
  // rasmni BIRDANIGA yuklardi, ro'yxat esa sekin ochilardi. Endi ekranga
  // yaqinlashganlari yuklanadi.
  container.appendChild(img);
  img.src = url;
}

/** Rasm yuklanganda yumshoq paydo bo'ladi, yuklanmasa emoji qoladi. */
function wireImage(img, fallback) {
  img.addEventListener('load', () => {
    img.classList.add('is-loaded');
    if (fallback) fallback.remove();
    else img.parentElement?.querySelector('.fallback')?.remove();
  }, { once: true });
  img.addEventListener('error', () => img.remove(), { once: true });
}

// ───────────────────────────── Narx (klient tomonda) ─────────────────────────────

const NANO = 1e9;

/** Server bilan BIR XIL formula (src/services/pricing.ts). */
function perDayUzs(nano) {
  return Math.ceil((Number(nano) / NANO) * state.pricing.ton_rate_uzs);
}
function affordableDays(nano) {
  const perDay = perDayUzs(nano);
  if (perDay <= 0) return 0;
  const rest = state.balance - state.pricing.service_fee_uzs;
  return rest <= 0 ? 0 : Math.floor(rest / perDay);
}

// ───────────────────────────── Market: sahifalab yuklash ─────────────────────────────

function resetFeed() {
  state.feed = { items: [], offset: 0, total: 0, hasMore: true, busy: false, version: '' };
  $('market-grid').innerHTML = '';
}

function renderSkeleton(count = 8) {
  $('market-grid').innerHTML = Array.from({ length: count }, () => `
    <article class="tile is-skeleton">
      <div class="tile-media"></div>
      <div class="tile-body"><div class="sk"></div><div class="sk w60"></div></div>
    </article>`).join('');
}

function renderEmpty(message, hint, icon = 'empty-search') {
  $('market-grid').innerHTML = `
    <div class="empty">
      <svg class="ico ico-lg"><use href="#i-${icon}"/></svg>
      <b>${escapeHtml(message)}</b>
      <span>${escapeHtml(hint)}</span>
    </div>`;
}

/**
 * Keyingi sahifani so'raydi.
 * `reset` — filtr/qidiruv/saralash o'zgarganda ro'yxat noldan boshlanadi.
 */
async function loadGifts({ reset = false } = {}) {
  if (state.feed.busy) return;
  if (!reset && !state.feed.hasMore) return;

  if (reset) {
    resetFeed();
    renderSkeleton();
  }

  state.feed.busy = true;

  const params = new URLSearchParams({
    offset: String(state.feed.offset),
    limit: String(state.settings.page_size || 60),
    sort: state.sort,
  });
  if (state.collection) params.set('collection', state.collection);
  if (state.search) params.set('q', state.search);

  try {
    const page = await api(`/gifts?${params.toString()}`);

    // Katalog fon rejimida yangilanib turadi. Versiya o'zgargan bo'lsa,
    // sahifalash surilib ketmasligi uchun ro'yxatni qaytadan boshlaymiz.
    if (state.feed.version && page.version !== state.feed.version && !reset) {
      state.feed.busy = false;
      return loadGifts({ reset: true });
    }
    state.feed.version = page.version;

    if (reset) $('market-grid').innerHTML = '';

    // Birinchi sahifa arzondan boshlab keladi — bannerdagi "…so'm/kundan"
    // raqami shundan olinadi.
    if (reset && state.sort === 'asc' && !state.collection && !state.search && page.items[0]) {
      $('stat-from').textContent = fmtNum(page.items[0].price_per_day_uzs);
    }

    state.feed.items.push(...page.items);
    state.feed.offset += page.items.length;
    state.feed.total = page.total;
    state.feed.hasMore = page.has_more;

    if (state.feed.items.length === 0) {
      renderEmpty(
        state.catalog.loading ? 'Katalog yuklanmoqda' : 'Gift topilmadi',
        state.catalog.loading
          ? 'Bir necha daqiqadan keyin qayta oching'
          : (state.search ? 'Qidiruv shartini o\'zgartiring' : 'Boshqa kolleksiyani tanlang'),
        state.catalog.loading ? 'refresh' : 'empty-search'
      );
    } else {
      appendTiles(page.items);
      updateCounter();
    }
  } catch (err) {
    if (state.feed.items.length === 0) {
      renderEmpty('Yuklab bo\'lmadi', err.message, 'empty-net');
    } else {
      toast(err.message, 'error');
    }
  } finally {
    state.feed.busy = false;
  }
}

function appendTiles(items) {
  const grid = $('market-grid');
  const frag = document.createDocumentFragment();
  const pending = [];

  for (const gift of items) {
    const tile = document.createElement('article');
    tile.className = 'tile';
    tile.innerHTML = `
      <div class="tile-media">
        <span class="tile-days">${gift.min_days}–${gift.max_days} kun</span>
      </div>
      <div class="tile-body">
        <div class="tile-name">${escapeHtml(gift.nft_name)}</div>
        <div class="tile-col">${escapeHtml(gift.collection_name)}</div>
        <div class="tile-price">${fmtNum(gift.price_per_day_uzs)} <span>so'm/kun</span></div>
      </div>`;

    tile.addEventListener('click', () => openDetail(gift));
    frag.appendChild(tile);
    pending.push([tile, gift.image_url]);
  }

  grid.appendChild(frag);

  // Rasmlar DOM ga qo'shilgandan KEYIN ulanadi — shundagina brauzerning
  // o'z lazy-loading mexanizmi ishlaydi.
  for (const [tile, url] of pending) mountImage(el('.tile-media', tile), url);
}

/** Bannerdagi jonli raqamlar. */
function renderBannerStats() {
  $('stat-gifts').textContent = fmtNum(state.catalog.total_gifts);
  $('stat-collections').textContent = fmtNum(state.collections.length);
}

function updateCounter() {
  const note = $('stale-note');
  if (state.catalog.loading) {
    $('stale-text').textContent =
      `Katalog to'lmoqda — hozircha ${fmtNum(state.feed.total)} ta gift mavjud.`;
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}

// ───────────────────────────── Detal ekrani ─────────────────────────────

function openDetail(gift) {
  state.gift = gift;
  state.days = gift.min_days;

  $('detail-collection').textContent = gift.collection_name || 'NFT GIFT';
  $('detail-name').textContent = gift.nft_name;
  $('detail-perday').textContent = fmtNum(gift.price_per_day_uzs);
  mountImage($('detail-img'), gift.image_url);

  const slider = $('days-slider');
  slider.min = gift.min_days;
  slider.max = gift.max_days;
  slider.value = gift.min_days;

  $('days-min').textContent = `${gift.min_days} kun`;
  $('days-max').textContent = `${gift.max_days} kun`;

  buildQuickDays($('quick-days'), gift.min_days, gift.max_days, (d) => {
    slider.value = d;
    updateDetail();
  });

  updateDetail();
  showScreen('detail');
  haptic('light');
}

/** Tez tanlash tugmalari — slayderni aniq tortish shart bo'lmasin. */
function buildQuickDays(container, min, max, onPick) {
  const candidates = [];
  for (const d of [min, 7, 14, 30, 60, 90, max]) {
    if (d >= min && d <= max && !candidates.includes(d)) candidates.push(d);
  }

  container.innerHTML = '';
  for (const d of candidates.slice(0, 5)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-day';
    btn.dataset.days = String(d);
    btn.textContent = `${d} kun`;
    btn.addEventListener('click', () => { onPick(d); haptic('light'); });
    container.appendChild(btn);
  }
}

function syncQuickDays(container, days) {
  container.querySelectorAll('.quick-day').forEach((b) => {
    b.classList.toggle('is-active', Number(b.dataset.days) === days);
  });
}

function updateDetail() {
  const gift = state.gift;
  if (!gift) return;

  const days = Number($('days-slider').value);
  state.days = days;

  const base  = gift.price_per_day_uzs * days;
  const fee   = state.pricing.service_fee_uzs;
  const total = base + fee;

  $('days-value').textContent = days;
  $('sum-base').textContent   = fmtSom(base);
  $('sum-fee').textContent    = fmtSom(fee);
  $('sum-total').textContent  = fmtSom(total);

  syncQuickDays($('quick-days'), days);

  const hint = $('detail-hint');
  const canAfford = affordableDays(gift.price_per_day_nano);
  const payBtn = $('pay-btn');

  if (state.balance < total) {
    hint.className = 'hint is-warn';
    hint.textContent = canAfford > 0
      ? `Balansingiz ${canAfford} kunga yetadi. ${fmtSom(total - state.balance)} yetishmayapti.`
      : `Balans yetarli emas — ${fmtSom(total - state.balance)} yetishmayapti.`;
    // Boshi berk ko'chaga olib bormaymiz: tugma to'g'ridan-to'g'ri botdagi
    // to'lov oynasiga olib o'tadi.
    payBtn.textContent = `${fmtSom(total - state.balance)} to'ldirish`;
    payBtn.disabled = false;
    payBtn.dataset.action = 'topup';
  } else {
    hint.className = 'hint';
    hint.textContent = `To'lovdan keyin balans: ${fmtSom(state.balance - total)}`;
    payBtn.textContent = `${fmtSom(total)} — To'lash`;
    payBtn.disabled = false;
    payBtn.dataset.action = 'pay';
  }
}

async function payRent() {
  const gift = state.gift;
  if (!gift) return;

  // Balans yetmaganda tugma to'lov oynasini ochadi (xarid emas).
  if ($('pay-btn').dataset.action === 'topup') return openTopup();

  const btn = $('pay-btn');
  setBusy(btn, true, 'To\'lanmoqda…');

  try {
    const result = await api('/rentals', {
      method: 'POST',
      body: JSON.stringify({ nft_address: gift.nft_address, days: state.days }),
    });

    state.balance = result.balance_uzs;
    renderBalancePill();
    haptic('success');
    toast("To'lov qabul qilindi! Tasdiqlash 1-2 daqiqa davom etadi.", 'success');

    await refreshRentals();
    showScreen('mine');
    startPaymentWatcher();
  } catch (err) {
    haptic('error');
    if (err.status === 402) {
      state.balance = err.payload?.balance_uzs ?? state.balance;
      renderBalancePill();
      updateDetail();
    }
    // Giftni kimdir bizdan oldin olgan bo'lsa — ro'yxatni yangilab,
    // marketga qaytaramiz. Bo'lmagan giftga qarab turishning ma'nosi yo'q.
    if (err.payload?.gone) {
      showScreen('market', { push: false });
      state.history = [];
      await loadGifts({ reset: true });
    }
    toast(err.message, 'error');
  } finally {
    setBusy(btn, false);
    updateDetail();
  }
}

// ───────────────────────────── Mening giftlarim ─────────────────────────────

const STATUS_META = {
  paying:       { cls: 'is-paying',  label: 'To\'lov tasdiqlanmoqda…' },
  pending_link: { cls: 'is-pending', label: 'Profilga ulash kutilmoqda' },
  linked:       { cls: 'is-active',  label: 'Faol' },
  failed:       { cls: 'is-failed',  label: 'Amalga oshmadi' },
  expired:      { cls: 'is-failed',  label: 'Muddati tugagan' },
};

function renderMine() {
  const list = $('mine-list');
  renderMineStats();

  if (state.rentals.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <svg class="ico ico-lg"><use href="#i-empty-gift"/></svg>
        <b>Hozircha gift yo'q</b>
        <span>Market bo'limidan birinchi giftingizni ijaraga oling</span>
      </div>`;
    return;
  }

  list.innerHTML = '';

  for (const rental of state.rentals) {
    const meta = STATUS_META[rental.status] || STATUS_META.pending_link;

    const card = document.createElement('article');
    card.className = 'mine-card';
    card.innerHTML = `
      <div class="mine-top">
        <div class="mine-img"></div>
        <div class="mine-info">
          <div class="mine-name">${escapeHtml(rental.nft_name)}</div>
          <div class="mine-col">${escapeHtml(rental.collection_name || '')}</div>
          ${rental.bundle_label
            ? `<span class="mine-bundle"><svg class="ico ico-sm"><use href="#i-tab-bundle-on"/></svg>${escapeHtml(rental.bundle_label)}</span>`
            : ''}
          <div class="status ${meta.cls}"><i></i>${
            rental.status === 'linked' && rental.left_days !== null
              ? `Faol — ${rental.left_days} kun qoldi`
              : meta.label
          }</div>
        </div>
      </div>`;

    mountImage(el('.mine-img', card), rental.image_url);

    if (rental.status === 'linked' && rental.total_days > 0 && rental.left_days !== null) {
      const percent = Math.max(2, Math.min(100, (rental.left_days / rental.total_days) * 100));
      const bar = document.createElement('div');
      bar.className = 'mine-progress';
      bar.innerHTML = `<i style="width:${percent}%"></i>`;
      card.appendChild(bar);
    }

    if (rental.status === 'failed') {
      // Pul qaytarilgani — foydalanuvchi uchun eng muhim gap, shuning
      // uchun sabab bo'lmasa ham shu qator ko'rsatiladi.
      const errBox = document.createElement('div');
      errBox.className = 'mine-error';
      errBox.innerHTML =
        (rental.tx_error ? `<b>${escapeHtml(rental.tx_error)}</b><br>` : '') +
        `To'langan ${fmtSom(rental.paid_uzs)} balansingizga qaytarildi.`;
      card.appendChild(errBox);
    }

    // Faol ijarada HAR IKKALA tugma turadi: "Profilga ulash" va "Uzaytirish".
    const actions = document.createElement('div');
    actions.className = 'mine-actions';

    if (rental.status === 'pending_link' || rental.status === 'linked') {
      const linkBtn = document.createElement('button');
      linkBtn.type = 'button';
      linkBtn.className = rental.status === 'pending_link' ? 'btn btn-primary' : 'btn btn-ghost';
      linkBtn.innerHTML =
        '<svg class="ico"><use href="#i-link"/></svg>' +
        (rental.is_linked ? 'Qayta ulash' : 'Profilga ulash');
      linkBtn.addEventListener('click', () => openLink(rental));
      actions.appendChild(linkBtn);

      const extendBtn = document.createElement('button');
      extendBtn.type = 'button';
      extendBtn.className = rental.status === 'linked' ? 'btn btn-primary' : 'btn btn-ghost';
      extendBtn.innerHTML = '<svg class="ico"><use href="#i-extend"/></svg>Uzaytirish';
      extendBtn.addEventListener('click', () => openExtend(rental));
      actions.appendChild(extendBtn);
    }

    if (actions.children.length > 0) card.appendChild(actions);
    list.appendChild(card);
  }
}

async function refreshRentals() {
  try {
    const data = await api('/rentals');
    state.rentals = data.rentals;
    state.balance = data.balance_uzs;
    renderBalancePill();
    if (state.screen === 'mine') renderMine();
    updateMineBadge();
  } catch { /* jim — keyingi urinishda yangilanadi */ }
}

function updateMineBadge() {
  const waiting = state.rentals.some((r) => r.status === 'pending_link' || r.status === 'paying');
  $('mine-badge').hidden = !waiting;
}

/** Giftlarim sarlavhasidagi qisqa xulosa. */
function renderMineStats() {
  const active = state.rentals.filter((r) => r.status === 'linked');
  const waiting = state.rentals.filter(
    (r) => r.status === 'pending_link' || r.status === 'paying'
  );

  const box = $('mine-stats');
  if (state.rentals.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  $('mine-active').textContent = active.length;
  $('mine-waiting').textContent = waiting.length;

  const days = active
    .map((r) => r.left_days)
    .filter((d) => typeof d === 'number');
  $('mine-soonest').textContent = days.length ? `${Math.min(...days)} kun` : '—';
}

/**
 * To'lov tasdiqlanishini kuzatadi. Blokcheyn 15-60 soniya oladi, shuning
 * uchun holat o'zgarguncha bir necha marta tekshiramiz, keyin to'xtaymiz
 * (foydalanuvchi baribir botdan xabar oladi).
 */
let watcherTimer = null;
function startPaymentWatcher() {
  clearInterval(watcherTimer);
  let ticks = 0;

  watcherTimer = setInterval(async () => {
    ticks++;
    await refreshRentals();

    const stillPaying = state.rentals.some((r) => r.status === 'paying');
    if (!stillPaying || ticks >= 20) {
      clearInterval(watcherTimer);
      watcherTimer = null;
    }
  }, 6000);
}

// ───────────────────────────── Profilga ulash ─────────────────────────────

function openLink(rental) {
  state.rental = rental;
  $('link-subtitle').textContent = rental.nft_name;
  $('tc-input').value = '';
  $('link-hint').className = 'hint';
  $('link-hint').textContent = '';

  // Video ham, YouTube havolasi ham bo'lmasa tugma umuman ko'rsatilmaydi.
  const video = $('video-btn');
  if (state.settings.profile_link_video_url) video.href = state.settings.profile_link_video_url;
  video.hidden = !(state.settings.profile_link_video_url || state.settings.profile_link_youtube_url);

  showScreen('link');
  haptic('light');
}

async function submitLink() {
  const url = $('tc-input').value.trim();
  const hint = $('link-hint');

  if (!/^(tc:\/\/|https:\/\/)/.test(url)) {
    hint.className = 'hint is-error';
    hint.textContent = "tc:// yoki https:// bilan boshlanuvchi havola kiriting";
    haptic('error');
    return;
  }

  const btn = $('link-btn');
  setBusy(btn, true, 'Ulanmoqda…');
  hint.className = 'hint';
  hint.textContent = '';

  try {
    await api(`/rentals/${state.rental.id}/link`, {
      method: 'POST',
      body: JSON.stringify({ tonconnect_url: url }),
    });

    haptic('success');
    toast('Ulandi! Fragment profilida «Display on Telegram» ni yoqing.', 'success');
    await refreshRentals();
    state.history = [];
    state.screen = '';
    showScreen('mine', { push: false });
  } catch (err) {
    haptic('error');
    hint.className = 'hint is-error';
    hint.textContent = err.message;
  } finally {
    setBusy(btn, false);
  }
}

// ───────────────────────────── Uzaytirish ─────────────────────────────

function openExtend(rental) {
  state.rental = rental;

  // Uzaytirish ENG KAM muddatdan boshlanadi: har bir uzaytirish
  // blokcheynga alohida tranzaksiya yuboradi va uning komissiyasi
  // muddatga bog'liq emas.
  const minDays = state.pricing.extend_min_days || 1;
  state.extendDays = minDays;

  $('extend-name').textContent = rental.nft_name;
  $('extend-perday').textContent = fmtNum(rental.price_per_day_uzs);
  mountImage($('extend-img'), rental.image_url);

  const maxDays = Math.max(minDays, Math.min(365, rental.extend_affordable_days || minDays));
  const slider = $('extend-slider');
  slider.min = minDays;
  slider.max = maxDays;
  slider.value = minDays;
  $('extend-min').textContent = `${minDays} kun`;
  $('extend-max').textContent = `${maxDays} kun`;

  buildQuickDays($('extend-quick'), minDays, maxDays, (d) => {
    slider.value = d;
    updateExtend();
  });

  updateExtend();
  showScreen('extend');
  haptic('light');
}

function updateExtend() {
  const rental = state.rental;
  if (!rental) return;

  const minDays = state.pricing.extend_min_days || 1;
  const days = Math.max(minDays, Number($('extend-slider').value));
  state.extendDays = days;

  // Server bilan BIR XIL formula: kunlik × kun + uzaytirish xizmat haqi.
  const fee = state.pricing.extend_fee_uzs || 0;
  const base = rental.price_per_day_uzs * days;
  const total = base + fee;

  $('extend-days-value').textContent = days;
  $('extend-base').textContent = fmtSom(base);
  $('extend-fee').textContent = fmtSom(fee);
  $('extend-fee-row').hidden = fee === 0;
  $('extend-total').textContent = fmtSom(total);
  syncQuickDays($('extend-quick'), days);

  const hint = $('extend-hint');
  const btn = $('extend-btn');

  if (state.balance < total) {
    hint.className = 'hint is-warn';
    hint.textContent = `Balans yetarli emas — ${fmtSom(total - state.balance)} yetishmayapti.`;
    btn.textContent = `${fmtSom(total - state.balance)} to'ldirish`;
    btn.disabled = false;
    btn.dataset.action = 'topup';
  } else {
    hint.className = 'hint';
    hint.textContent = `To'lovdan keyin balans: ${fmtSom(state.balance - total)}`;
    btn.textContent = `${fmtSom(total)} — Uzaytirish`;
    btn.disabled = false;
    btn.dataset.action = 'extend';
  }
}

async function submitExtend() {
  const btn = $('extend-btn');
  if (btn.dataset.action === 'topup') return openTopup();
  setBusy(btn, true, 'Uzaytirilmoqda…');

  try {
    const result = await api(`/rentals/${state.rental.id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days: state.extendDays }),
    });

    state.balance = result.balance_uzs;
    renderBalancePill();
    haptic('success');
    toast('Uzaytirish navbatga qo\'yildi — tez orada tasdiqlanadi.', 'success');

    await refreshRentals();
    state.history = [];
    state.screen = '';
    showScreen('mine', { push: false });
  } catch (err) {
    haptic('error');
    toast(err.message, 'error');
    if (err.status === 402) {
      state.balance = err.payload?.balance_uzs ?? state.balance;
      renderBalancePill();
      updateExtend();
    }
  } finally {
    setBusy(btn, false);
  }
}

// ───────────────────────────── Telegramga chiqish ─────────────────────────────

/**
 * Telegram havolasini ochadi. `openTelegramLink` ilovadan chiqmasdan ochadi;
 * eski versiyalarda esa oddiy havolaga tushamiz.
 */
function openTelegram(url) {
  try {
    if (tg?.openTelegramLink) return tg.openTelegramLink(url);
  } catch { /* pastdagi zaxira variantga o'tamiz */ }
  window.open(url, '_blank');
}

/**
 * Botdagi to'lov oynasini ochadi.
 *
 * `?start=pay` deeplinki bot menyularini chetlab o'tib, to'g'ridan-to'g'ri
 * summa so'rash bosqichiga olib boradi — foydalanuvchi balans yetmaganda
 * bir bosishda to'lovga tushadi.
 */
function openTopup() {
  haptic('light');
  const bot = state.settings.bot_username;
  if (bot) {
    openTelegram(`https://t.me/${bot}?start=pay`);
    setTimeout(() => tg?.close?.(), 250);
  } else {
    toast('Botdagi «💰 Balans → 💳 To\'lov» bo\'limiga o\'ting');
    setTimeout(() => tg?.close?.(), 1400);
  }
}

/** "Rare Bird #7043" → "rarebird-7043" (server bilan bir xil qoida). */
function giftSlug(name) {
  return String(name || '')
    .trim()
    .replace(/\s*#\s*/g, '-')
    .replace(/[\s_]+/g, '')
    .toLowerCase();
}

// ───────────────────────────── Video qo'llanma ─────────────────────────────

function openVideoSheet() {
  const frame = $('video-frame');
  const url = state.settings.profile_link_video_url;

  if (!frame.dataset.loaded) {
    if (url && /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      // To'g'ridan-to'g'ri video fayli — ilova ichida o'ynatamiz
      frame.innerHTML =
        `<video src="${escapeHtml(url)}" controls playsinline preload="metadata"></video>`;
    } else if (url) {
      // Boshqa har qanday havola (YouTube va h.k.) — faqat "Batafsil" tugmasi
      frame.innerHTML =
        '<div class="video-empty">Qisqa video hozircha yo\'q.<br>Pastdagi tugma orqali to\'liq qo\'llanmani ko\'ring.</div>';
    } else {
      frame.innerHTML =
        '<div class="video-empty">Video qo\'llanma hali qo\'shilmagan.</div>';
    }
    frame.dataset.loaded = '1';
  }

  const more = $('video-more');
  const youtube = state.settings.profile_link_youtube_url;
  if (youtube) {
    more.href = youtube;
    more.hidden = false;
  } else {
    more.hidden = true;
  }

  $('video-sheet').classList.add('is-open');
  haptic('light');
}

function closeVideoSheet() {
  $('video-sheet').classList.remove('is-open');
  // Varaq yopilganda video to'xtasin
  const v = $('video-frame').querySelector('video');
  if (v) v.pause();
}

// ───────────────────────────── To'plamlar ─────────────────────────────

/**
 * To'plam — bir xil fon / model / belgidagi 3, 6, 9 yoki 12 ta gift,
 * bitta to'lovda, kamida 7 kunga.
 *
 * NARX faqat YAKUNIY ko'rsatiladi. Server har bir giftning narxini
 * yubormaydi, faqat tanlangan o'lcham uchun KUNLIK YIG'INDINI beradi —
 * shu bitta son bilan slayder jonli ishlaydi va formula server bilan
 * bir xil bo'lib qoladi.
 */

function bundleTotalUzs(perDayUzs, size, days) {
  const subtotal = perDayUzs * days + state.pricing.service_fee_uzs * size;
  const markup = Math.ceil((subtotal * state.bundleCfg.markup_pct) / 100);
  return subtotal + markup;
}

/** Tanlangan o'lchamning narx ma'lumoti. */
function bundlePriceRow(bundle, size) {
  return (bundle.prices || []).find((p) => p.size === size) || null;
}

function resetBundles() {
  state.bundles = {
    items: [], offset: 0, total: 0, hasMore: true, busy: false,
    kind: state.bundles.kind, version: '',
  };
  $('bundle-list').innerHTML = '';
}

function renderBundleSkeleton(count = 4) {
  $('bundle-list').innerHTML = Array.from({ length: count }, () => `
    <div class="bcard is-skeleton">
      <div class="bcard-mosaic"></div>
      <div class="bcard-body"><span></span><span></span></div>
    </div>`).join('');
}

async function loadBundles({ reset = false } = {}) {
  if (state.bundles.busy) return;
  if (!reset && !state.bundles.hasMore) return;

  if (reset) {
    resetBundles();
    renderBundleSkeleton();
  }
  state.bundles.busy = true;

  const params = new URLSearchParams({
    offset: String(state.bundles.offset),
    limit: '20',
  });
  if (state.bundles.kind) params.set('kind', state.bundles.kind);

  try {
    const page = await api(`/bundles?${params.toString()}`);

    // Katalog yangilangan bo'lsa to'plamlar ham qayta yig'iladi —
    // sahifalash surilib ketmasligi uchun boshidan boshlaymiz.
    if (state.bundles.version && page.version !== state.bundles.version && !reset) {
      state.bundles.busy = false;
      return loadBundles({ reset: true });
    }
    state.bundles.version = page.version;

    if (reset) $('bundle-list').innerHTML = '';

    state.bundles.items.push(...page.items);
    state.bundles.offset += page.items.length;
    state.bundles.total = page.total;
    state.bundles.hasMore = page.has_more;

    if (state.bundles.items.length === 0) {
      $('bundle-list').innerHTML = `
        <div class="empty">
          <svg class="ico ico-lg"><use href="#i-${state.catalog.loading ? 'refresh' : 'empty-search'}"/></svg>
          <b>${state.catalog.loading ? 'Katalog yuklanmoqda' : 'To\'plam topilmadi'}</b>
          <span>${state.catalog.loading
            ? 'To\'plamlar katalog to\'lgach paydo bo\'ladi'
            : 'Boshqa turni tanlab ko\'ring'}</span>
        </div>`;
    } else {
      appendBundleCards(page.items);
    }
  } catch (err) {
    if (state.bundles.items.length === 0) {
      $('bundle-list').innerHTML = `
        <div class="empty">
          <svg class="ico ico-lg"><use href="#i-empty-net"/></svg>
          <b>Yuklab bo'lmadi</b><span>${escapeHtml(err.message)}</span>
        </div>`;
    } else {
      toast(err.message, 'error');
    }
  } finally {
    state.bundles.busy = false;
  }
}

function appendBundleCards(items) {
  const list = $('bundle-list');
  const frag = document.createDocumentFragment();
  const pending = [];

  for (const bundle of items) {
    const first = bundle.prices[0];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `bcard bcard-${bundle.kind}`;
    card.innerHTML = `
      <div class="bcard-mosaic">
        ${bundle.preview.map(() => '<div class="bcard-cell"></div>').join('')}
        <span class="bcard-count">${bundle.available} ta</span>
      </div>
      <div class="bcard-body">
        <span class="bcard-kind">
          <svg class="ico ico-sm"><use href="#i-${bundle.kind === 'backdrop' ? 'palette' : 'sparkle'}"/></svg>
          ${escapeHtml(bundle.kind_label)}
        </span>
        <div class="bcard-name">${escapeHtml(bundle.value)}</div>
        <div class="bcard-col">${escapeHtml(bundle.collection_name)}</div>
        <div class="bcard-foot">
          <span class="bcard-sizes">${bundle.sizes.join(' · ')} ta</span>
          <span class="bcard-price">${fmtNum(first.total_uzs)} <i>so'mdan</i></span>
        </div>
      </div>
      <svg class="ico ico-sm bcard-chev"><use href="#i-chevron-right"/></svg>`;

    card.addEventListener('click', () => openBundle(bundle));
    frag.appendChild(card);

    const cells = card.querySelectorAll('.bcard-cell');
    bundle.preview.forEach((p, i) => { if (cells[i]) pending.push([cells[i], p.image_url]); });
  }

  list.appendChild(frag);
  for (const [cell, url] of pending) mountImage(cell, url);
}

// ───────────────────────────── To'plam detali ─────────────────────────────

/**
 * To'plamdagi giftlarni nima birlashtirib turibdi — fon, model, belgi.
 * Daraja qanchalik qat'iy bo'lsa, shuncha ko'p chip chiqadi.
 */
function renderBundleTraits(bundle) {
  const box = $('bundle-traits');
  const rows = [
    ['Fon', bundle.backdrop],
    ['Model', bundle.model],
    ['Belgi', bundle.symbol],
  ].filter(([, value]) => Boolean(value));

  box.innerHTML = rows.map(([label, value]) => `
    <span class="trait">
      <i>${escapeHtml(label)}</i>
      ${escapeHtml(value)}
    </span>`).join('');
}

async function openBundle(summary) {
  state.bundle = null;
  state.bundleSize = summary.sizes[0];
  state.bundleDays = summary.min_days;

  $('bundle-kind').textContent = summary.kind_label;
  $('bundle-name').textContent = summary.value;
  $('bundle-collection').textContent = summary.collection_name;
  renderBundleTraits(summary);
  $('bundle-grid').innerHTML = '';
  $('bundle-total').textContent = '…';
  $('bundle-note').textContent = '';
  showScreen('bundle');

  try {
    const { bundle } = await api(`/bundles/${encodeURIComponent(summary.id)}`);
    state.bundle = bundle;
    state.bundleSize = bundle.sizes[0];
    state.bundleDays = bundle.min_days;

    buildSizeChips(bundle);
    buildQuickDays($('bundle-quick-days'), bundle.min_days, bundle.max_days, (d) => {
      state.bundleDays = d;
      $('bundle-slider').value = String(d);
      updateBundle();
    });

    const slider = $('bundle-slider');
    slider.min = String(bundle.min_days);
    slider.max = String(bundle.max_days);
    slider.value = String(bundle.min_days);
    $('bundle-days-min').textContent = `${bundle.min_days} kun`;
    $('bundle-days-max').textContent = `${bundle.max_days} kun`;

    renderBundleGrid();
    updateBundle();
  } catch (err) {
    if (err.payload?.gone) {
      toast('Bu to\'plam endi mavjud emas', 'error');
      showScreen('bundles', { push: false });
      loadBundles({ reset: true });
      return;
    }
    toast(err.message, 'error');
  }
}

function buildSizeChips(bundle) {
  const box = $('bundle-sizes');
  box.innerHTML = '';
  for (const size of bundle.sizes) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'size-chip' + (size === state.bundleSize ? ' is-active' : '');
    chip.dataset.size = String(size);
    chip.textContent = `${size} ta`;
    chip.addEventListener('click', () => {
      state.bundleSize = size;
      box.querySelectorAll('.size-chip').forEach((c) => {
        c.classList.toggle('is-active', Number(c.dataset.size) === size);
      });
      renderBundleGrid();
      updateBundle();
      haptic('light');
    });
    box.appendChild(chip);
  }
}

/** Giftlar to'ri: tanlangan `bundleSize` tasi yorqin, qolganlari xira. */
function renderBundleGrid() {
  const bundle = state.bundle;
  if (!bundle) return;

  const grid = $('bundle-grid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  const pending = [];

  bundle.gifts.forEach((gift, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'bgift' + (i < state.bundleSize ? ' is-in' : '');
    cell.title = gift.nft_name;
    cell.innerHTML = '<span class="bgift-media"></span>';
    cell.addEventListener('click', () => {
      openTelegram(`https://t.me/nft/${giftSlug(gift.nft_name)}`);
      haptic('light');
    });
    frag.appendChild(cell);
    pending.push([el('.bgift-media', cell), gift.image_url]);
  });

  grid.appendChild(frag);
  for (const [cell, url] of pending) mountImage(cell, url);
}

function updateBundle() {
  const bundle = state.bundle;
  if (!bundle) return;

  const days = Math.max(bundle.min_days, Math.min(bundle.max_days, Number($('bundle-slider').value)));
  state.bundleDays = days;
  $('bundle-days-value').textContent = String(days);
  $('bundle-size-value').textContent = String(state.bundleSize);
  syncQuickDays($('bundle-quick-days'), days);

  const row = bundlePriceRow(bundle, state.bundleSize);
  if (!row) return;

  const total = bundleTotalUzs(row.per_day_uzs, state.bundleSize, days);
  $('bundle-total').textContent = fmtSom(total);
  $('bundle-note').textContent =
    `${state.bundleSize} ta gift · ${days} kun · har bir gift uchun ` +
    `${fmtNum(state.pricing.service_fee_uzs)} so'm xizmat haqi · ` +
    `${state.bundleCfg.markup_pct}% to'plam ustamasi`;

  const enough = state.balance >= total;
  const hint = $('bundle-hint');
  hint.textContent = enough
    ? ''
    : `Balans yetarli emas — yana ${fmtSom(total - state.balance)} kerak.`;
  hint.className = enough ? 'hint' : 'hint is-warn';

  const btn = $('bundle-pay');
  if (enough) {
    btn.textContent = `To'plamni olish — ${fmtSom(total)}`;
    btn.dataset.action = 'pay';
  } else {
    btn.textContent = 'Balansni to\'ldirish';
    btn.dataset.action = 'topup';
  }
}

async function payBundle() {
  const btn = $('bundle-pay');
  if (btn.dataset.action === 'topup') return openTopup();

  const bundle = state.bundle;
  if (!bundle) return;

  const row = bundlePriceRow(bundle, state.bundleSize);
  const total = row ? bundleTotalUzs(row.per_day_uzs, state.bundleSize, state.bundleDays) : 0;

  setBusy(btn, true, 'To\'lov qilinmoqda…');
  try {
    const res = await api(`/bundles/${encodeURIComponent(bundle.id)}/rent`, {
      method: 'POST',
      body: JSON.stringify({ size: state.bundleSize, days: state.bundleDays }),
    });

    state.balance = res.balance_uzs;
    renderBalancePill();
    renderBalance();
    haptic('success');
    toast(`${res.count} ta gift olindi — ${fmtSom(res.cost_uzs)}`, 'success');

    await refreshRentals();
    startPaymentWatcher();
    showScreen('mine');
  } catch (err) {
    haptic('error');
    if (err.payload?.gone) {
      // To'plamdagi giftlar band bo'lib qolgan — ro'yxatni yangilaymiz.
      toast(err.message, 'error');
      showScreen('bundles', { push: false });
      loadBundles({ reset: true });
    } else if (err.status === 402) {
      state.balance = err.payload?.balance_uzs ?? state.balance;
      renderBalancePill();
      updateBundle();
      toast(`Balans yetarli emas — ${fmtSom(total)} kerak`, 'error');
    } else {
      toast(err.message, 'error');
    }
  } finally {
    setBusy(btn, false);
    updateBundle();
  }
}

// ───────────────────────────── Balans ─────────────────────────────

let lastBalance = null;
function renderBalancePill() {
  $('balance-value').textContent = fmtNum(state.balance);

  // Balans o'zgarganda qisqa urg'u beramiz — to'lov o'tgani sezilib turadi.
  if (lastBalance !== null && lastBalance !== state.balance) {
    const pill = $('balance-pill');
    pill.classList.remove('is-bumped');
    void pill.offsetWidth;
    pill.classList.add('is-bumped');
  }
  lastBalance = state.balance;
}

function renderBalance() {
  $('balance-big').textContent = fmtNum(state.balance);
}

// ───────────────────────────── Kolleksiya tanlash ─────────────────────────────

function openCollectionSheet() {
  const list = $('collection-list');
  list.innerHTML = '';

  const makeItem = (label, count, address) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sheet-item' + (state.collection === address ? ' is-active' : '');
    btn.innerHTML = `<span>${escapeHtml(label)}</span><em>${fmtNum(count)}</em>`;
    btn.addEventListener('click', () => {
      state.collection = address;
      $('collection-label').textContent = address ? label : 'Barcha kolleksiyalar';
      closeCollectionSheet();
      loadGifts({ reset: true });
      haptic('light');
    });
    return btn;
  };

  list.appendChild(makeItem('Barcha kolleksiyalar', state.catalog.total_gifts, null));
  for (const col of state.collections) {
    list.appendChild(makeItem(col.name, col.gift_count, col.address));
  }

  $('collection-sheet').classList.add('is-open');
}

function closeCollectionSheet() {
  $('collection-sheet').classList.remove('is-open');
}

// ───────────────────────────── Hodisalar ─────────────────────────────

function bindEvents() {
  document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => { showScreen(tab.dataset.tab); haptic('light'); });
  });

  bindAdsEvents();

  $('balance-pill').addEventListener('click', () => showScreen('balance'));

  // Qidiruv serverga ketadi — yozish paytida har harfda emas, tanaffusdan keyin.
  let searchTimer = null;
  $('search-input').addEventListener('input', (e) => {
    const value = e.target.value;
    $('search-clear').hidden = value === '';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = value.trim();
      loadGifts({ reset: true });
    }, 320);
  });
  $('search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    $('search-clear').hidden = true;
    state.search = '';
    loadGifts({ reset: true });
  });

  $('sort-btn').addEventListener('click', () => {
    state.sort = state.sort === 'asc' ? 'desc' : 'asc';
    $('sort-label').textContent = state.sort === 'asc' ? 'Arzon' : 'Qimmat';
    loadGifts({ reset: true });
    haptic('light');
  });

  $('collection-btn').addEventListener('click', openCollectionSheet);
  $('collection-sheet').addEventListener('click', (e) => {
    if (e.target === $('collection-sheet')) closeCollectionSheet();
  });

  $('days-slider').addEventListener('input', updateDetail);
  $('extend-slider').addEventListener('input', updateExtend);

  $('pay-btn').addEventListener('click', payRent);
  $('link-btn').addEventListener('click', submitLink);
  $('extend-btn').addEventListener('click', submitExtend);

  $('tc-paste').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { $('tc-input').value = text.trim(); haptic('light'); }
    } catch {
      toast('Buferdan o\'qib bo\'lmadi — havolani qo\'lda joylashtiring');
    }
  });

  $('topup-btn').addEventListener('click', openTopup);

  $('bundle-promo').addEventListener('click', () => { showScreen('bundles'); haptic('light'); });
  $('bundle-slider').addEventListener('input', updateBundle);
  $('bundle-pay').addEventListener('click', payBundle);
  $('bundle-kinds').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.bundles.kind = chip.dataset.kind || '';
    $('bundle-kinds').querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('is-active', c === chip);
    });
    loadBundles({ reset: true });
    haptic('light');
  });
  $('mine-refresh').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('is-busy');
    await refreshRentals();
    setTimeout(() => btn.classList.remove('is-busy'), 400);
  });

  $('video-btn').addEventListener('click', (e) => { e.preventDefault(); openVideoSheet(); });
  $('video-close').addEventListener('click', closeVideoSheet);
  $('video-sheet').addEventListener('click', (e) => {
    if (e.target === $('video-sheet')) closeVideoSheet();
  });

  $('view-btn').addEventListener('click', () => {
    const gift = state.gift;
    if (!gift) return;
    haptic('light');
    // Telegram'ning o'z NFT sahifasi: t.me/nft/<nom>-<raqam>
    openTelegram(`https://t.me/nft/${giftSlug(gift.nft_name)}`);
  });

  // Pastga tushganda keyingi sahifani so'raymiz
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.screen === 'market') loadGifts();
    }, { rootMargin: '600px' }).observe($('grid-sentinel'));

    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.screen === 'bundles') loadBundles();
    }, { rootMargin: '600px' }).observe($('bundle-sentinel'));
  }

  tg?.BackButton?.onClick(goBack);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshRentals();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  REKLAMA BO'LIMI
// ═══════════════════════════════════════════════════════════════════════════
//
// Gift Arenda bilan bitta ilovada, lekin o'z dunyosida yashaydi.
// Barcha so'rovlar `/api/ads/*` ga ketadi.

const AD = state.ads;

const PLACEMENT_LABELS = {
  channel_post:  ['Kanal postlari', 'Kanal postlari orasida ko\'rinadi.'],
  bot_banner:    ['Botlarda',       'Botlar ichidagi banner sifatida ko\'rinadi.'],
  search_result: ['Qidiruvda',      'Telegram qidiruvida, natijalar ustida ko\'rinadi.'],
  video_banner:  ['Videolarda',     'Video ko\'rilayotganda banner bo\'lib chiqadi.'],
};

const TARGET_LABELS = {
  channels: 'Kanallar',
  users:    'Odamlar',
  bots:     'Botlar',
  search:   'Qidiruv',
};

const BUTTON_LABELS = {
  subscribe: 'Obuna bo\'lish', view: 'Ko\'rish', read: 'O\'qish',
  learn_more: 'Batafsil', download: 'Yuklab olish', open: 'Ochish',
  sign_up: 'Ro\'yxatdan o\'tish', buy: 'Sotib olish', order: 'Buyurtma',
  play: 'O\'ynash', try: 'Sinab ko\'rish', leave_request: 'Ariza qoldirish',
};

const STATUS_LABELS = {
  draft:            ['Qoralama',        'st-stopped'],
  stopped:          ['To\'xtatilgan',   'st-stopped'],
  ready_for_review: ['Yuborilmagan',    'st-hold'],
  in_review:        ['Ko\'rikda',       'st-review'],
  declined:         ['Rad etilgan',     'st-declined'],
  active:           ['Faol',            'st-active'],
  on_hold:          ['Kutilmoqda',      'st-hold'],
};

/** Telegram ruxsat bergan vaqt mintaqalari (soniyada, UTC dan siljish). */
const TIMEZONES = [
  -43200, -39600, -36000, -34200, -32400, -28800, -25200, -21600, -18000,
  -14400, -12600, -10800, -9000, -7200, -3600, 0, 3600, 7200, 10800, 12600,
  14400, 16200, 18000, 19800, 20700, 21600, 23400, 25200, 28800, 31500,
  32400, 34200, 36000, 37800, 39600, 43200, 45900, 46800, 49500, 50400,
];

const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

/** `/api/ads/...` ga so'rov. */
function adsApi(path, options) {
  return api(`/ads${path}`, options);
}

function tonFmt(n) {
  return `${Number(n).toFixed(2)} TON`;
}

function statusPill(status) {
  const [label, cls] = STATUS_LABELS[status] || [status, 'st-stopped'];
  return `<i class="st ${cls}">${escapeHtml(label)}</i>`;
}

// ───────────────────────────── Bootstrap ─────────────────────────────

/**
 * Reklama bo'limi ochilganda bir marta sozlanadi.
 *
 * Ma'lumotnomalar (davlatlar, tillar, mavzular) KERAK BO'LGANDA yuklanadi:
 * ilova ochilishida ularni tortib olish ochilishni sekinlashtirardi va
 * reklama bo'limiga kirmaydigan foydalanuvchiga umuman kerak emas.
 */
async function onAdsCreateOpen() {
  if (AD.ready) return;

  try {
    const cfg = await adsApi('/bootstrap');
    AD.cfg = cfg;
    AD.enabled = Boolean(cfg.enabled);

    if (!cfg.enabled || cfg.account_ok === false) {
      $('ads-gate').hidden = false;
      $('ads-form').hidden = true;
      $('ads-gate-text').textContent = cfg.enabled
        ? 'Reklama xizmati vaqtincha javob bermayapti. Birozdan keyin urinib ko\'ring.'
        : 'Reklama bo\'limi hozircha mavjud emas.';
      return;
    }

    $('ads-gate').hidden = true;
    $('ads-form').hidden = false;

    const refs = await adsApi('/refs');
    AD.refs = refs;

    buildAdForm();
    AD.ready = true;
  } catch (err) {
    $('ads-gate').hidden = false;
    $('ads-form').hidden = true;
    $('ads-gate-text').textContent = err.message;
  }
}

// ───────────────────────────── Forma qurilishi ─────────────────────────────

function buildAdForm() {
  const cfg = AD.cfg;

  // Joylashuv
  const placement = $('ad-placement');
  placement.innerHTML = '';
  (cfg.placements || Object.keys(PLACEMENT_LABELS)).forEach((key, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.textContent = (PLACEMENT_LABELS[key] || [key])[0];
    b.className = i === 0 ? 'is-on' : '';
    b.addEventListener('click', () => {
      AD.placement = key;
      [...placement.children].forEach((c) => c.classList.toggle('is-on', c === b));
      $('ad-placement-hint').textContent = (PLACEMENT_LABELS[key] || ['', ''])[1];
      haptic('light');
    });
    placement.appendChild(b);
  });

  // Targeting turi
  const tt = $('ad-target-type');
  tt.innerHTML = '';
  Object.entries(TARGET_LABELS).forEach(([key, label], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = i === 0 ? 'is-on' : '';
    b.addEventListener('click', () => {
      AD.target = key;
      [...tt.children].forEach((c) => c.classList.toggle('is-on', c === b));
      document.querySelectorAll('.tgt').forEach((n) => { n.hidden = n.dataset.tgt !== key; });
      syncAdNote();
      haptic('light');
    });
    tt.appendChild(b);
  });
  document.querySelectorAll('.tgt').forEach((n) => { n.hidden = n.dataset.tgt !== 'channels'; });

  // Tugma yozuvlari
  const btnSel = $('ad-button');
  btnSel.innerHTML = '<option value="">Standart ("Saytni ochish")</option>';
  (cfg.buttons || Object.keys(BUTTON_LABELS)).forEach((key) => {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = BUTTON_LABELS[key] || key;
    btnSel.appendChild(o);
  });

  // Vaqt mintaqalari
  const tzSel = $('ad-tz');
  tzSel.innerHTML = '';
  TIMEZONES.forEach((off) => {
    const o = document.createElement('option');
    o.value = String(off);
    const h = Math.trunc(Math.abs(off) / 3600);
    const m = Math.round((Math.abs(off) % 3600) / 60);
    o.textContent = `UTC${off < 0 ? '−' : '+'}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (off === 18000) o.selected = true; // Toshkent
    tzSel.appendChild(o);
  });

  // Tanlovchilar
  pickList($('tgt-ch-langs'),  AD.refs.languages, 'language_code', 'name', AD.sel.chLangs, 8);
  pickList($('tgt-ch-topics'), AD.refs.topics,    'topic_id',      'name', AD.sel.chTopics, 20);
  pickList($('tgt-u-countries'), AD.refs.countries, 'country_code', 'name', AD.sel.countries, 8, true);
  pickList($('tgt-u-langs'),   AD.refs.languages, 'language_code', 'name', AD.sel.uLangs, 8);
  pickList($('tgt-u-topics'),  AD.refs.topics,    'topic_id',      'name', AD.sel.uTopics, 20);

  buildSchedule();
  syncQuote();
  syncAdNote();
}

/**
 * Ko'p tanlanadigan ro'yxat.
 *
 * 30 tadan ko'p element bo'lsa qidiruv maydoni qo'shiladi — 200 ta
 * davlatni ko'zdan kechirish telefonda imkonsiz.
 */
function pickList(box, items, valueKey, labelKey, selected, limit, searchable = false) {
  box.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    box.innerHTML = '<p class="hint">Ro\'yxat bo\'sh.</p>';
    return;
  }

  let filter = '';
  const wrap = document.createElement('div');
  wrap.className = 'picks';
  wrap.style.margin = '0';

  const draw = () => {
    wrap.innerHTML = '';
    const needle = filter.toLowerCase();
    const visible = items
      .filter((it) => !needle || String(it[labelKey]).toLowerCase().includes(needle))
      .slice(0, searchable && !needle ? 24 : 400);

    visible.forEach((it) => {
      const value = it[valueKey];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pick' + (selected.has(value) ? ' is-on' : '');
      chip.innerHTML = `<span>${escapeHtml(String(it[labelKey]))}</span>`;
      chip.addEventListener('click', () => {
        if (selected.has(value)) {
          selected.delete(value);
        } else {
          if (selected.size >= limit) { toast(`Eng ko'pi ${limit} ta`, 'warn'); return; }
          selected.add(value);
        }
        chip.classList.toggle('is-on', selected.has(value));
        haptic('light');
      });
      wrap.appendChild(chip);
    });

    if (visible.length === 0) {
      wrap.innerHTML = '<p class="hint">Topilmadi.</p>';
    }
  };

  if (searchable || items.length > 30) {
    const field = document.createElement('div');
    field.className = 'field';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Qidirish…';
    input.addEventListener('input', () => { filter = input.value.trim(); draw(); });
    field.appendChild(input);
    box.appendChild(field);
  }

  box.appendChild(wrap);
  draw();
}

/** Qo'lda kiritiladigan ro'yxat (kanallar, botlar, qidiruv so'zlari). */
function renderTokenList(box, list, onRemove) {
  box.innerHTML = '';
  list.forEach((item, i) => {
    const chip = document.createElement('span');
    chip.className = 'pick' + (item.exclude ? ' is-x' : ' is-on');
    chip.innerHTML = `<span>${escapeHtml(item.label)}</span><i class="pick-del">×</i>`;
    chip.querySelector('.pick-del').addEventListener('click', () => {
      onRemove(i);
      haptic('light');
    });
    box.appendChild(chip);
  });
}

// ───────────────────────────── Jadval ─────────────────────────────

function buildSchedule() {
  const grid = $('ad-sched');
  grid.innerHTML = '';

  for (let day = 0; day < 7; day++) {
    const label = document.createElement('div');
    label.className = 'sched-row-label';
    label.textContent = DAY_NAMES[day];
    grid.appendChild(label);

    for (let hour = 0; hour < 24; hour++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.title = `${DAY_NAMES[day]} ${String(hour).padStart(2, '0')}:00`;
      cell.addEventListener('click', () => {
        AD.schedule[day] ^= (1 << hour);
        cell.classList.toggle('is-on', Boolean(AD.schedule[day] & (1 << hour)));
        haptic('light');
      });
      grid.appendChild(cell);
    }
  }
  paintSchedule();
}

function paintSchedule() {
  const cells = $('ad-sched').querySelectorAll('button');
  let i = 0;
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells[i++].classList.toggle('is-on', Boolean(AD.schedule[day] & (1 << hour)));
    }
  }
}

function fillSchedule(fromHour, toHour) {
  let mask = 0;
  for (let h = fromHour; h < toHour; h++) mask |= (1 << h);
  AD.schedule = new Array(7).fill(mask);
  paintSchedule();
}

// ───────────────────────────── Narx ─────────────────────────────

/**
 * Narx KLIENTDA hisoblanadi — slayder/maydon o'zgarganda darhol ko'rinsin.
 * Server baribir o'zi qayta hisoblaydi, ya'ni bu faqat ko'rsatish uchun.
 */
function syncQuote() {
  const cfg = AD.cfg;
  if (!cfg) return;

  const total = Math.floor(Number($('ad-budget').value) || 0);
  const box = $('ad-quote');
  if (total <= 0) { box.hidden = true; return; }

  const budgetUzs = Math.round((total * 100) / (100 + cfg.markup_pct));
  const feeUzs = total - budgetUzs;
  const ton = Math.floor((budgetUzs / cfg.ton_rate_uzs) * 100) / 100;

  $('q-pct').textContent = String(cfg.markup_pct);
  $('q-budget').textContent = fmtSom(budgetUzs);
  $('q-fee').textContent = fmtSom(feeUzs);
  $('q-total').textContent = fmtSom(total);
  $('q-ton').textContent = tonFmt(ton);
  box.hidden = false;
}

function syncAdNote() {
  const url = $('ad-url').value.trim();
  const external = url !== '' && !/^https?:\/\/t\.me\//i.test(url);
  $('ad-website-wrap').hidden = !external;
}

// ───────────────────────────── Yuborish ─────────────────────────────

/** Formadan targeting obyektini yig'adi. */
function collectTarget() {
  const s = AD.sel;

  if (AD.target === 'channels') {
    return {
      type: 'channels',
      language_codes: [...s.chLangs],
      topic_ids: [...s.chTopics],
      channel_ids: s.channels.map((c) => c.value),
      exclude_channel_ids: s.exChannels.map((c) => c.value),
    };
  }
  if (AD.target === 'users') {
    return {
      type: 'users',
      country_codes: [...s.countries],
      location_ids: s.locations.map((l) => l.value),
      language_codes: [...s.uLangs],
      topic_ids: [...s.uTopics],
      intersect_topics: $('tgt-u-intersect').checked,
      channel_ids: s.uChannels.map((c) => c.value),
      audience_ids: [...s.audiences],
      device: $('tgt-u-device').value || undefined,
      exclude_political_channels: $('tgt-u-nopolitics').checked,
    };
  }
  if (AD.target === 'bots') {
    return { type: 'bots', bot_ids: s.bots.map((b) => b.value) };
  }
  return { type: 'search', search_queries: s.queries.map((q) => q.value) };
}

/** Sanani `datetime-local` dan Unix vaqtiga o'giradi. */
function localToUnix(value) {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

function collectAdPayload() {
  const payload = {
    title: $('ad-title').value.trim(),
    text: $('ad-text').value.trim(),
    promote_url: $('ad-url').value.trim(),
    placement: AD.placement,
    target: collectTarget(),
    cpm: Number($('ad-cpm').value) || 0,
    budget_uzs: Math.floor(Number($('ad-budget').value) || 0),
    impression_frequency: Number($('ad-freq').value) || 1,
    show_userpic: $('ad-userpic').checked,
    activate_date: localToUnix($('ad-start').value),
    deactivate_date: localToUnix($('ad-end').value),
  };

  const daily = Number($('ad-daily').value);
  if (Number.isFinite(daily) && daily > 0) payload.daily_budget_limit = daily;

  if (!$('ad-website-wrap').hidden) {
    payload.website_name = $('ad-website').value.trim();
    const button = $('ad-button').value;
    if (button) payload.button = button;
  }

  if (AD.media?.kind === 'photo') payload.photo_id = AD.media.id;
  if (AD.media?.kind === 'video') payload.video_id = AD.media.id;

  if ($('ad-sched-on').checked) {
    payload.schedule = {
      week_hours_mask: AD.schedule,
      use_viewer_timezone: $('ad-sched-viewer').checked,
      timezone: $('ad-sched-viewer').checked ? undefined : Number($('ad-tz').value),
    };
  }

  return payload;
}

async function submitAd(e) {
  e.preventDefault();
  const button = $('ad-submit');

  try {
    setBusy(button, true, 'Yuborilmoqda…');
    const data = await adsApi('/', {
      method: 'POST',
      body: JSON.stringify(collectAdPayload()),
    });

    state.balance = data.balance_uzs;
    renderBalancePill();
    AD.items.unshift(data.ad);
    resetAdForm();

    haptic('success');
    toast('Reklama yaratildi — ko\'rikka yuborildi', 'success');
    showScreen('ads-mine');
  } catch (err) {
    haptic('error');
    if (err.payload?.balance_uzs !== undefined) {
      state.balance = err.payload.balance_uzs;
      renderBalancePill();
    }
    toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
}

function resetAdForm() {
  $('ads-form').reset();
  AD.media = null;
  AD.schedule = new Array(7).fill(0);
  Object.values(AD.sel).forEach((v) => {
    if (v instanceof Set) v.clear();
    else if (Array.isArray(v)) v.length = 0;
  });
  $('ad-media-preview').hidden = true;
  $('ad-media-preview').innerHTML = '';
  $('ad-media-clear').hidden = true;
  $('ad-quote').hidden = true;
  $('ad-text-count').textContent = '0';
  if (AD.refs) buildAdForm();
}

// ───────────────────────────── Fayl yuklash ─────────────────────────────

/**
 * Fayl XOM BAYT bo'lib ketadi, base64 emas: base64 hajmni üchdan bir
 * baravar oshiradi va 20 MB lik video 27 MB lik so'rovga aylanardi.
 */
async function uploadMedia(file, kind) {
  const path = kind === 'photo' ? '/upload/photo' : '/upload/video';
  const res = await fetch(`/api/ads${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      Authorization: `tma ${initData}`,
    },
    body: file,
  });

  let data = {};
  try { data = await res.json(); } catch { /* bo'sh javob */ }
  if (!res.ok) throw new Error(data.error || `Yuklab bo'lmadi (${res.status})`);

  const result = data.result || {};
  AD.media = {
    kind,
    id: kind === 'photo' ? result.photo_id : result.video_id,
    url: kind === 'photo' ? result.photo_url : result.video_url,
  };

  const box = $('ad-media-preview');
  box.innerHTML = kind === 'photo'
    ? `<img src="${escapeHtml(AD.media.url)}" alt="">`
    : `<video src="${escapeHtml(AD.media.url)}" controls playsinline></video>`;
  box.hidden = false;
  $('ad-media-clear').hidden = false;
}

// ───────────────────────────── Mening reklamalarim ─────────────────────────────

async function loadMyAds() {
  const box = $('ads-list');
  if (AD.items.length === 0) {
    box.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
  }

  try {
    const data = await adsApi('/');
    AD.items = data.items || [];
    renderAdsList();
  } catch (err) {
    box.innerHTML = `<p class="hint is-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderAdsList() {
  const box = $('ads-list');
  box.innerHTML = '';

  if (AD.items.length === 0) {
    $('ads-stats-row').hidden = true;
    box.innerHTML = `
      <div class="empty">
        <svg class="ico"><use href="#i-tab-ads"/></svg>
        <h3>Hali reklama yo'q</h3>
        <p>"Reklama" bo'limida birinchi reklamangizni yarating.</p>
      </div>`;
    return;
  }

  const totals = AD.items.reduce(
    (acc, ad) => ({
      active: acc.active + (ad.status === 'active' ? 1 : 0),
      views: acc.views + ad.views,
      clicks: acc.clicks + ad.clicks,
    }),
    { active: 0, views: 0, clicks: 0 }
  );
  $('ads-active').textContent = String(totals.active);
  $('ads-views').textContent = fmtNum(totals.views);
  $('ads-clicks').textContent = fmtNum(totals.clicks);
  $('ads-stats-row').hidden = false;

  AD.items.forEach((ad) => {
    const card = document.createElement('div');
    card.className = 'ad-card';
    card.innerHTML = `
      <div class="ad-card-top">
        <span class="ad-card-title">${escapeHtml(ad.title)}</span>
        ${statusPill(ad.status)}
      </div>
      ${ad.text ? `<p class="ad-card-text">${escapeHtml(ad.text)}</p>` : ''}
      <div class="ad-card-row">
        <div class="ad-card-metric"><b>${fmtNum(ad.views)}</b><span>Ko'rish</span></div>
        <div class="ad-card-metric"><b>${fmtNum(ad.clicks)}</b><span>Bosish</span></div>
        <div class="ad-card-metric"><b>${ad.ctr}%</b><span>CTR</span></div>
        <div class="ad-card-metric"><b>${fmtSom(ad.budget_uzs)}</b><span>Byudjet</span></div>
      </div>`;
    card.addEventListener('click', () => openAd(ad));
    box.appendChild(card);
  });
}

// ───────────────────────────── Bitta reklama ─────────────────────────────

async function openAd(ad) {
  AD.current = ad;
  renderAdDetail();
  showScreen('ads-detail');

  // Yangi ko'rsatkichlar uchun Telegramdan so'raymiz — ekran esa
  // keshdagi ma'lumot bilan DARHOL ochiladi.
  try {
    const data = await adsApi(`/${ad.id}`);
    AD.current = data.ad;
    const i = AD.items.findIndex((x) => x.id === data.ad.id);
    if (i !== -1) AD.items[i] = data.ad;
    if (state.screen === 'ads-detail') renderAdDetail();
  } catch { /* keshdagi ko'rinish qoladi */ }
}

function renderAdDetail() {
  const ad = AD.current;
  if (!ad) return;

  const [label] = STATUS_LABELS[ad.status] || [ad.status];
  $('add-title').textContent = ad.title;
  $('add-status').textContent = ad.text || label;
  $('add-status-b').innerHTML = statusPill(ad.status);
  $('add-views').textContent = fmtNum(ad.views);
  $('add-clicks').textContent = fmtNum(ad.clicks);
  $('add-ctr').textContent = `${ad.ctr}%`;
  $('add-spent').textContent = fmtSom(ad.spent_uzs);
  $('add-budget').textContent = `${fmtSom(ad.budget_uzs)} · ${tonFmt(ad.budget_ton)}`;
  $('add-cpm').textContent = tonFmt(ad.cpm_ton);

  $('add-decline').hidden = ad.status !== 'declined';
  $('add-decline-text').textContent = ad.decline_reason || 'Sabab ko\'rsatilmagan.';

  $('add-pause-label').textContent = ad.status === 'stopped' ? 'Davom ettirish' : 'To\'xtatish';
  $('add-submit-review').hidden = ad.status !== 'ready_for_review';

  const min = AD.cfg?.min_topup_uzs ?? 0;
  $('add-topup-hint').textContent =
    `Kamida ${fmtSom(min)}. Xizmat haqi ${AD.cfg?.markup_pct ?? 0}% summaning ichida.`;
}

async function adAction(button, run, okMessage) {
  try {
    setBusy(button, true);
    const data = await run();
    if (data.ad) {
      AD.current = data.ad;
      const i = AD.items.findIndex((x) => x.id === data.ad.id);
      if (i !== -1) AD.items[i] = data.ad;
      renderAdDetail();
    }
    if (data.balance_uzs !== undefined) {
      state.balance = data.balance_uzs;
      renderBalancePill();
    }
    haptic('success');
    toast(okMessage, 'success');
    return true;
  } catch (err) {
    haptic('error');
    if (err.payload?.balance_uzs !== undefined) {
      state.balance = err.payload.balance_uzs;
      renderBalancePill();
    }
    toast(err.message, 'error');
    return false;
  } finally {
    setBusy(button, false);
  }
}

// ───────────────────────────── Statistika ─────────────────────────────

async function openAdStats() {
  const ad = AD.current;
  if (!ad) return;

  $('adst-subtitle').textContent = ad.title;
  showScreen('ads-stats');

  const range = $('adst-range');
  if (!range.dataset.built) {
    [7, 14, 30, 90].forEach((days, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${days} kun`;
      b.className = i === 0 ? 'is-on' : '';
      b.addEventListener('click', () => {
        AD.statsDays = days;
        [...range.children].forEach((c) => c.classList.toggle('is-on', c === b));
        loadAdStats();
      });
      range.appendChild(b);
    });
    range.dataset.built = '1';
  }
  await loadAdStats();
}

async function loadAdStats() {
  const ad = AD.current;
  const bars = $('adst-bars');
  const table = $('adst-table');
  bars.innerHTML = '';
  table.innerHTML = '<p class="hint">Yuklanmoqda…</p>';

  try {
    const data = await adsApi(`/${ad.id}/stats?days=${AD.statsDays}&interval=86400`);
    AD.stats = data.items || [];
    renderAdStats();
  } catch (err) {
    table.innerHTML = `<p class="hint is-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderAdStats() {
  const bars = $('adst-bars');
  const table = $('adst-table');
  bars.innerHTML = '';
  table.innerHTML = '';

  if (AD.stats.length === 0) {
    table.innerHTML = '<p class="hint">Bu davr uchun ma\'lumot yo\'q.</p>';
    return;
  }

  const max = Math.max(...AD.stats.map((s) => s.views), 1);
  AD.stats.forEach((s) => {
    const day = new Date(s.from_time * 1000);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.title = `${fmtNum(s.views)} ko'rish`;
    bar.innerHTML =
      `<i style="height:${Math.max(2, Math.round((s.views / max) * 100))}%"></i>` +
      `<span>${day.getDate()}.${day.getMonth() + 1}</span>`;
    bars.appendChild(bar);
  });

  const sum = AD.stats.reduce(
    (a, s) => ({
      views: a.views + s.views,
      clicks: a.clicks + s.clicks,
      spent: a.spent + s.spent_uzs,
    }),
    { views: 0, clicks: 0, spent: 0 }
  );
  table.innerHTML = `
    <div class="kv"><span>Ko'rishlar</span><b>${fmtNum(sum.views)}</b></div>
    <div class="kv"><span>Bosishlar</span><b>${fmtNum(sum.clicks)}</b></div>
    <div class="kv"><span>CTR</span><b>${sum.views ? ((sum.clicks / sum.views) * 100).toFixed(2) : 0}%</b></div>
    <div class="kv"><span>Sarflandi</span><b>${fmtSom(sum.spent)}</b></div>`;
}

// ───────────────────────────── Profil ─────────────────────────────

async function renderAdsProfile() {
  try {
    const cfg = await adsApi('/bootstrap');
    AD.cfg = cfg;

    if (!cfg.enabled) {
      $('adp-spent').textContent = '0';
      return;
    }

    $('adp-spent').textContent = fmtNum(cfg.spent_uzs);
    $('adp-balance').textContent = fmtSom(cfg.balance_uzs);
    $('adp-count').textContent = `${cfg.ads_count} / ${cfg.max_ads}`;
    $('adp-markup').textContent = `${cfg.markup_pct}%`;
    $('adp-min').textContent = fmtSom(cfg.min_topup_uzs);
    $('adp-rate').textContent = `1 TON = ${fmtSom(cfg.ton_rate_uzs)}`;

    const data = await adsApi('/me/history');
    renderAdsHistory(data.items || []);
  } catch (err) {
    $('adp-history').innerHTML = `<p class="hint is-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderAdsHistory(items) {
  const box = $('adp-history');
  box.innerHTML = '';

  if (items.length === 0) {
    box.innerHTML = '<p class="hint">Hali to\'lov qilinmagan.</p>';
    return;
  }

  const LABELS = { done: 'Bajarildi', pending: 'Kutilmoqda', failed: 'Bekor qilindi', refunded: 'Qaytarildi' };

  items.forEach((t) => {
    const when = new Date(t.created_at * 1000);
    const row = document.createElement('div');
    row.className = 'ad-card';
    row.innerHTML = `
      <div class="ad-card-top">
        <span class="ad-card-title">${fmtSom(t.uzs)}</span>
        <i class="st ${t.status === 'done' ? 'st-active' : t.status === 'pending' ? 'st-review' : 'st-declined'}">${LABELS[t.status] || t.status}</i>
      </div>
      <p class="ad-card-text">
        ${tonFmt(t.ton)} byudjetga · xizmat haqi ${fmtSom(t.fee_uzs)}<br>
        ${when.toLocaleDateString('ru-RU')} ${when.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </p>`;
    box.appendChild(row);
  });
}

// ───────────────────────────── Hodisalar ─────────────────────────────

function bindAdsEvents() {
  // Dunyolar orasida almashinuv
  document.querySelectorAll('[data-switch]').forEach((b) => {
    b.addEventListener('click', () => {
      showScreen(b.dataset.switch === 'ads' ? 'ads-create' : 'market');
      haptic('light');
    });
  });

  $('ads-form').addEventListener('submit', submitAd);

  $('ad-text').addEventListener('input', (e) => {
    $('ad-text-count').textContent = String(e.target.value.length);
  });
  $('ad-url').addEventListener('input', syncAdNote);
  $('ad-budget').addEventListener('input', syncQuote);

  // Media
  $('ad-photo-btn').addEventListener('click', () => $('ad-photo-file').click());
  $('ad-video-btn').addEventListener('click', () => $('ad-video-file').click());
  $('ad-photo-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMedia(file, 'photo').catch((err) => toast(err.message, 'error'));
  });
  $('ad-video-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMedia(file, 'video').catch((err) => toast(err.message, 'error'));
  });
  $('ad-media-clear').addEventListener('click', () => {
    AD.media = null;
    $('ad-media-preview').hidden = true;
    $('ad-media-preview').innerHTML = '';
    $('ad-media-clear').hidden = true;
  });

  // Jadval
  $('ad-sched-on').addEventListener('change', (e) => {
    $('ad-sched-wrap').hidden = !e.target.checked;
  });
  $('ad-sched-viewer').addEventListener('change', (e) => {
    $('ad-tz-wrap').hidden = e.target.checked;
  });
  $('sched-all').addEventListener('click', () => fillSchedule(0, 24));
  $('sched-none').addEventListener('click', () => { AD.schedule = new Array(7).fill(0); paintSchedule(); });
  $('sched-work').addEventListener('click', () => fillSchedule(9, 21));

  // Kanal / bot / so'z qo'shish
  const tokenAdder = (inputId, buttonId, listBox, list, kind, exclude = false) => {
    const add = async () => {
      const input = $(inputId);
      const raw = input.value.trim();
      if (!raw) return;

      const button = $(buttonId);
      try {
        setBusy(button, true, '…');
        const data = await adsApi('/refs/resolve', {
          method: 'POST',
          body: JSON.stringify({ kind, username: raw, for_excluding: exclude }),
        });
        if (list.length >= 100) { toast('Eng ko\'pi 100 ta', 'warn'); return; }
        list.push({ value: data.id, label: data.title || data.username || raw, exclude });
        input.value = '';
        drawTokens();
        haptic('success');
      } catch (err) {
        haptic('error');
        toast(err.message, 'error');
      } finally {
        setBusy(button, false);
      }
    };

    const drawTokens = () => {
      renderTokenList($(listBox), list, (i) => { list.splice(i, 1); drawTokens(); });
    };

    $(buttonId).addEventListener('click', add);
    $(inputId).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    return drawTokens;
  };

  tokenAdder('tgt-ch-input',  'tgt-ch-add',  'tgt-ch-list',  AD.sel.channels,   'channel');
  tokenAdder('tgt-chx-input', 'tgt-chx-add', 'tgt-chx-list', AD.sel.exChannels, 'channel', true);
  tokenAdder('tgt-u-ch-input','tgt-u-ch-add','tgt-u-ch-list',AD.sel.uChannels,  'channel');
  tokenAdder('tgt-b-input',   'tgt-b-add',   'tgt-b-list',   AD.sel.bots,       'bot');

  // Qidiruv so'zlari — serverga bormaydi
  const drawQueries = () => renderTokenList($('tgt-s-list'), AD.sel.queries, (i) => {
    AD.sel.queries.splice(i, 1);
    drawQueries();
  });
  const addQuery = () => {
    const input = $('tgt-s-input');
    const raw = input.value.trim();
    if (!raw) return;
    if (AD.sel.queries.length >= 10) { toast('Eng ko\'pi 10 ta', 'warn'); return; }
    AD.sel.queries.push({ value: raw, label: raw });
    input.value = '';
    drawQueries();
  };
  $('tgt-s-add').addEventListener('click', addQuery);
  $('tgt-s-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addQuery(); }
  });

  // Shahar qidiruvi
  $('tgt-u-loc-search').addEventListener('click', async () => {
    const countries = [...AD.sel.countries];
    if (countries.length !== 1) { toast('Avval AYNAN BITTA davlat tanlang', 'warn'); return; }
    const query = $('tgt-u-loc-input').value.trim();
    if (!query) return;

    const button = $('tgt-u-loc-search');
    try {
      setBusy(button, true, '…');
      const data = await adsApi(
        `/refs/locations?country=${encodeURIComponent(countries[0])}&q=${encodeURIComponent(query)}`
      );
      const box = $('tgt-u-loc-results');
      box.innerHTML = '';
      (data.locations || []).slice(0, 30).forEach((loc) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pick';
        chip.innerHTML = `<span>${escapeHtml(loc.name)}${loc.region ? ` · ${escapeHtml(loc.region)}` : ''}</span>`;
        chip.addEventListener('click', () => {
          if (AD.sel.locations.length >= 20) { toast('Eng ko\'pi 20 ta', 'warn'); return; }
          if (AD.sel.locations.some((l) => l.value === loc.location_id)) return;
          AD.sel.locations.push({ value: loc.location_id, label: loc.name });
          renderTokenList($('tgt-u-locs'), AD.sel.locations, (i) => {
            AD.sel.locations.splice(i, 1);
            renderTokenList($('tgt-u-locs'), AD.sel.locations, () => {});
          });
          haptic('light');
        });
        box.appendChild(chip);
      });
      if (box.children.length === 0) box.innerHTML = '<p class="hint">Topilmadi.</p>';
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(button, false);
    }
  });

  // Ro'yxat
  $('ads-refresh').addEventListener('click', () => { loadMyAds(); haptic('light'); });

  // Tafsilot amallari
  $('add-topup-btn').addEventListener('click', async () => {
    const uzs = Math.floor(Number($('add-topup').value) || 0);
    if (uzs <= 0) { toast('Summani kiriting', 'warn'); return; }
    const ok = await adAction(
      $('add-topup-btn'),
      () => adsApi(`/${AD.current.id}/budget`, { method: 'POST', body: JSON.stringify({ uzs }) }),
      'Byudjet to\'ldirildi'
    );
    if (ok) $('add-topup').value = '';
  });

  $('add-pause').addEventListener('click', () => {
    const paused = AD.current.status !== 'stopped';
    adAction(
      $('add-pause'),
      () => adsApi(`/${AD.current.id}/pause`, { method: 'POST', body: JSON.stringify({ paused }) }),
      paused ? 'Reklama to\'xtatildi' : 'Reklama davom etmoqda'
    );
  });

  $('add-submit-review').addEventListener('click', () => {
    adAction(
      $('add-submit-review'),
      () => adsApi(`/${AD.current.id}/submit`, { method: 'POST' }),
      'Ko\'rikka yuborildi'
    );
  });

  $('add-stats-btn').addEventListener('click', openAdStats);

  $('add-delete').addEventListener('click', async () => {
    const id = AD.current.id;
    const ok = await adAction(
      $('add-delete'),
      () => adsApi(`/${id}`, { method: 'DELETE' }),
      'Reklama o\'chirildi'
    );
    if (ok) {
      AD.items = AD.items.filter((x) => x.id !== id);
      AD.current = null;
      renderAdsList();
      showScreen('ads-mine', { push: false });
    }
  });

  $('adp-topup').addEventListener('click', openTopup);
}

// ───────────────────────────── Ishga tushirish ─────────────────────────────

function applyBootstrap(data) {
  state.user = data.user;
  state.balance = data.balance_uzs;
  state.pricing = data.pricing;
  state.settings = data.settings;
  state.rentals = data.rentals || [];
  state.collections = data.catalog.collections || [];
  state.catalog = {
    version: data.catalog.version,
    ready: data.catalog.ready,
    loading: data.catalog.loading,
    total_gifts: data.catalog.total_gifts,
  };

  const name = data.user.first_name || data.user.username || 'Foydalanuvchi';
  $('user-name').textContent = name;
  const avatar = $('avatar');
  if (data.user.photo_url) {
    avatar.style.backgroundImage = `url("${data.user.photo_url}")`;
  } else {
    avatar.textContent = name.slice(0, 1).toUpperCase();
  }

  if (data.bundle) {
    state.bundleCfg = data.bundle;
    state.bundleDays = data.bundle.min_days;
    $('bundle-min-days').textContent = String(data.bundle.min_days);
    // To'plam yo'q bo'lsa market ekranidagi reklama chizig'ini ko'rsatmaymiz.
    $('bundle-promo').hidden = data.bundle.total === 0;
  }

  // Reklama bo'limi TG_ADS_TOKEN sozlangandagina ko'rinadi. Aks holda
  // tugma bosilib, ichida "sozlanmagan" degan xato chiqardi.
  state.ads.enabled = Boolean(data.settings?.ads_enabled);
  $('switch-to-ads').hidden = !state.ads.enabled;

  renderBalancePill();
  renderBalance();
  updateMineBadge();
  renderBannerStats();

  if (state.rentals.some((r) => r.status === 'paying')) startPaymentWatcher();
}

async function init() {
  // Telegram SDK bilan aloqa. Har bir chaqiruv `?.` bilan — eski Telegram
  // versiyalarida ba'zi metodlar bo'lmaydi va ular yo'qligi ilovani
  // yiqitmasligi kerak.
  if (tg) {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.('secondary_bg_color');
    tg.disableVerticalSwipes?.();
  }

  if (!insideTelegram) {
    showGate(
      'Ilovani Telegram orqali oching',
      'Bu sahifa Telegram ichida ishlaydi. Botga o\'ting va «Gift Arenda» tugmasini bosing.'
    );
    return;
  }

  $('gate-btn').addEventListener('click', () => location.reload());

  bindEvents();
  renderSkeleton();

  try {
    const data = await api('/bootstrap');
    applyBootstrap(data);
    await loadGifts({ reset: true });
  } catch (err) {
    if (err.status === 401 && err.payload?.reason !== 'expired') {
      showGate(
        'Kirish tasdiqlanmadi',
        'Ilovani yopib, botdan qaytadan oching. Muammo takrorlansa — support bilan bog\'laning.',
        true
      );
      return;
    }
    if (err.status !== 401) renderEmpty('Yuklab bo\'lmadi', err.message, 'empty-net');
  } finally {
    if ($('gate').hidden) {
      $('app').hidden = false;
      $('splash').classList.add('is-done');
      setTimeout(() => $('splash')?.remove(), 400);
    }
  }
}

init();
