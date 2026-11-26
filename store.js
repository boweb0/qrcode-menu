/* Veri katmanı
   - data/menu.js  : GitHub'da yayınlanmış menü
   - localStorage  : panelde yapılan taslak değişiklikler
   - IndexedDB     : panelden yüklenen fotoğraflar ve 3D modeller (dosya olarak)
   - Yayın paketi  : taslağı .zip olarak indirip repoya kopyalamak için */
window.Store = (function () {
  var KEY = 'qrmenu_draft_v2', DBN = 'qrmenu_assets', ST = 'a';
  var DEFAULTS = {
    businessName: 'Menü', tagline: '', logoText: 'M', categoriesTitle: 'Menü', featuredTitle: 'Öne Çıkanlar', searchPlaceholder: 'Menüde ara…',
    marquee: 'TAZE  •  LEZZETLİ  •  SICAK  •  ', currency: '₺', accent: '#ff6a2b', showFeatured: true, arButtonText: 'Masanda Gör',
    phone: '', instagram: '', address: '', wifi: '', footerText: '', adminPassword: 'admin123'
  };
  var urls = {}, blobs = {}, db = null, readyP = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function normalize(d) {
    d = d || {};
    d.settings = Object.assign({}, DEFAULTS, d.settings || {});
    d.categories = d.categories || [];
    d.products = (d.products || []).map(function (p) {
      p.images = p.images || []; p.ingredients = p.ingredients || [];
      if (p.available === undefined) p.available = true;
      if (p.arEnabled === undefined) p.arEnabled = true;
      return p;
    });
    d.updatedAt = d.updatedAt || 0;
    return d;
  }
  function published() { return normalize(clone(window.MENU_DEFAULT || {})); }
  function get() {
    var pub = published(), local = null;
    try { local = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (local && (local.updatedAt || 0) >= (pub.updatedAt || 0)) return normalize(local);
    if (local) { try { localStorage.removeItem(KEY); } catch (e) { } }
    return pub;
  }
  function hasDraft() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  function save(d) {
    d.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { alert('Kayıt başarısız: tarayıcı hafızası dolu.'); return false; }
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { } }

  /* ---- dosya (asset) deposu ---- */
  function openDB() {
    return new Promise(function (res) {
      try { var r = indexedDB.open(DBN, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; r.onblocked = function () { res(null); }; } catch (e) { res(null); }
      setTimeout(function () { res(null); }, 1500);
    });
  }
  function ready() {
    if (readyP) return readyP;
    readyP = openDB().then(function (d) {
      db = d; if (!db) return;
      return new Promise(function (res) {
        setTimeout(res, 2500);
        try {
          var req = db.transaction(ST, 'readonly').objectStore(ST).openCursor();
          req.onsuccess = function () { var c = req.result; if (c) { blobs[c.key] = c.value; urls[c.key] = URL.createObjectURL(c.value); c.continue(); } else res(); };
          req.onerror = function () { res(); };
        } catch (e) { res(); }
      });
    });
    readyP = readyP.catch(function () { db = null; });
    return readyP;
  }
  function putAsset(path, blob) {
    blobs[path] = blob; if (urls[path]) URL.revokeObjectURL(urls[path]); urls[path] = URL.createObjectURL(blob);
    return new Promise(function (res) {
      if (!db) return res();
      try { var tx = db.transaction(ST, 'readwrite'); tx.objectStore(ST).put(blob, path); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); }
    });
  }
  function delAsset(path) {
    delete blobs[path]; delete urls[path];
    if (db) try { db.transaction(ST, 'readwrite').objectStore(ST).delete(path); } catch (e) { }
  }
  function url(p) { return p && urls[p] ? urls[p] : p; }
  function hasAsset(p) { return !!blobs[p]; }
  function clearAssets() { Object.keys(blobs).forEach(delAsset); }

  /* ---- ZIP (sıkıştırmasız) ---- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0, now = new Date();
    var dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
      c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(c.buffer, name);
      off += 30 + name.length + f.data.length;
    });
    var cs = 0; central.forEach(function (b) { cs += b.byteLength !== undefined ? b.byteLength : b.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
  }

  function exportJS(d) { return '/* Menü verisi - yönetim panelinden dışa aktarıldı */\nwindow.MENU_DEFAULT = ' + JSON.stringify(d, null, 1) + ';\n'; }

  /* taslaktaki yüklenmiş dosyalar + menu.js → yayın paketi */
  function buildPackage(d) {
    d.updatedAt = Date.now(); save(d);
    var paths = {};
    function add(p) { if (p && blobs[p]) paths[p] = 1; }
    d.categories.forEach(function (c) { add(c.image); });
    d.products.forEach(function (p) { (p.images || []).forEach(add); (p.spin || []).forEach(add); add(p.cutout); add(p.model); add(p.modelIos); });
    var list = Object.keys(paths), files = [{ name: 'data/menu.js', data: new TextEncoder().encode(exportJS(d)) }];
    return Promise.all(list.map(function (p) { return blobs[p].arrayBuffer().then(function (b) { files.push({ name: p, data: new Uint8Array(b) }); }); })).then(function () { return { blob: zip(files), count: files.length }; });
  }

  function parseImport(text) {
    var i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j < 0) throw new Error('Geçersiz dosya');
    var d = JSON.parse(text.slice(i, j + 1));
    if (!d.categories || !d.products) throw new Error('Menü verisi bulunamadı');
    return normalize(d);
  }

  return { get: get, save: save, reset: reset, hasDraft: hasDraft, ready: ready, putAsset: putAsset, delAsset: delAsset, url: url, hasAsset: hasAsset, clearAssets: clearAssets, buildPackage: buildPackage, exportJS: exportJS, parseImport: parseImport, defaults: DEFAULTS };
})();
