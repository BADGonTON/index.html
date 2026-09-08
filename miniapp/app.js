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
  history: [],
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

const TABS = ['market', 'bundles', 'mine', 'balance'];

function showScreen(name, { push = true } = {}) {
  if (state.screen === name) return;
  if (push && !TABS.includes(name)) state.history.push(state.screen);
  if (TABS.includes(name)) state.history = [];

  state.screen = name;

  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.toggle('is-active', s.dataset.screen === name);
  });
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.dataset.tab === name);
  });

  window.scrollTo({ top: 0 });
  syncBackButton();

  if (name === 'mine') renderMine();
  if (name === 'balance') renderBalance();
  // To'plamlar ro'yxati faqat KERAK BO'LGANDA yuklanadi — ilova ochilishi
  // shu sabab sekinlashmaydi.
  if (name === 'bundles' && state.bundles.items.length === 0) loadBundles({ reset: true });
}

function goBack() {
  const target = state.history.pop() || 'market';
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

    if (rental.status === 'failed' && rental.tx_error) {
      const errBox = document.createElement('div');
      errBox.className = 'mine-error';
      errBox.textContent = rental.tx_error;
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

  const video = $('video-btn');
  if (state.settings.profile_link_video_url) {
    video.href = state.settings.profile_link_video_url;
    video.hidden = false;
  } else {
    video.hidden = true;
  }

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
  state.extendDays = 1;

  $('extend-name').textContent = rental.nft_name;
  $('extend-perday').textContent = fmtNum(rental.price_per_day_uzs);
  mountImage($('extend-img'), rental.image_url);

  const maxDays = Math.max(1, Math.min(365, rental.extend_affordable_days || 1));
  const slider = $('extend-slider');
  slider.min = 1;
  slider.max = maxDays;
  slider.value = 1;
  $('extend-max').textContent = `${maxDays} kun`;

  buildQuickDays($('extend-quick'), 1, maxDays, (d) => {
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

  const days = Number($('extend-slider').value);
  state.extendDays = days;

  const total = rental.price_per_day_uzs * days;   // uzaytirishda xizmat haqi yo'q
  $('extend-days-value').textContent = days;
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

async function openBundle(summary) {
  state.bundle = null;
  state.bundleSize = summary.sizes[0];
  state.bundleDays = summary.min_days;

  $('bundle-kind').textContent = summary.kind_label;
  $('bundle-name').textContent = summary.value;
  $('bundle-collection').textContent = summary.collection_name;
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
    toast(`${res.count} ta gift olindi — ${fmtSom(res.cost_uzs)}`, 'ok');

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
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => { showScreen(tab.dataset.tab); haptic('light'); });
  });

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
