/* Fotoğraftan 3D (2.5D) dönüştürücü — tamamen tarayıcıda çalışır, sunucu gerekmez.
   1) arka planı otomatik ayırır  2) şişirilmiş (kabartmalı) bir ağ (mesh) üretir  3) GLB (gerçek AR) olarak paketler.
   Not: Tek fotoğraftan elde edilen model "yarım 3D"dir (önden bakışta gerçekçi). Tam 360° tarama için gerçek 3D model (.glb) yükleyin. */
window.Photo3D = (function () {
  'use strict';

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Görsel yüklenemedi')); }; i.src = src;
    });
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function toBlob(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type, q); }); }

  function blur(src, w, h, r) {
    if (r < 1) return src;
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), x, y, k, s, n;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) { s = 0; n = 0; for (k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } } tmp[y * w + x] = s / n; }
    }
    for (x = 0; x < w; x++) {
      for (y = 0; y < h; y++) { s = 0; n = 0; for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } } out[y * w + x] = s / n; }
    }
    return out;
  }

  /* ---- arka plan ayırma: kenar bandı = arka plan, merkez = ürün (renk histogramı) ---- */
  function segment(src, W, H) {
    var k = Math.min(1, 200 / Math.max(W, H)), aw = Math.max(8, Math.round(W * k)), ah = Math.max(8, Math.round(H * k));
    var c = document.createElement('canvas'); c.width = aw; c.height = ah;
    var cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, aw, ah);
    var d = cx.getImageData(0, 0, aw, ah).data, Q = 12, NB = Q * Q * Q, fg = new Float32Array(NB), bg = new Float32Array(NB), nf = 0, nb = 0, x, y;
    function bin(i) { return (((d[i] * Q) >> 8) * Q + ((d[i + 1] * Q) >> 8)) * Q + ((d[i + 2] * Q) >> 8); }
    var band = Math.max(2, Math.round(Math.min(aw, ah) * 0.06));
    for (y = 0; y < ah; y++) for (x = 0; x < aw; x++) {
      var i = (y * aw + x) * 4, nx = (x + .5) / aw * 2 - 1, ny = (y + .5) / ah * 2 - 1;
      if (x < band || y < band || x >= aw - band || y >= ah - band) { bg[bin(i)]++; nb++; }
      else if (Math.hypot(nx / 0.42, ny / 0.42) < 1) { fg[bin(i)]++; nf++; }
    }
    var s = new Float32Array(aw * ah);
    for (y = 0; y < ah; y++) for (x = 0; x < aw; x++) {
      var j = (y * aw + x) * 4, b = bin(j), pf = fg[b] / Math.max(1, nf), pb = bg[b] / Math.max(1, nb);
      var p = (pf + 1e-3) / (pf + pb + 2e-3);
      var nx2 = (x + .5) / aw * 2 - 1, ny2 = (y + .5) / ah * 2 - 1, pri = 1 - smooth(0.55, 1.0, Math.hypot(nx2, ny2));
      s[y * aw + x] = (x < band || y < band || x >= aw - band || y >= ah - band) ? 0 : (0.78 * p + 0.22 * pri);
    }
    s = blur(s, aw, ah, 2);
    var m = new Uint8Array(aw * ah), n;
    for (n = 0; n < m.length; n++) m[n] = s[n] > 0.5 ? 1 : 0;
    // en büyük (merkezi kapsayan) bileşen
    var lab = new Int32Array(aw * ah), best = 0, bestScore = -1, cur = 0, stack = [];
    for (n = 0; n < m.length; n++) {
      if (!m[n] || lab[n]) continue;
      cur++; stack.length = 0; stack.push(n); lab[n] = cur; var score = 0;
      while (stack.length) {
        var q = stack.pop(), qx = q % aw, qy = (q / aw) | 0;
        if (Math.hypot(((qx + .5) / aw * 2 - 1) / 0.5, ((qy + .5) / ah * 2 - 1) / 0.5) < 1) score += 3; score += 1;
        if (qx > 0 && m[q - 1] && !lab[q - 1]) { lab[q - 1] = cur; stack.push(q - 1); }
        if (qx < aw - 1 && m[q + 1] && !lab[q + 1]) { lab[q + 1] = cur; stack.push(q + 1); }
        if (qy > 0 && m[q - aw] && !lab[q - aw]) { lab[q - aw] = cur; stack.push(q - aw); }
        if (qy < ah - 1 && m[q + aw] && !lab[q + aw]) { lab[q + aw] = cur; stack.push(q + aw); }
      }
      if (score > bestScore) { bestScore = score; best = cur; }
    }
    var keep = new Uint8Array(aw * ah);
    for (n = 0; n < m.length; n++) keep[n] = lab[n] === best && best ? 1 : 0;
    // delikleri doldur: kenardan ulaşılamayan her şey ürün
    var outside = new Uint8Array(aw * ah); stack.length = 0;
    for (x = 0; x < aw; x++) { stack.push(x, (ah - 1) * aw + x); }
    for (y = 0; y < ah; y++) { stack.push(y * aw, y * aw + aw - 1); }
    while (stack.length) {
      var t = stack.pop(); if (outside[t] || keep[t]) continue; outside[t] = 1;
      var tx = t % aw, ty = (t / aw) | 0;
      if (tx > 0) stack.push(t - 1); if (tx < aw - 1) stack.push(t + 1); if (ty > 0) stack.push(t - aw); if (ty < ah - 1) stack.push(t + aw);
    }
    var f = new Float32Array(aw * ah), area = 0;
    for (n = 0; n < f.length; n++) { f[n] = outside[n] ? 0 : 1; area += f[n]; }
    f = blur(f, aw, ah, 1);
    // tam çözünürlüğe bilinear + keskinleştir
    var out = new Float32Array(W * H);
    for (y = 0; y < H; y++) {
      var sy = (y + .5) * ah / H - .5, y0 = Math.max(0, Math.min(ah - 2, Math.floor(sy))), fy = Math.min(1, Math.max(0, sy - y0));
      for (x = 0; x < W; x++) {
        var sx = (x + .5) * aw / W - .5, x0 = Math.max(0, Math.min(aw - 2, Math.floor(sx))), fx = Math.min(1, Math.max(0, sx - x0));
        var v = f[y0 * aw + x0] * (1 - fx) * (1 - fy) + f[y0 * aw + x0 + 1] * fx * (1 - fy) + f[(y0 + 1) * aw + x0] * (1 - fx) * fy + f[(y0 + 1) * aw + x0 + 1] * fx * fy;
        out[y * W + x] = smooth(0.4, 0.6, v);
      }
    }
    return { mask: out, area: area / (aw * ah) };
  }

  function shapeMask(W, H, kind) {
    var m = new Float32Array(W * H), x, y, rr = 0.12 * Math.min(W, H);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var px = x + .5 - W / 2, py = y + .5 - H / 2, v;
      if (kind === 'ellipse') { var nx = px / (W / 2), ny = py / (H / 2); v = 1 - smooth(0.97, 1.0, Math.hypot(nx, ny)); }
      else {
        var qx = Math.abs(px) - (W / 2 - rr), qy = Math.abs(py) - (H / 2 - rr);
        var d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; v = 1 - smooth(-1.5, 1.5, d);
      }
      m[y * W + x] = v;
    }
    return m;
  }

  /* ---- yapay zekâ ile arka plan silme (internet varsa), yoksa yerel yöntem ---- */
  function removeBackground(src) {
    var urls = ['https://esm.sh/@imgly/background-removal@1.5.5', 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm'];
    var load = function (i) { return i >= urls.length ? Promise.reject(new Error('lib')) : import(/* @vite-ignore */ urls[i]).catch(function () { return load(i + 1); }); };
    return load(0).then(function (m) { var f = m.removeBackground || (m.default && m.default.removeBackground) || m.default; return f(src, { output: { format: 'image/png' } }); })
      .then(function (blob) { return loadImage(URL.createObjectURL(blob)); });
  }

  /* ---- ana dönüştürme ---- */
  function convert(src, o) {
    o = Object.assign({ mode: 'upright', widthCm: 20, removeBg: true, shape: 'auto', relief: 0, depth: 0.8, maxTex: 896, grid: 120 }, o || {});
    return (typeof src === 'string' ? loadImage(src) : Promise.resolve(src)).then(function (img) {
      var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
      var k = Math.min(1, o.maxTex / Math.max(sw, sh)), W = Math.round(sw * k), H = Math.round(sh * k);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
      var id = ctx.getImageData(0, 0, W, H), alpha = null, how = 'bg', i, x, y;
      if (o.preCut) { alpha = new Float32Array(W * H); for (i = 0; i < W * H; i++) alpha[i] = id.data[i * 4 + 3] / 255; how = 'ml'; }
      else if (o.removeBg && o.shape === 'auto') { var r = segment(cv, W, H); if (r.area > 0.04 && r.area < 0.93) alpha = r.mask; }
      if (!alpha) { alpha = shapeMask(W, H, o.shape === 'ellipse' ? 'ellipse' : 'rounded'); how = 'shape'; }
      // sınırlayıcı kutu
      var x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (alpha[y * W + x] > 0.12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      var pad = 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
      var cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      var cc = document.createElement('canvas'); cc.width = cw; cc.height = ch;
      var cctx = cc.getContext('2d'), cid = cctx.createImageData(cw, ch), A = new Float32Array(cw * ch);
      for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
        var si = ((y + y0) * W + (x + x0)), di = (y * cw + x) * 4, a = alpha[si];
        cid.data[di] = id.data[si * 4]; cid.data[di + 1] = id.data[si * 4 + 1]; cid.data[di + 2] = id.data[si * 4 + 2]; cid.data[di + 3] = Math.round(a * 255); A[y * cw + x] = a;
      }
      cctx.putImageData(cid, 0, 0);
      return toBlob(cc, 'image/png').then(function (png) {
        return png.arrayBuffer().then(function (buf) {
          var mesh = buildMesh(A, cid.data, cw, ch, o);
          var glb = makeGLB(mesh, new Uint8Array(buf));
          return { glb: new Blob([glb], { type: 'model/gltf-binary' }), cutout: png, how: how, width: cw, height: ch };
        });
      });
    });
  }

  /* cutout'u düz renk zemin üzerine koyup JPEG üretir (ör. şeffaf/damalı arka planlı fotoğrafları temizlemek için) */
  function composite(src, bg) {
    return convert(src, { removeBg: true, grid: 8 }).then(function (r) {
      return loadImage(URL.createObjectURL(r.cutout)).then(function (im) {
        var c = document.createElement('canvas'), pad = 0.08, w = Math.round(im.width * (1 + pad * 2)), h = Math.round(im.height * (1 + pad * 2)); c.width = w; c.height = h;
        var x = c.getContext('2d'); x.fillStyle = bg || '#f3efe9'; x.fillRect(0, 0, w, h); x.drawImage(im, Math.round(im.width * pad), Math.round(im.height * pad));
        return toBlob(c, 'image/jpeg', 0.92);
      });
    });
  }

  /* düz fotoğraf kartı: şişirme/bozulma yok, ürün fotoğraftaki gibi görünür */
  function buildCard(cw, ch, o) {
    var wm = o.widthCm / 100, hm = wm * ch / cw, flat = o.mode === 'flat', t = flat ? 0.006 : 0.004, pos = [], uv = [], nor = [], s, k;
    var C = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (s = 0; s < 2; s++) for (k = 0; k < 4; k++) {
      var i = C[k][0], j = C[k][1], X = (i - 0.5) * wm, Y, Z;
      if (!flat) { Y = (1 - j) * hm; Z = s === 0 ? t / 2 : -t / 2; } else { Z = (j - 0.5) * hm; Y = s === 0 ? t : 0; }
      pos.push(X, Y, Z); uv.push(s === 0 ? i : 1 - i, j);
      var d = s === 0 ? 1 : -1; if (flat) nor.push(0, d, 0); else nor.push(0, 0, d);
    }
    var idxF = [0, 2, 1, 1, 2, 3], idxB = [4, 5, 6, 5, 7, 6];
    function nz(idx) { var a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; return flat ? uz * vx - ux * vz : ux * vy - uy * vx; }
    function flip(idx) { var t2 = idx[1]; idx[1] = idx[2]; idx[2] = t2; idx[4] = idx[4] + 0; var t3 = idx[4]; idx[4] = idx[5]; idx[5] = t3; }
    if (nz(idxF) < 0) flip(idxF); if (nz(idxB) > 0) flip(idxB);
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idxF: new Uint32Array(idxF), idxB: new Uint32Array(idxB) };
  }

  function buildMesh(A, rgba, cw, ch, o) {
    if (!o.relief) return buildCard(cw, ch, o);
    var long = Math.max(cw, ch), gw = Math.max(8, Math.round(o.grid * cw / long)), gh = Math.max(8, Math.round(o.grid * ch / long));
    var wm = o.widthCm / 100, hm = wm * ch / cw, nx = gw + 1, ny = gh + 1, n = nx * ny, i, j;
    // maske + parlaklık örnekle
    var M = new Float32Array(n), L = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      var px = Math.min(cw - 1, Math.round(i / gw * (cw - 1))), py = Math.min(ch - 1, Math.round(j / gh * (ch - 1))), q = py * cw + px;
      M[j * nx + i] = A[q]; L[j * nx + i] = (rgba[q * 4] * 0.3 + rgba[q * 4 + 1] * 0.59 + rgba[q * 4 + 2] * 0.11) / 255;
    }
    // uzaklık dönüşümü (chamfer) → yuvarlak kesit
    var D = new Float32Array(n), INF = 1e9;
    for (i = 0; i < n; i++) D[i] = M[i] > 0.5 ? INF : 0;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      var p = j * nx + i, v = D[p]; if (!v) continue;
      if (i > 0) v = Math.min(v, D[p - 1] + 1); if (j > 0) v = Math.min(v, D[p - nx] + 1);
      if (i > 0 && j > 0) v = Math.min(v, D[p - nx - 1] + 1.414); if (i < nx - 1 && j > 0) v = Math.min(v, D[p - nx + 1] + 1.414); D[p] = v;
    }
    var maxd = 1;
    for (j = ny - 1; j >= 0; j--) for (i = nx - 1; i >= 0; i--) {
      var p2 = j * nx + i, v2 = D[p2]; if (!v2) continue;
      if (i < nx - 1) v2 = Math.min(v2, D[p2 + 1] + 1); if (j < ny - 1) v2 = Math.min(v2, D[p2 + nx] + 1);
      if (i < nx - 1 && j < ny - 1) v2 = Math.min(v2, D[p2 + nx + 1] + 1.414); if (i > 0 && j < ny - 1) v2 = Math.min(v2, D[p2 + nx - 1] + 1.414);
      D[p2] = v2; if (v2 < INF && v2 > maxd) maxd = v2;
    }
    var H = new Float32Array(n), R0 = Math.max(2, maxd * 0.9);
    for (i = 0; i < n; i++) { var t = Math.min(1, D[i] / R0); H[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); }
    var Hs = blur(blur(H, nx, ny, 1), nx, ny, 1);
    var Ls = blur(L, nx, ny, 2);
    for (i = 0; i < n; i++) Hs[i] = Math.max(0, Hs[i] * (1 + 0.12 * (L[i] - Ls[i])) * (M[i] > 0.02 ? 1 : 0));

    var flat = o.mode === 'flat';
    var hz = 0.5 * o.depth * Math.min(wm, hm), T = Math.min(0.045, 0.14 * Math.min(wm, hm));
    var pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idxF = [], idxB = [], v3 = 0, v2i = 0;
    for (var s = 0; s < 2; s++) {
      for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
        var h = Hs[j * nx + i], X = (i / gw - 0.5) * wm, Y, Z;
        if (!flat) { Y = (1 - j / gh) * hm; Z = (s === 0 ? 1 : -1) * hz * h; }
        else { Z = (j / gh - 0.5) * hm; Y = s === 0 ? 0.004 + T * h : 0; }
        pos[v3++] = X; pos[v3++] = Y; pos[v3++] = Z;
        uv[v2i++] = s === 0 ? i / gw : 1 - i / gw; uv[v2i++] = j / gh;
      }
    }
    for (j = 0; j < gh; j++) for (i = 0; i < gw; i++) {
      var a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (Math.max(M[a], M[b], M[c], M[d]) < 0.02) continue;
      idxF.push(a, c, b, b, c, d); idxB.push(a + n, b + n, c + n, b + n, d + n, c + n);
    }
    // sarım yönünü doğrula: ön yüz +z (ya da +y) bakmalı
    function nrm(idx, k) {
      var A0 = idx[k] * 3, B0 = idx[k + 1] * 3, C0 = idx[k + 2] * 3, ux = pos[B0] - pos[A0], uy = pos[B0 + 1] - pos[A0 + 1], uz = pos[B0 + 2] - pos[A0 + 2], vx = pos[C0] - pos[A0], vy = pos[C0 + 1] - pos[A0 + 1], vz = pos[C0 + 2] - pos[A0 + 2];
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    }
    function flipAll(idx) { for (var k = 0; k < idx.length; k += 3) { var t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } }
    var mid = Math.floor(idxF.length / 6 / 2) * 6, nf = nrm(idxF, mid), up = flat ? nf[1] : nf[2];
    if (up < 0) flipAll(idxF);
    var mb = Math.floor(idxB.length / 6 / 2) * 6, nb = nrm(idxB, mb), dn = flat ? nb[1] : nb[2];
    if (dn > 0) flipAll(idxB);
    // normaller
    var nor = new Float32Array(pos.length), all = [idxF, idxB];
    all.forEach(function (idx) {
      for (var k = 0; k < idx.length; k += 3) {
        var nn = nrm(idx, k);
        for (var m = 0; m < 3; m++) { var vi = idx[k + m] * 3; nor[vi] += nn[0]; nor[vi + 1] += nn[1]; nor[vi + 2] += nn[2]; }
      }
    });
    for (i = 0; i < n * 2; i++) {
      var l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1; nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l;
    }
    return { pos: pos, nor: nor, uv: uv, idxF: new Uint32Array(idxF), idxB: new Uint32Array(idxB) };
  }

  function makeGLB(m, png) {
    function pad4(len) { return (4 - len % 4) % 4; }
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], i;
    for (i = 0; i < m.pos.length; i += 3) for (var c = 0; c < 3; c++) { if (m.pos[i + c] < mn[c]) mn[c] = m.pos[i + c]; if (m.pos[i + c] > mx[c]) mx[c] = m.pos[i + c]; }
    var chunks = [m.pos, m.nor, m.uv, m.idxF, m.idxB, png], views = [], off = 0;
    chunks.forEach(function (ch) { var b = new Uint8Array(ch.buffer ? ch.buffer.slice(ch.byteOffset, ch.byteOffset + ch.byteLength) : ch); views.push({ b: b, off: off }); off += b.length + pad4(b.length); });
    var gltf = {
      asset: { version: '2.0', generator: 'qr-menu photo3d' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }, { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 4, material: 1 }] }],
      materials: [
        { pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 }, alphaMode: 'MASK', alphaCutoff: 0.5 },
        { pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [0.92, 0.92, 0.92, 1], metallicFactor: 0, roughnessFactor: 0.9 }, alphaMode: 'MASK', alphaCutoff: 0.5 }],
      textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }], images: [{ bufferView: 5, mimeType: 'image/png' }],
      buffers: [{ byteLength: off }],
      bufferViews: [
        { buffer: 0, byteOffset: views[0].off, byteLength: views[0].b.length, target: 34962 }, { buffer: 0, byteOffset: views[1].off, byteLength: views[1].b.length, target: 34962 },
        { buffer: 0, byteOffset: views[2].off, byteLength: views[2].b.length, target: 34962 }, { buffer: 0, byteOffset: views[3].off, byteLength: views[3].b.length, target: 34963 },
        { buffer: 0, byteOffset: views[4].off, byteLength: views[4].b.length, target: 34963 }, { buffer: 0, byteOffset: views[5].off, byteLength: views[5].b.length }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: m.pos.length / 3, type: 'VEC3', min: mn, max: mx }, { bufferView: 1, componentType: 5126, count: m.nor.length / 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: m.uv.length / 2, type: 'VEC2' }, { bufferView: 3, componentType: 5125, count: m.idxF.length, type: 'SCALAR' }, { bufferView: 4, componentType: 5125, count: m.idxB.length, type: 'SCALAR' }]
    };
    var json = new TextEncoder().encode(JSON.stringify(gltf)), jp = pad4(json.length), jlen = json.length + jp, total = 12 + 8 + jlen + 8 + off;
    var out = new Uint8Array(total), dv = new DataView(out.buffer), p = 0;
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jlen, true); dv.setUint32(16, 0x4E4F534A, true); out.set(json, 20); for (i = 0; i < jp; i++) out[20 + json.length + i] = 32;
    p = 20 + jlen; dv.setUint32(p, off, true); dv.setUint32(p + 4, 0x004E4942, true); p += 8;
    views.forEach(function (v) { out.set(v.b, p + v.off); });
    return out;
  }

  return { removeBackground: removeBackground, convert: convert, composite: composite, loadImage: loadImage };
})();
