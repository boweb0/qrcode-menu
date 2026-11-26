(function () {
  'use strict';
  var D, S;
  var app = document.getElementById('app'), sheet = document.getElementById('sheet'), arEl = document.getElementById('ar'), adminEl = document.getElementById('admin');
  var internalNav = false, adminMounted = false, io = null;

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var U = function (p) { return Store.url(p); };
  var catById = function (id) { return D.categories.filter(function (c) { return c.id === id; })[0]; };
  var prodById = function (id) { return D.products.filter(function (p) { return p.id === id; })[0]; };
  var visible = function (p) { return p.available !== false; };

  var L = 'tr', LANGS = [['tr', 'TR'], ['en', 'EN'], ['ar', 'ع']];
  var UI = {
    tr: { nw: 'Yeni', camp: 'Kampanya', off: function (x) { return '%' + x + ' indirim'; }, open: 'Açık', none: 'Sonuç bulunamadı', items: 'ürün', cats: 'Kategoriler', secs: 'bölüm', ing: 'İçindekiler', back: 'Geri', close: 'Kapat', empty: 'Bu kategoride henüz ürün yok', admin: 'Yönetim', tel: 'Tel' },
    en: { nw: 'New', camp: 'Deal', off: function (x) { return x + '% off'; }, open: 'Open', none: 'No results found', items: 'items', cats: 'Categories', secs: 'sections', ing: 'Ingredients', back: 'Back', close: 'Close', empty: 'No products in this category yet', admin: 'Admin', tel: 'Tel' },
    ar: { nw: 'جديد', camp: 'عرض', off: function (x) { return 'خصم ' + x + '%'; }, open: 'مفتوح', none: 'لا توجد نتائج', items: 'منتج', cats: 'الأقسام', secs: 'قسم', ing: 'المكونات', back: 'رجوع', close: 'إغلاق', empty: 'لا توجد منتجات في هذا القسم بعد', admin: 'الإدارة', tel: 'هاتف' }
  };
  var t = function (k) { var v = (UI[L] || UI.tr)[k]; return v === undefined ? UI.tr[k] : v; };
  function tx(o, k) { if (L !== 'tr') { var i = o.i18n && o.i18n[L], v = i && i[k]; if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) return v; } return o[k]; }
  function enabledLangs() { var l = (S && S.langs) || ['tr', 'en', 'ar']; return LANGS.filter(function (x) { return l.indexOf(x[0]) > -1; }); }
  function pickLang() {
    var s = null; try { s = localStorage.getItem('qrmenu_lang'); } catch (e) { }
    var ok = enabledLangs().map(function (x) { return x[0]; });
    if (s && ok.indexOf(s) > -1) return s;
    var nav = ((navigator.language || 'tr') + '').slice(0, 2).toLowerCase();
    if (nav !== 'tr' && ok.indexOf(nav) > -1) return nav;
    if (nav !== 'tr' && ok.indexOf('en') > -1) return 'en';
    var d = S.defaultLang || 'tr'; return ok.indexOf(d) > -1 ? d : (ok[0] || 'tr');
  }
  function applyLang() { var h = document.documentElement; h.lang = L; h.dir = L === 'ar' ? 'rtl' : 'ltr'; }
  function money(v, usd) {
    if (L === 'tr') { var n = Number(v); return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' ' + (S.currency || '₺'); }
    var u = usd > 0 ? Number(usd) : Math.max(0.25, Math.round(Number(v) / (Number(S.usdRate) || 43) * 4) / 4);
    return '<bdi>$' + (Number.isInteger(u) ? String(u) : u.toFixed(2)) + '</bdi>';
  }
  function onSale(p) { return p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price); }
  function priceHtml(p) { return onSale(p) ? '<div class="pr"><b class="sale">' + money(p.salePrice, p.salePriceUSD) + '</b><s>' + money(p.price, p.priceUSD) + '</s></div>' : '<div class="pr"><b>' + money(p.price, p.priceUSD) + '</b></div>'; }
  function badges(p) {
    var h = '';
    if (p.isNew) h += '<span class="badge new">' + t('nw') + '</span>';
    if (p.isCampaign) h += '<span class="badge camp">' + t('camp') + '</span>';
    if (onSale(p)) h += '<span class="badge off">' + t('off')(Math.round((1 - p.salePrice / p.price) * 100)) + '</span>';
    return h ? '<div class="badges">' + h + '</div>' : '';
  }
  var mainImg = function (p) { return p.images && p.images[0] ? p.images[0] : ''; };

  var ic = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    go: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    cube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    rot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>'
  };

  function applyTheme() { document.documentElement.style.setProperty('--accent', S.accent || '#ff6a2b'); document.title = (tx(S, 'businessName') || 'Menü') + ' • ' + (tx(S, 'categoriesTitle') || 'Menü'); applyLang(); }

  /* reveal + tilt */
  function observe() {
    if (io) io.disconnect();
    var els = document.querySelectorAll('#app .rv');
    if (!('IntersectionObserver' in window)) { [].forEach.call(els, function (e) { e.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08 });
    [].forEach.call(els, function (e) { io.observe(e); });
  }
  function tilt() {
    if (!window.matchMedia || !matchMedia('(hover:hover)').matches) return;
    [].forEach.call(document.querySelectorAll('.cat'), function (c) {
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = 'rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg) translateZ(6px)'; });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }
  window.addEventListener('pointermove', function (e) { var r = document.documentElement.style; r.setProperty('--mx', e.clientX + 'px'); r.setProperty('--my', e.clientY + 'px'); }, { passive: true });

  /* ---------- sayfalar ---------- */
  function productRow(p, i) {
    var img = mainImg(p);
    return '<button class="row rv' + (visible(p) ? '' : ' out') + '" data-p="' + esc(p.id) + '" style="--d:' + (i % 6 * 70) + 'ms"><div class="ph">' + (img ? '<img src="' + esc(U(img)) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="info"><h3>' + esc(tx(p, 'name')) + '</h3><p>' + esc(tx(p, 'desc')) + '</p>' + badges(p) + '<div class="foot">' + priceHtml(p) + '</div></div></button>';
  }
  function footer() {
    var l = [];
    if (S.phone) l.push(t('tel') + ' · <bdi>' + esc(S.phone) + '</bdi>'); if (S.instagram) l.push(esc(S.instagram)); if (tx(S, 'wifi')) l.push(esc(tx(S, 'wifi')));
    return '<footer>' + (l.length ? '<div class="lk">' + l.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') + (tx(S, 'address') ? esc(tx(S, 'address')) + '<br>' : '') + esc(tx(S, 'footerText') || '') + '<br><a class="own" href="#yonetim">' + t('admin') + '</a></footer>';
  }
  function langSwitch() {
    var ls = enabledLangs(); if (ls.length < 2) return '';
    return '<div class="lang" role="group" aria-label="Language">' + ls.map(function (x) { return '<button data-lang="' + x[0] + '"' + (x[0] === L ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function topbar() {
    return '<div class="top"><div class="brand"><div class="mark">' + esc(S.logoText || (S.businessName || 'M').slice(0, 2)) + '</div><div><b>' + esc(tx(S, 'businessName')) + '</b><small>' + esc(tx(S, 'tagline')) + '</small></div></div><div class="tr-end">' + langSwitch() + '<div class="open"><i></i>' + t('open') + '</div></div></div>';
  }

  function renderHome() {
    var feat = D.products.filter(function (p) { return visible(p) && (p.isNew || p.isCampaign || onSale(p)); });
    var mq = esc(tx(S, 'marquee') || '').replace(/•/g, '<b>•</b>');
    app.innerHTML = topbar() +
      '<h1 class="headline"><span><em>' + esc(tx(S, 'categoriesTitle') || 'Menü') + '</em></span><span><em>' + esc(tx(S, 'businessName')) + '</em></span></h1>' +
      (tx(S, 'marquee') ? '<div class="marquee"><div class="track"><span>' + mq + mq + '</span><span>' + mq + mq + '</span></div></div>' : '') +
      '<div class="search">' + ic.search + '<input id="q" type="search" placeholder="' + esc(tx(S, 'searchPlaceholder')) + '" autocomplete="off"></div><div id="home-body">' + homeBody(feat) + '</div>' + footer();
    document.getElementById('q').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLocaleLowerCase(L), box = document.getElementById('home-body');
      if (!q) { box.innerHTML = homeBody(feat); observe(); tilt(); return; }
      var res = D.products.filter(function (p) { return visible(p) && (p.name + ' ' + p.desc + ' ' + p.ingredients.join(' ') + ' ' + tx(p, 'name') + ' ' + tx(p, 'desc') + ' ' + (tx(p, 'ingredients') || []).join(' ')).toLocaleLowerCase(L).indexOf(q) > -1; });
      box.innerHTML = res.length ? '<div class="list">' + res.map(productRow).join('') + '</div>' : '<div class="empty">' + t('none') + '</div>';
      observe();
    });
    observe(); tilt(); window.scrollTo(0, 0);
  }
  function homeBody(feat) {
    var h = '';
    if (S.showFeatured !== false && feat.length) {
      h += '<div class="sec"><h2>' + esc(tx(S, 'featuredTitle')) + '</h2><span>' + feat.length + ' ' + t('items') + '</span></div><div class="rail">' + feat.map(function (p) {
        return '<button class="fcard" data-p="' + esc(p.id) + '"><img src="' + esc(U(mainImg(p))) + '" alt="" loading="lazy">' + badges(p) + '<div class="in"><b>' + esc(tx(p, 'name')) + '</b>' + priceHtml(p) + '</div></button>';
      }).join('') + '</div>';
    }
    h += '<div class="sec"><h2>' + t('cats') + '</h2><span>' + D.categories.length + ' ' + t('secs') + '</span></div><div class="cat-grid">' + D.categories.map(function (c, i) {
      var n = D.products.filter(function (p) { return p.categoryId === c.id && visible(p); }).length;
      return '<button class="cat rv" data-c="' + esc(c.id) + '" style="--d:' + (i % 2 * 90 + Math.floor(i / 2) * 60) + 'ms"><img src="' + esc(U(c.image)) + '" alt="" loading="lazy"><span class="no">' + String(i + 1).padStart(2, '0') + '</span><span class="go">' + ic.go + '</span><span class="lbl"><b>' + esc(tx(c, 'name')) + '</b><small>' + n + ' ' + t('items') + '</small></span></button>';
    }).join('') + '</div>';
    return h;
  }
  function renderCategory(id) {
    var c = catById(id); if (!c) { location.hash = ''; return; }
    var items = D.products.filter(function (p) { return p.categoryId === id; });
    app.innerHTML = '<div class="bar"><div class="bar-row"><button class="back" data-back aria-label="' + t('back') + '">' + ic.back + '</button><h2>' + esc(tx(c, 'name')) + '</h2></div><div class="chips">' +
      D.categories.map(function (x) { return '<button class="chip' + (x.id === id ? ' on' : '') + '" data-c="' + esc(x.id) + '">' + esc(tx(x, 'name')) + '</button>'; }).join('') + '</div></div>' +
      '<div class="list">' + (items.length ? items.map(productRow).join('') : '<div class="empty">' + t('empty') + '</div>') + '</div>' + footer();
    var on = app.querySelector('.chip.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    observe(); window.scrollTo(0, 0);
  }

  /* ---------- ürün sayfası ---------- */
  var curMode = 'photo', spinTimer = null;
  function loadPreviewModel(p, cb) { // yalnızca ön izleme ortamında (modeller js olarak gömülü)
    if (window.PREVIEW_MODELS && p.model && !(window.MODEL_B64 && window.MODEL_B64[p.model])) {
      var s = document.createElement('script'); s.src = 'js/mp/' + p.model.replace(/^models\//, '').replace(/\.glb$/, '') + '.js'; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
    } else cb();
  }
  function modelUrl(p) {
    if (window.MODEL_B64 && window.MODEL_B64[p.model]) {
      var bin = atob(window.MODEL_B64[p.model]), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([u8], { type: 'model/gltf-binary' }));
    }
    return U(p.model);
  }
  var mvOK = function () { return window.customElements && customElements.get('model-viewer'); };
  function modesOf(p) {
    var m = [];
    if (p.spin && p.spin.length > 3) m.push(['spin', '360°']);
    if (p.model && mvOK()) m.push(['model', '3D']);
    if (mainImg(p)) m.push(['photo', 'Fotoğraf']);
    return m;
  }
  function mvAttrs(p, visible) {
    var card = p.modelType !== 'scan';
    return 'src="' + esc(modelUrl(p)) + '"' + (p.modelIos ? ' ios-src="' + esc(U(p.modelIos)) + '"' : '') + ' alt="' + esc(p.name) + '" ar ar-modes="webxr scene-viewer quick-look" ar-placement="floor" ar-scale="auto" shadow-intensity="1.1" shadow-softness=".9" exposure="1.05"' +
      (visible ? ' camera-controls touch-action="pan-y" ' + (card ? 'camera-orbit="0deg 80deg auto" min-camera-orbit="-60deg 55deg auto" max-camera-orbit="60deg 100deg auto"' : 'auto-rotate auto-rotate-delay="500" rotation-per-second="22deg" camera-orbit="25deg 78deg auto"') : '');
  }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } }
  function setStage(p, mode, idx) {
    stopSpin(); curMode = mode; var box = document.getElementById('stage-in'); if (!box) return;
    if (mode === 'model') {
      box.innerHTML = '<model-viewer ' + mvAttrs(p, true) + '><button slot="ar-button" style="display:none"></button></model-viewer><div class="hint">' + ic.rot + (p.modelType === 'scan' ? ' Sürükle · 360°' : ' Sürükle · yan açıdan bak') + '</div>';
      var mv = box.querySelector('model-viewer');
      if (p.modelType !== 'scan' && mv) { var t0 = performance.now(), stop = false; mv.addEventListener('camera-change', function (e) { if (e.detail && e.detail.source === 'user-interaction') stop = true; }); (function f() { if (stop || !mv.isConnected) return; mv.cameraOrbit = (Math.sin((performance.now() - t0) / 1500) * 30).toFixed(1) + 'deg 80deg auto'; requestAnimationFrame(f); })(); }
    } else if (mode === 'spin') {
      var fr = p.spin, n = fr.length; box.innerHTML = '<div class="spin" id="spin"><img src="' + esc(U(fr[0])) + '" alt="" draggable="false"></div><div class="hint">' + ic.rot + ' Sürükle · 360°</div>';
      fr.forEach(function (f) { var im = new Image(); im.src = U(f); });
      var el = document.getElementById('spin'), img = el.querySelector('img'), cur = 0, drag = false, lx = 0, acc = 0;
      function show(i) { cur = ((i % n) + n) % n; img.src = U(fr[cur]); }
      el.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; stopSpin(); el.setPointerCapture(e.pointerId); box.querySelector('.hint').style.opacity = 0; });
      el.addEventListener('pointermove', function (e) { if (!drag) return; acc += (e.clientX - lx) * (n / (el.clientWidth * 0.9)); lx = e.clientX; if (Math.abs(acc) >= 1) { show(cur - Math.trunc(acc)); acc -= Math.trunc(acc); } });
      var up = function () { drag = false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      spinTimer = setInterval(function () { if (!drag) show(cur + 1); }, 110);
    } else {
      box.innerHTML = '<div class="photo"><img src="' + esc(U(p.images[idx || 0] || '')) + '" alt=""></div>';
    }
  }
  function openSheet(id) {
    var p = prodById(id); if (!p) return;
    loadPreviewModel(p, function () {
      var modes = [], first = 'photo', hasM = false;
      var thumbs = (p.images || []).length > 1 ? '<div class="thumbs" id="thumbs">' + p.images.map(function (s, i) { return '<button class="thumb' + (i ? '' : ' on') + '" data-img="' + i + '"><img src="' + esc(U(s)) + '" alt=""></button>'; }).join('') + '</div>' : '';
      sheet.innerHTML = '<div class="sheet-bg" data-close></div><div class="sheet"><button class="close" data-close aria-label="' + t('close') + '">' + ic.close + '</button>' +
        '<div class="stage" id="stage">' + (modes.length > 1 ? '<div class="seg">' + modes.map(function (m, i) { return '<button' + (i ? '' : ' class="on"') + ' data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' : '') + '<div id="stage-in" style="position:absolute;inset:0"></div>' +
        (hasM ? '<model-viewer id="armv" ' + mvAttrs(p, false) + ' style="position:absolute;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0"><button slot="ar-button" style="display:none"></button></model-viewer>' : '') + '</div>' + thumbs +
        '<div class="pbody">' + badges(p) + '<h2>' + esc(tx(p, 'name')) + '</h2>' + priceHtml(p) + (tx(p, 'desc') ? '<p>' + esc(tx(p, 'desc')) + '</p>' : '') +
        ((tx(p, 'ingredients') || []).length ? '<h4>' + t('ing') + '</h4><div class="ing">' + tx(p, 'ingredients').map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
        (false ? '<button class="ar-btn" data-ar="' + esc(p.id) + '">' + ic.cube + ' ' + esc(S.arButtonText || 'Masanda Gör') + '</button><div class="ar-note">Telefon kamerasıyla ürünü masanda gör</div>' : '') + '</div></div>';
      sheet.dataset.pid = p.id; sheet.classList.add('on'); document.body.style.overflow = 'hidden'; setStage(p, first, 0);
    });
  }
  function closeSheetUI() { stopSpin(); sheet.classList.remove('on'); document.body.style.overflow = ''; setTimeout(function () { if (!sheet.classList.contains('on')) sheet.innerHTML = ''; }, 600); }

  /* ---------- Masanda gör ---------- */
  var arStream = null;
  function openAR(id) {
    var p = prodById(id); if (!p) return;
    var src = U(p.cutout || mainImg(p));
    arEl.innerHTML = '<div class="nocam"></div><video playsinline muted autoplay></video><div class="item" id="ar-item"><img src="' + esc(src) + '" alt=""></div>' +
      '<div class="top2"><b>' + esc(p.name) + '</b><button id="ar-close" aria-label="' + t('close') + '">' + ic.close + '</button></div><div class="tip" id="ar-tip">Kamerayı masanıza doğrultun · Sürükleyin, iki parmakla büyütün/döndürün</div>' +
      '<div class="panel"><label><span>Boyut</span><input type="range" id="ar-size" min="30" max="260" value="100"></label><label><span>Döndür</span><input type="range" id="ar-rot" min="-40" max="40" value="0"></label><label><span>Şeffaflık</span><input type="range" id="ar-op" min="35" max="100" value="96"></label></div>';
    arEl.classList.add('on');
    var video = arEl.querySelector('video'), nocam = arEl.querySelector('.nocam'), item = document.getElementById('ar-item'), tip = document.getElementById('ar-tip');
    var st = { x: innerWidth / 2, y: innerHeight * 0.52, s: 1, r: 0, o: 0.96 };
    function paint() { var w = item.offsetWidth, h = item.offsetHeight; item.style.opacity = st.o; item.style.transform = 'translate(' + (st.x - w / 2) + 'px,' + (st.y - h / 2) + 'px) rotate(' + st.r + 'deg) scale(' + st.s + ')'; }
    item.querySelector('img').onload = paint; paint();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (s) { arStream = s; video.srcObject = s; video.play(); nocam.style.display = 'none'; })
        .catch(function () { tip.textContent = 'Kamera izni verilmedi — masa dokusu üzerinde gösteriliyor.'; });
    } else tip.textContent = 'Bu cihazda kamera erişimi yok (HTTPS gerekir).';
    setTimeout(function () { tip.style.opacity = 0; }, 6500);
    var ptrs = {}, sD = 0, sA = 0, sS = 1, sR = 0;
    item.addEventListener('pointerdown', function (e) { item.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var k = Object.keys(ptrs); if (k.length === 2) { var a = ptrs[k[0]], b = ptrs[k[1]]; sD = Math.hypot(a.x - b.x, a.y - b.y); sA = Math.atan2(b.y - a.y, b.x - a.x); sS = st.s; sR = st.r; } });
    item.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; var k = Object.keys(ptrs);
      if (k.length === 1) { st.x += e.clientX - ptrs[e.pointerId].x; st.y += e.clientY - ptrs[e.pointerId].y; }
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (k.length === 2) { var a = ptrs[k[0]], b = ptrs[k[1]]; st.s = Math.min(2.6, Math.max(.3, sS * Math.hypot(a.x - b.x, a.y - b.y) / sD)); st.r = sR + (Math.atan2(b.y - a.y, b.x - a.x) - sA) * 180 / Math.PI; document.getElementById('ar-size').value = st.s * 100; }
      paint();
    });
    function end(e) { delete ptrs[e.pointerId]; }
    item.addEventListener('pointerup', end); item.addEventListener('pointercancel', end);
    document.getElementById('ar-size').oninput = function (e) { st.s = e.target.value / 100; paint(); };
    document.getElementById('ar-rot').oninput = function (e) { st.r = +e.target.value; paint(); };
    document.getElementById('ar-op').oninput = function (e) { st.o = e.target.value / 100; paint(); };
    document.getElementById('ar-close').onclick = closeAR;
  }
  function closeAR() { if (arStream) { arStream.getTracks().forEach(function (t) { t.stop(); }); arStream = null; } arEl.classList.remove('on'); arEl.innerHTML = ''; }

  /* ---------- yönlendirme (düz #isim biçimi) ---------- */
  function showAdmin() {
    closeSheetUI(); closeAR(); document.body.classList.add('admin-mode'); adminEl.hidden = false;
    if (!adminMounted) { adminMounted = true; Admin.mount(adminEl); } else Admin.refresh();
    window.scrollTo(0, 0);
  }
  function route() {
    var h = location.hash || '', m;
    if (h === '#yonetim') { showAdmin(); return; }
    if (!adminEl.hidden) { adminEl.hidden = true; document.body.classList.remove('admin-mode'); D = Store.get(); S = D.settings; applyTheme(); app.innerHTML = ''; }
    if ((m = h.match(/^#p-(.+)$/))) {
      var p = prodById(decodeURIComponent(m[1])); if (!p) { location.hash = ''; return; }
      if (!app.innerHTML) renderCategory(p.categoryId);
      openSheet(p.id); return;
    }
    closeSheetUI();
    if ((m = h.match(/^#c-(.+)$/))) renderCategory(decodeURIComponent(m[1])); else renderHome();
  }
  function setLang(l) { L = l; try { localStorage.setItem('qrmenu_lang', l); } catch (e) { } applyTheme(); route(); }
  function go(h) { internalNav = true; location.hash = h; }

  document.addEventListener('click', function (e) {
    var lb = e.target.closest('[data-lang]'); if (lb) { setLang(lb.dataset.lang); return; }
    var t = e.target.closest('[data-p],[data-c],[data-back],[data-close],[data-ar],[data-img],[data-mode]'); if (!t) return;
    if (t.dataset.mode) { var p0 = prodById(sheet.dataset.pid); [].forEach.call(document.querySelectorAll('.seg button'), function (b) { b.classList.toggle('on', b === t); }); setStage(p0, t.dataset.mode, 0); return; }
    if (t.dataset.ar) { var mv = document.getElementById('armv'); if (mv && mv.canActivateAR) mv.activateAR(); else openAR(t.dataset.ar); return; }
    if (t.dataset.img !== undefined && t.classList.contains('thumb')) {
      [].forEach.call(document.querySelectorAll('.thumb'), function (x) { x.classList.remove('on'); }); t.classList.add('on');
      var pp = prodById(sheet.dataset.pid); [].forEach.call(document.querySelectorAll('.seg button'), function (b) { b.classList.toggle('on', b.dataset.mode === 'photo'); }); setStage(pp, 'photo', +t.dataset.img); return;
    }
    if (t.dataset.p) { go('#p-' + encodeURIComponent(t.dataset.p)); return; }
    if (t.dataset.c) { go('#c-' + encodeURIComponent(t.dataset.c)); return; }
    if (t.hasAttribute('data-back')) { internalNav ? history.back() : (location.hash = ''); return; }
    if (t.hasAttribute('data-close')) { if (internalNav) history.back(); else { var m = (location.hash.match(/^#p-(.+)$/) || [])[1], pr = m && prodById(decodeURIComponent(m)); location.hash = pr ? '#c-' + pr.categoryId : ''; } }
  });
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (arEl.classList.contains('on')) closeAR(); else if (sheet.classList.contains('on')) history.back(); } });

  var started = false;
  function start() { if (started) return; started = true; D = Store.get(); S = D.settings; L = pickLang(); applyTheme(); route(); }
  Store.ready().then(start, start); setTimeout(start, 3500);
})();
