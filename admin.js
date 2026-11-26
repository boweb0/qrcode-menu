/* Yönetim paneli — index.html#yonetim içinde çalışır (siteyle aynı veriyi kullanır) */
window.Admin = (function () {
  'use strict';
  var D, tab = 'products', filterCat = '', host, root, modal, toastEl;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = function () { return Math.random().toString(36).slice(2, 8); };
  var U = function (p) { return Store.url(p); };
  var $ = function (s, r) { return (r || host).querySelector(s); };
  var catName = function (id) { var c = D.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : '—'; };

  function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2400); }
  function save(msg) { if (Store.save(D)) { toast(msg || 'Kaydedildi ✓'); return true; } return false; }

  /* fotoğrafı küçült → dosya olarak sakla */
  function addPhoto(file, max) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, (max || 1200) / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { var path = 'img/u-' + uid() + Date.now().toString(36).slice(-3) + '.jpg'; Store.putAsset(path, b).then(function () { res(path); }); }, 'image/jpeg', 0.9);
      };
      im.onerror = function () { rej(new Error('Görsel okunamadı')); }; im.src = url;
    });
  }

  function tg(o, l, k) { return (o.i18n && o.i18n[l] && o.i18n[l][k]) || ''; }
  function setTg(o, l, k, v) { o.i18n = o.i18n || {}; o.i18n[l] = o.i18n[l] || {}; o.i18n[l][k] = v; }
  var LN = { en: 'İngilizce (English)', ar: 'Arapça (العربية)' };
  function mount(el) {
    host = el; D = Store.get();
    host.innerHTML = '<div class="adm-root"></div><div class="modal"></div><div class="toast"></div>';
    root = $('.adm-root'); modal = $('.modal'); toastEl = $('.toast'); render();
  }
  function refresh() { D = Store.get(); render(); }

  function renderLogin() {
    root.innerHTML = '<div class="login"><div class="box"><h1>Yönetim Paneli</h1><p>' + esc(D.settings.businessName) + '</p><label class="f"><input id="pw" type="password" placeholder="Şifre" autofocus></label><button class="btn pri" id="go" style="width:100%">Giriş</button>' +
      '<p style="margin-top:14px;font-size:12px">İlk şifre: <b>admin123</b> (Ayarlar sekmesinden değiştirin)</p><p style="font-size:12px"><a href="#">← Menüye dön</a></p></div></div>';
    var go = function () { if ($('#pw').value === D.settings.adminPassword) { try { sessionStorage.setItem('qm_auth', '1'); } catch (e) { } window.__qmAuth = true; render(); } else toast('Şifre yanlış'); };
    $('#go').onclick = go; $('#pw').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }
  function authed() { try { return sessionStorage.getItem('qm_auth') === '1'; } catch (e) { return !!window.__qmAuth; } }

  function render() {
    if (!authed()) return renderLogin();
    var tabs = [['products', 'Ürünler'], ['categories', 'Kategoriler'], ['settings', 'Site Ayarları'], ['publish', 'Yayınla & QR']];
    root.innerHTML = '<div class="topbar"><h1>' + esc(D.settings.businessName) + ' · Yönetim</h1>' + (Store.hasDraft() ? '<span class="dirty" title="Değişiklikler bu tarayıcıda. Yayınla sekmesinden GitHub\'a gönderin.">Taslak · yayınlanmadı</span>' : '') +
      '<a class="btn acc" href="#">Menüyü Gör ↗</a><button class="btn" id="logout">Çıkış</button></div><div class="wrap"><div class="tabs">' +
      tabs.map(function (t) { return '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="tabbody"></div></div>';
    $('#logout').onclick = function () { try { sessionStorage.removeItem('qm_auth'); } catch (e) { } window.__qmAuth = false; render(); };
    [].forEach.call(host.querySelectorAll('[data-tab]'), function (b) { b.onclick = function () { tab = b.dataset.tab; render(); }; });
    ({ products: tabProducts, categories: tabCategories, settings: tabSettings, publish: tabPublish })[tab]($('#tabbody'));
  }

  function openModal(html) { modal.innerHTML = '<div class="bg"><div class="dlg">' + html + '</div></div>'; modal.firstChild.addEventListener('mousedown', function (e) { if (e.target === modal.firstChild) closeModal(); }); }
  function closeModal() { modal.innerHTML = ''; }

  /* ---------- ürünler ---------- */
  function tabProducts(body) {
    var list = D.products.filter(function (p) { return !filterCat || p.categoryId === filterCat; });
    body.innerHTML = '<div class="toolbar"><select id="fc" class="btn"><option value="">Tüm kategoriler</option>' + D.categories.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === filterCat ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select><button class="btn acc" id="addp">+ Yeni Ürün</button></div>' +
      (list.length ? list.map(function (p) {
        return '<div class="item"><img src="' + esc(U(p.images[0] || '')) + '" alt=""><div class="meta"><b>' + esc(p.name) + '</b><small>' + esc(catName(p.categoryId)) + ' · ' + (p.salePrice ? '<s>' + p.price + '</s> ' + p.salePrice : p.price) + ' ' + esc(D.settings.currency) + '</small><div style="margin-top:4px">' +
          (p.model ? '<span class="tag d">3D</span>' : '') + (p.isNew ? '<span class="tag n">Yeni</span>' : '') + (p.isCampaign ? '<span class="tag c">Kampanya</span>' : '') + (p.available === false ? '<span class="tag x">Gizli</span>' : '') + '</div></div>' +
          '<div class="acts"><button class="btn sm" data-edit="' + esc(p.id) + '">Düzenle</button><button class="btn sm" data-tog="' + esc(p.id) + '">' + (p.available === false ? 'Göster' : 'Gizle') + '</button><button class="btn sm del" data-del="' + esc(p.id) + '">Sil</button></div></div>';
      }).join('') : '<div class="card">Bu kategoride ürün yok.</div>');
    $('#fc').onchange = function (e) { filterCat = e.target.value; render(); };
    $('#addp').onclick = function () { if (!D.categories.length) return toast('Önce kategori ekleyin'); productForm(null); };
    body.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) productForm(b.dataset.edit);
      if (b.dataset.tog) { var p = D.products.filter(function (x) { return x.id === b.dataset.tog; })[0]; p.available = p.available === false; save(); render(); }
      if (b.dataset.del && confirm('Bu ürün silinsin mi?')) { D.products = D.products.filter(function (x) { return x.id !== b.dataset.del; }); save('Silindi'); render(); }
    };
  }

  function productForm(id) {
    var p = id ? JSON.parse(JSON.stringify(D.products.filter(function (x) { return x.id === id; })[0])) : { id: 'x' + uid(), categoryId: filterCat || D.categories[0].id, name: '', desc: '', ingredients: [], price: '', salePrice: null, isNew: false, isCampaign: false, available: true, arEnabled: true, round: false, images: [] };
    var busy = false;
    function paintImgs() {
      $('#imgs').innerHTML = p.images.map(function (s, i) {
        return '<div class="im' + (i ? '' : ' main') + '"><img src="' + esc(U(s)) + '" alt=""><button class="x" data-rm="' + i + '" type="button">×</button>' + (i ? '<button class="mk" data-mk="' + i + '" type="button">Kapak yap</button>' : '<button class="mk" type="button" disabled>Kapak</button>') + '</div>';
      }).join('') || '<small style="color:#999">Henüz fotoğraf yok — yükleyin, 3D otomatik oluşturulur</small>';
      var sel = $('#o-src'); if (sel) sel.innerHTML = p.images.map(function (s, i) { return '<option value="' + i + '">Fotoğraf ' + (i + 1) + '</option>'; }).join('');
    }
    function paintPreview(msg) {
      var pv = $('#pv');
      if (busy) { pv.innerHTML = '<div class="busy">' + esc(msg || '3D oluşturuluyor…') + '</div>'; return; }
      if (p.model && window.customElements && customElements.get('model-viewer')) pv.innerHTML = '<model-viewer src="' + esc(U(p.model)) + '" camera-controls auto-rotate shadow-intensity="1" camera-orbit="25deg 78deg auto" alt="3D önizleme"></model-viewer>';
      else if (p.model) pv.textContent = '3D model hazır (önizleme için internet gerekir).';
      else pv.textContent = 'Henüz 3D model yok. Fotoğraf yükleyip "Fotoğraftan 3D oluştur" butonuna basın.';
      $('#o-clear').disabled = !p.model;
    }
    function paintSpin() { var n = (p.spin || []).length; $('#sp-info').textContent = n ? n + ' kare · aktif' : 'yok'; $('#sp-clear').disabled = !n; }
    function setSpin(paths) { (p.spin || []).forEach(function (x) { if (Store.hasAsset(x)) Store.delAsset(x); }); p.spin = paths; paintSpin(); toast(paths.length + ' kareli 360° görünüm hazır ✓'); }
    function framesFromVideo(file, n) {
      return new Promise(function (res, rej) {
        var v = document.createElement('video'), url = URL.createObjectURL(file), out = [], key = uid(); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
        v.onerror = function () { rej(new Error('Video okunamadı')); };
        v.onloadedmetadata = function () {
          var dur = v.duration, k = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); var cx = c.getContext('2d'), i = 0;
          (function next() {
            if (i >= n) { URL.revokeObjectURL(url); return res(out); }
            $('#sp-info').textContent = 'Kareler çıkarılıyor ' + (i + 1) + '/' + n;
            v.onseeked = function () { cx.drawImage(v, 0, 0, c.width, c.height); c.toBlob(function (b) { var path = 'img/u-' + key + '-f' + String(i).padStart(2, '0') + '.jpg'; Store.putAsset(path, b).then(function () { out.push(path); i++; next(); }); }, 'image/jpeg', 0.85); };
            v.currentTime = Math.min(dur - 0.05, (i / n) * dur);
          })();
        };
      });
    }
    function bindSpin() {
    $('#sp-video').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (!f) return; framesFromVideo(f, 36).then(setSpin).catch(function (er) { paintSpin(); toast(er.message); }); };
    $('#sp-photos').onchange = function (e) {
      var files = [].slice.call(e.target.files).sort(function (a, b) { return a.name < b.name ? -1 : 1; }); e.target.value = ''; if (files.length < 4) return toast('En az 4 fotoğraf seçin');
      var out = []; files.reduce(function (pr, f) { return pr.then(function () { return addPhoto(f, 900).then(function (path) { out.push(path); }); }); }, Promise.resolve()).then(function () { setSpin(out); }).catch(function (er) { toast(er.message); });
    };
    $('#sp-clear').onclick = function () { setSpin([]); };
    }
    function convert() {
      if (!p.images.length) return toast('Önce fotoğraf ekleyin');
      if (busy) return; busy = true; paintPreview('3D oluşturuluyor… (5-15 sn)');
      var idx = +($('#o-src').value || 0), o = { mode: $('#o-mode').value, widthCm: parseFloat($('#o-w').value) || 20, removeBg: $('#o-bg').checked, shape: $('#o-shape').value };
      setTimeout(function () {
        var src = U(p.images[idx]);
        var go = (o.removeBg && o.shape === 'auto') ? Photo3D.removeBackground(src).then(function (img) { return Photo3D.convert(img, Object.assign({}, o, { preCut: true })); }).catch(function () { return Photo3D.convert(src, o); }) : Photo3D.convert(src, o);
        go.then(function (r) {
          var key = uid() + Date.now().toString(36).slice(-3), mp = 'models/u-' + key + '.glb', cp = 'img/cut-u-' + key + '.png';
          return Promise.all([Store.putAsset(mp, r.glb), Store.putAsset(cp, r.cutout)]).then(function () {
            if (p.model && Store.hasAsset(p.model)) Store.delAsset(p.model); if (p.cutout && Store.hasAsset(p.cutout)) Store.delAsset(p.cutout);
            p.model = mp; p.cutout = cp; p.modelType = 'card'; busy = false; paintPreview();
            toast(r.how === 'bg' || r.how === 'ml' ? '3D hazır ✓ Arka plan otomatik kaldırıldı' : '3D hazır ✓ (arka plan ayrılamadı, kesim şekli kullanıldı)');
          });
        }).catch(function (e) { busy = false; paintPreview(); toast('3D oluşturulamadı: ' + e.message); });
      }, 60);
    }
    openModal('<h2>' + (id ? 'Ürünü Düzenle' : 'Yeni Ürün') + '</h2>' +
      '<div class="grid2"><label class="f">Ürün adı<input id="f-name" value="' + esc(p.name) + '"></label><label class="f">Kategori<select id="f-cat">' + D.categories.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === p.categoryId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Fiyat<input id="f-price" type="number" step="0.01" min="0" value="' + esc(p.price) + '"></label><label class="f">İndirimli fiyat (boş = yok)<input id="f-sale" type="number" step="0.01" min="0" value="' + esc(p.salePrice || '') + '"></label></div>' +
      '<label class="f">Açıklama<textarea id="f-desc">' + esc(p.desc) + '</textarea></label><label class="f">İçindekiler (virgülle ayırın)<input id="f-ing" value="' + esc(p.ingredients.join(', ')) + '"></label>' +
      ['en', 'ar'].map(function (l) { return '<div class="box3d" style="display:block!important;background:#faf7f2;border:1px solid #eee7dc;border-radius:14px;padding:12px;margin:10px 0"><b>' + LN[l] + ' çeviri</b><div class="grid2" style="margin-top:8px"><label class="f">Ürün adı<input id="t-' + l + '-name" ' + (l === 'ar' ? 'dir="rtl" ' : '') + 'value="' + esc(tg(p, l, 'name')) + '"></label><label class="f">Fiyat ($, boş = otomatik)<input id="t-' + l + '-usd" type="number" step="0.01" min="0" value="' + esc(l === 'en' ? (p.priceUSD || '') : '') + '"' + (l === 'ar' ? ' disabled placeholder="İngilizcedeki $ fiyat kullanılır"' : '') + '></label></div><label class="f">Açıklama<textarea id="t-' + l + '-desc" ' + (l === 'ar' ? 'dir="rtl" ' : '') + '>' + esc(tg(p, l, 'desc')) + '</textarea></label><label class="f">İçindekiler (virgülle ayırın' + (l === 'ar' ? ', Arapça virgül « ، » da olur' : '') + ')<input id="t-' + l + '-ing" ' + (l === 'ar' ? 'dir="rtl" ' : '') + 'value="' + esc((tg(p, l, 'ingredients') || []).join(l === 'ar' ? '، ' : ', ')) + '"></label></div>'; }).join('') +
      '<label class="f" style="max-width:260px">İndirimli fiyat ($, boş = otomatik)<input id="t-sale-usd" type="number" step="0.01" min="0" value="' + esc(p.salePriceUSD || '') + '"></label>' +
      '<div class="checks"><label><input type="checkbox" id="f-new"' + (p.isNew ? ' checked' : '') + '> Yeni ürün</label><label><input type="checkbox" id="f-camp"' + (p.isCampaign ? ' checked' : '') + '> Kampanyalı ürün</label><label><input type="checkbox" id="f-av"' + (p.available !== false ? ' checked' : '') + '> Satışta</label><label><input type="checkbox" id="f-ar"' + (p.arEnabled ? ' checked' : '') + '> "Masanda Gör" butonu</label></div>' +
      '<b style="font-size:13px;color:#7a7167">Fotoğraflar (ilki kapak olur)</b><div class="imgs" id="imgs" style="margin-top:8px"></div>' +
      '<div class="row" style="margin-bottom:14px;flex-wrap:wrap"><label class="btn sm">+ Fotoğraf yükle<input id="f-file" type="file" accept="image/*" multiple hidden></label><input id="f-url" placeholder="veya görsel yolu: img/benim.jpg" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid #e5dfd6;border-radius:10px"><button class="btn sm" id="f-addurl" type="button">Ekle</button></div>' +
      '<div class="box3d"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b>3D Model · Masanda Gör</b><label style="font-size:12.5px;color:#7a7167;display:flex;gap:6px;align-items:center"><input type="checkbox" id="o-auto" checked> Fotoğraf yüklenince otomatik 3D yap</label></div>' +
      '<div class="pv" id="pv"></div><div class="grid3"><label class="f">Kaynak fotoğraf<select id="o-src"></select></label><label class="f">Duruş<select id="o-mode"><option value="upright">Dik duran (yandan çekim)</option><option value="flat">Masada yatık (üstten çekim)</option></select></label><label class="f">Gerçek genişlik (cm)<input id="o-w" type="number" min="3" max="80" value="20"></label></div>' +
      '<div class="grid2"><label class="f">Kesim şekli<select id="o-shape"><option value="auto">Arka planı otomatik kaldır</option><option value="rounded">Yuvarlak köşeli kare</option><option value="ellipse">Oval</option></select></label><label class="f" style="display:flex;gap:8px;align-items:flex-end"><span style="display:flex;gap:6px;align-items:center;padding-bottom:10px"><input type="checkbox" id="o-bg" checked style="width:auto;margin:0"> Arka planı kaldırmayı dene</span></label></div>' +
      '<div class="row" style="flex-wrap:wrap"><button class="btn acc" id="o-go" type="button">Fotoğraftan 3D oluştur</button><label class="btn sm">.glb yükle (taranmış gerçek model)<input id="o-file" type="file" accept=".glb,model/gltf-binary" hidden></label><button class="btn sm del" id="o-clear" type="button">3D\'yi kaldır</button></div>' +
      '<small style="display:block;color:#7a7167;margin-top:8px">Tek fotoğraftan üretilen model "yarım 3D"dir: önden/yandan bakışta gerçekçi, tam arka yüz yoktur. Tam 360° için telefonla taranmış gerçek bir .glb yükleyin.</small></div>' +
      '<div class="box3d"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>360° Döner Görünüm (gerçek)</b><span id="sp-info" style="font-size:12.5px;color:#7a7167"></span></div>' +
      '<small style="display:block;color:#7a7167;margin-bottom:10px">Ürünün etrafında yavaşça dönerek 10-15 sn video çekin (tabağı sabit tutup telefonla çevresini dolaşın) veya 12-36 fotoğraf yükleyin. Menüde parmakla gerçekten 360° döner; gördüğünüz ürünün aynısıdır.</small>' +
      '<div class="row" style="flex-wrap:wrap"><label class="btn sm">Video yükle<input id="sp-video" type="file" accept="video/*" hidden></label><label class="btn sm">Fotoğraf serisi yükle<input id="sp-photos" type="file" accept="image/*" multiple hidden></label><button class="btn sm del" id="sp-clear" type="button">360\'ı kaldır</button></div></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn" id="f-cancel">İptal</button><button class="btn pri" id="f-save">Kaydet</button></div>');
    paintImgs(); paintPreview(); paintSpin(); bindSpin();
    $('#imgs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.rm) p.images.splice(+b.dataset.rm, 1); if (b.dataset.mk) { var s = p.images.splice(+b.dataset.mk, 1)[0]; p.images.unshift(s); } paintImgs(); };
    $('#f-file').onchange = function (e) {
      var files = [].slice.call(e.target.files); e.target.value = '';
      files.reduce(function (pr, f) { return pr.then(function () { return addPhoto(f, 1200).then(function (path) { p.images.push(path); paintImgs(); }); }); }, Promise.resolve()).then(function () {  }).catch(function (er) { toast(er.message); });
    };
    $('#f-addurl').onclick = function () { var u = $('#f-url').value.trim(); if (u) { p.images.push(u); $('#f-url').value = ''; paintImgs(); } };
    $('#o-go').onclick = convert;
    $('#o-file').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return; var path = 'models/u-' + uid() + '.glb';
      Store.putAsset(path, f).then(function () { p.model = path; p.modelType = 'scan'; p.cutout = p.cutout || ''; paintPreview(); toast('Model yüklendi ✓'); });
    };
    $('#o-clear').onclick = function () { p.model = ''; paintPreview(); };
    $('#f-cancel').onclick = closeModal;
    $('#f-save').onclick = function () {
      if (busy) return toast('3D oluşturma bitsin');
      var name = $('#f-name').value.trim(); if (!name) return toast('Ürün adı gerekli');
      p.name = name; p.categoryId = $('#f-cat').value; p.price = parseFloat($('#f-price').value) || 0; var sv = parseFloat($('#f-sale').value); p.salePrice = sv > 0 ? sv : null;
      ['en', 'ar'].forEach(function (l) { setTg(p, l, 'name', $('#t-' + l + '-name').value.trim()); setTg(p, l, 'desc', $('#t-' + l + '-desc').value.trim()); setTg(p, l, 'ingredients', $('#t-' + l + '-ing').value.split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean)); });
      var uv = parseFloat($('#t-en-usd').value); p.priceUSD = uv > 0 ? uv : null; var us = parseFloat($('#t-sale-usd').value); p.salePriceUSD = us > 0 ? us : null;
      p.desc = $('#f-desc').value.trim(); p.ingredients = $('#f-ing').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      p.isNew = $('#f-new').checked; p.isCampaign = $('#f-camp').checked; p.available = $('#f-av').checked; p.arEnabled = false;
      var i = D.products.map(function (x) { return x.id; }).indexOf(p.id); if (i < 0) D.products.push(p); else D.products[i] = p;
      if (save()) { closeModal(); render(); }
    };
  }

  /* ---------- kategoriler ---------- */
  function tabCategories(body) {
    body.innerHTML = '<div class="toolbar"><span style="color:#7a7167">Sıralamayı ▲▼ ile değiştirin. Menüde 2 sütunlu kare kartlar olarak görünür.</span><button class="btn acc" id="addc">+ Yeni Kategori</button></div>' +
      D.categories.map(function (c, i) {
        var n = D.products.filter(function (p) { return p.categoryId === c.id; }).length;
        return '<div class="item"><img src="' + esc(U(c.image)) + '" alt=""><div class="meta"><b>' + esc(c.name) + '</b><small>' + n + ' ürün</small></div><div class="acts"><button class="btn sm" data-up="' + i + '"' + (i ? '' : ' disabled') + '>▲</button><button class="btn sm" data-dn="' + i + '"' + (i < D.categories.length - 1 ? '' : ' disabled') + '>▼</button><button class="btn sm" data-edit="' + esc(c.id) + '">Düzenle</button><button class="btn sm del" data-del="' + esc(c.id) + '">Sil</button></div></div>';
      }).join('');
    $('#addc').onclick = function () { catForm(null); };
    body.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var mv = function (i, d) { var t = D.categories[i]; D.categories[i] = D.categories[i + d]; D.categories[i + d] = t; save(); render(); };
      if (b.dataset.up) mv(+b.dataset.up, -1); if (b.dataset.dn) mv(+b.dataset.dn, 1); if (b.dataset.edit) catForm(b.dataset.edit);
      if (b.dataset.del) { var n = D.products.filter(function (p) { return p.categoryId === b.dataset.del; }).length; if (confirm('Kategori silinsin mi?' + (n ? ' İçindeki ' + n + ' ürün de silinecek!' : ''))) { D.categories = D.categories.filter(function (c) { return c.id !== b.dataset.del; }); D.products = D.products.filter(function (p) { return p.categoryId !== b.dataset.del; }); save('Silindi'); render(); } }
    };
  }
  function catForm(id) {
    var c = id ? JSON.parse(JSON.stringify(D.categories.filter(function (x) { return x.id === id; })[0])) : { id: 'k' + uid(), name: '', image: '' };
    openModal('<h2>' + (id ? 'Kategoriyi Düzenle' : 'Yeni Kategori') + '</h2><label class="f">Kategori adı (Türkçe)<input id="c-name" value="' + esc(c.name) + '"></label><div class="grid2"><label class="f">İngilizce ad<input id="c-en" value="' + esc(tg(c, 'en', 'name')) + '"></label><label class="f">Arapça ad<input id="c-ar" dir="rtl" value="' + esc(tg(c, 'ar', 'name')) + '"></label></div><b style="font-size:13px;color:#7a7167">Kapak fotoğrafı</b>' +
      '<div class="imgs" style="margin-top:8px"><div class="im main" style="width:150px;height:150px"><img id="c-prev" src="' + esc(U(c.image)) + '" alt=""></div></div>' +
      '<div class="row" style="margin-bottom:16px;flex-wrap:wrap"><label class="btn sm">Fotoğraf yükle<input id="c-file" type="file" accept="image/*" hidden></label><input id="c-url" placeholder="veya yol: img/kapak.jpg" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid #e5dfd6;border-radius:10px"></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn" id="c-cancel">İptal</button><button class="btn pri" id="c-save">Kaydet</button></div>');
    $('#c-file').onchange = function (e) { if (e.target.files[0]) addPhoto(e.target.files[0], 900).then(function (path) { c.image = path; $('#c-prev').src = U(path); }); };
    $('#c-url').oninput = function (e) { if (e.target.value.trim()) { c.image = e.target.value.trim(); $('#c-prev').src = c.image; } };
    $('#c-cancel').onclick = closeModal;
    $('#c-save').onclick = function () { var n = $('#c-name').value.trim(); if (!n) return toast('Kategori adı gerekli'); c.name = n; setTg(c, 'en', 'name', $('#c-en').value.trim()); setTg(c, 'ar', 'name', $('#c-ar').value.trim()); var i = D.categories.map(function (x) { return x.id; }).indexOf(c.id); if (i < 0) D.categories.push(c); else D.categories[i] = c; if (save()) { closeModal(); render(); } };
  }

  /* ---------- ayarlar ---------- */
  function tabSettings(body) {
    var s = D.settings, fld = function (k, label, type) { return '<label class="f">' + label + '<input data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(s[k]) + '"></label>'; };
    body.innerHTML = '<div class="card"><h3>İşletme bilgileri</h3><div class="grid2">' + fld('businessName', 'İşletme adı') + fld('tagline', 'Slogan / alt yazı') + fld('logoText', 'Logo harfleri (örn. LD)') + fld('currency', 'Para birimi (Türkçe sürüm)') + '</div></div>' +
      '<div class="card"><h3>Diller & Dolar</h3><div class="checks">' + [['tr', 'Türkçe'], ['en', 'English'], ['ar', 'العربية']].map(function (x) { return '<label><input type="checkbox" data-lg="' + x[0] + '"' + ((s.langs || ['tr', 'en', 'ar']).indexOf(x[0]) > -1 ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '</div><div class="grid2">' + fld('usdRate', '1 Dolar kaç TL? (İngilizce/Arapça fiyatlar buna göre hesaplanır)', 'number') + '<label class="f">Varsayılan dil<select data-k="defaultLang">' + [['tr', 'Türkçe'], ['en', 'English'], ['ar', 'العربية']].map(function (x) { return '<option value="' + x[0] + '"' + ((s.defaultLang || 'tr') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div><small style="color:#7a7167">Dolar fiyatını tek tek yazmak isterseniz ürün düzenleme ekranındaki $ alanını kullanın.</small></div>' +
      ['en', 'ar'].map(function (l) { var f2 = function (k, label) { return '<label class="f">' + label + '<input data-t="' + l + '.' + k + '" ' + (l === 'ar' ? 'dir="rtl" ' : '') + 'value="' + esc(tg(s, l, k)) + '"></label>'; }; return '<div class="card"><h3>' + LN[l] + ' site yazıları</h3><div class="grid2">' + f2('tagline', 'Slogan') + f2('categoriesTitle', 'Ana başlık') + f2('featuredTitle', 'Öne çıkanlar başlığı') + f2('searchPlaceholder', 'Arama kutusu') + f2('address', 'Adres') + f2('wifi', 'Wi-Fi bilgisi') + '</div>' + f2('marquee', 'Kayan yazı') + f2('footerText', 'Alt bilgi yazısı') + '</div>'; }).join('') +
      '<div class="card"><h3>Menü yazıları</h3><div class="grid2">' + fld('categoriesTitle', 'Ana başlık (örn. Menü)') + fld('featuredTitle', 'Öne çıkanlar başlığı') + fld('searchPlaceholder', 'Arama kutusu yazısı') + '</div>' + fld('marquee', 'Kayan yazı (boş bırakırsanız gizlenir)') +
      '<div class="checks"><label><input type="checkbox" data-k="showFeatured"' + (s.showFeatured !== false ? ' checked' : '') + '> "Öne çıkanlar" bölümünü göster</label></div></div>' +
      '<div class="card"><h3>Görünüm</h3><label class="f" style="max-width:200px">Vurgu rengi<input data-k="accent" type="color" value="' + esc(s.accent) + '"></label></div>' +
      '<div class="card"><h3>İletişim & alt bilgi</h3><div class="grid2">' + fld('phone', 'Telefon') + fld('instagram', 'Instagram') + fld('address', 'Adres') + fld('wifi', 'Wi-Fi bilgisi') + '</div>' + fld('footerText', 'Alt bilgi yazısı') + '</div>' +
      '<div class="card"><h3>Panel şifresi</h3>' + fld('adminPassword', 'Şifre') + '<small style="color:#7a7167">Statik sitede çalıştığı için bu şifre kazara girişi engeller; gerçek güvenlik katmanı değildir.</small></div><button class="btn pri" id="ss">Kaydet</button>';
    $('#ss').onclick = function () { [].forEach.call(body.querySelectorAll('[data-k]'), function (i) { s[i.dataset.k] = i.type === 'checkbox' ? i.checked : (i.type === 'number' ? (parseFloat(i.value) || 0) : i.value); }); s.langs = [].map.call(body.querySelectorAll('[data-lg]:checked'), function (x) { return x.dataset.lg; }); if (!s.langs.length) s.langs = ['tr']; [].forEach.call(body.querySelectorAll('[data-t]'), function (i) { var q = i.dataset.t.split('.'); setTg(s, q[0], q[1], i.value); }); if (save()) render(); };
  }

  /* ---------- yayınla ---------- */
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); }
  function tabPublish(body) {
    var guess = location.protocol.indexOf('http') === 0 ? location.href.replace(/#.*$/, '') : 'https://KULLANICI.github.io/REPO/';
    body.innerHTML = '<div class="note"><b>Önemli:</b> Panelde yaptığınız değişiklikler bu tarayıcıda <b>taslak</b> olarak durur. Müşterilerin görmesi için <b>Yayın paketini</b> indirip içindekileri GitHub repoya yükleyin.</div>' +
      '<div class="card"><h3>1) Yayınla</h3><div class="row" style="flex-wrap:wrap"><button class="btn acc" id="dl">Yayın paketini indir (.zip)</button><span style="color:#7a7167">menu.js + yüklediğiniz fotoğraflar ve 3D modeller</span></div>' +
      '<ol class="steps" style="margin-bottom:0"><li>Zip\'i açın</li><li>GitHub repoda <b>Add file → Upload files</b> ile açılan klasörleri/dosyaları repo köküne sürükleyin (aynı isimli <code>data/menu.js</code> değişir)</li><li>Commit changes → 1-2 dk sonra menü güncellenir</li></ol></div>' +
      '<div class="card"><h3>2) QR Kod</h3><label class="f">Menü sitenizin adresi<input id="qu" value="' + esc(guess) + '"></label><div class="qr"><img id="qi" alt="QR"><div><button class="btn" id="qd">QR\'ı indir (PNG)</button><p style="color:#7a7167;max-width:330px">Adresi GitHub Pages linkinizle değiştirin (örn. <code>https://kullanici.github.io/qr-menu/</code>). QR görseli api.qrserver.com üzerinden üretilir, internet gerekir.</p></div></div></div>' +
      '<div class="card"><h3>3) Yedek / Geri yükle</h3><div class="row" style="flex-wrap:wrap"><label class="btn">menu.js içe aktar<input id="imp" type="file" accept=".js,.json,.txt" hidden></label><button class="btn del" id="rs">Taslağı sil, yayındaki menüye dön</button></div></div>';
    var qr = function () { $('#qi').src = 'https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=10&data=' + encodeURIComponent($('#qu').value); };
    qr(); $('#qu').onchange = qr;
    $('#qd').onclick = function () { var a = document.createElement('a'); a.href = $('#qi').src + '&format=png'; a.target = '_blank'; a.download = 'menu-qr.png'; a.click(); };
    $('#dl').onclick = function () { Store.buildPackage(D).then(function (r) { download('yayin-paketi.zip', r.blob); toast('İndirildi (' + r.count + ' dosya) — zip içindekileri GitHub\'a yükleyin'); }); };
    $('#imp').onchange = function (e) { var f = e.target.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { try { D = Store.parseImport(fr.result); save('İçe aktarıldı'); render(); } catch (er) { toast('Hata: ' + er.message); } }; fr.readAsText(f); };
    $('#rs').onclick = function () { if (confirm('Bu tarayıcıdaki taslak ve yüklenen dosyalar silinsin mi?')) { Store.reset(); Store.clearAssets(); D = Store.get(); toast('Sıfırlandı'); render(); } };
  }

  return { mount: mount, refresh: refresh };
})();
