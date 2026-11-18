# Audit paritas WebGPU vs WebGL2 — `liquid-glass-ios-kit-v2.html`

Tanggal: 2026-11-18
Lingkup: seluruh pipeline WebGPU (WGSL) dibandingkan baris per baris dengan pipeline WebGL2 di file yang sama.
Yang diperiksa: shader, layout uniform, urutan pass, blend state, ukuran/scissor, upload tekstur, dan alur render per frame.

Lingkungan uji: Chrome 158.0.8127.37 (WebGPU aktif, `bgra8unorm`), DPR 1 dan 2.

---

## Ringkasan

| # | Prioritas | Temuan | Akibat |
|---|-----------|--------|--------|
| 1 | **DIPERBAIKI** | Buffer uniform ditulis 2× dalam satu frame, semua pass memakai nilai terakhir | Blur glass & blur atas kehilangan satu sumbu; saturasi strip atas salah |
| 2 | **DIPERBAIKI** | Tekstur glyph tidak premultiplied, shader menganggap premultiplied | Ikon/label tab (alpha 0.65) dan semua tepi anti-alias ~54% terlalu terang |
| 3 | Sebaiknya | WebGPU tidak memakai HTML-in-Canvas (HIC) | Sumber backdrop beda dengan WebGL di browser yang mendukung HIC |
| 4 | Sebaiknya | Tidak ada self-check / deteksi layar kosong di jalur WebGPU | Kalau pipeline gagal, halaman diam kosong tanpa fallback |
| 5 | Sebaiknya | Batas keras 32 item glass | Di halaman dengan banyak kontrol terlihat, item terakhir (termasuk pil) hilang diam-diam |
| 6 | Sebaiknya | `writeBuffer` dipanggil di dalam render loop untuk satu buffer yang dipakai dua pass | Ini akar dari #1, dicatat terpisah sebagai pola yang harus dihindari |
| 7 | Kecil | Readback debug tiap 60 frame ikut terkirim di build | Alokasi buffer + `mapAsync` tiap detik, tidak dipakai aplikasi |
| 8 | Kecil | Uniform `texFlip` mati di WebGPU | 4 byte + 3 baris kode tanpa efek |
| 9 | Kecil | Tidak ada timestamp GPU (`gpuBegin/gpuEnd`) | HUD menampilkan `n/a` untuk waktu GPU |
| 10 | Kecil | Diag `#src` tidak di-refresh untuk WebGPU setelah resize | Teks ukuran kanvas bisa basi |

Semua temuan punya bukti (kode atau uji terisolasi) di bawah. Bagian "Yang sudah 1:1" mencatat apa saja yang **sudah** identik, supaya tidak diaudit ulang.

### Status perbaikan (18 Nov 2026)

Dua temuan "harus" sudah diperbaiki di `liquid-glass-ios-kit-v2.html`. Nomor 3–10 belum disentuh.

Hasil ukur setelah perbaikan (Chrome 158, DPR 2, 860×1688, HIC dimatikan di kedua sisi supaya backdrop-nya sama):

| Uji | Sebelum | Sesudah |
|-----|---------|---------|
| Halaman Library, bar glass (baris 1400–1688) | rata-rata 7.31 / 3.87 / 1.58 per 765, >900 piksel beda >24 | 0.002 / 0.004 / 0.002, **0 piksel >24** |
| Halaman Library, seluruh gambar | rata-rata 0.75, maks 81 | rata-rata 0.0010, maks 6, **0 piksel >8** |
| Halaman Appearance + pil glass terangkat + thumb switch/slider | tidak diukur | rata-rata 0.00085, **564 dari 1.451.680 piksel** beda (≤6), **0 piksel >8** |

Sisa selisih (≤6/765, ~0.05% piksel) adalah pembulatan 8-bit di rantai blur, bukan perbedaan rumus. Semua self-test bawaan (`?test`) tetap "test ok (slider + renderer)" di mode `webgpu`, `webgl2`, dan `canvas`.

---

## 1. (Harus) Dua `writeBuffer` ke buffer yang sama dalam satu frame — pass pertama memakai nilai pass terakhir

**Status: sudah diperbaiki (18 Nov 2026).** Satu buffer per pass sekarang: `uDownTopBuf`/`uDownLowBuf`, `uBlurHBuf`/`uBlurVBuf`, `uVBlurHBuf`/`uVBlurVBuf` (L2176–2181), masing-masing terikat ke bind group pass-nya sendiri (L2217–2218, L2239–2242).

**Lokasi**

| Buffer | Tulis pertama | Tulis kedua | Dipakai oleh |
|--------|---------------|-------------|--------------|
| `uDownBuf` (16 B) | L2354–2355, `sat = 1.0` | L2403–2404, `sat = 1 + 0.5·P.vib` | pass down strip atas, lalu pass down glass |
| `uVBlurBuf` (48 B) | L2363–2365, `dir = (1/bw, 0)` | L2373–2374, `dir = (0, 1/bh)` | pass blur vertikal-strip atas (H lalu V) |
| `uBlurBuf` (128 B) | L2413–2415, `dir = (1/bw, 0)` | L2425–2426, `dir = (0, 1/bh)` | pass blur glass (horizontal lalu vertikal) |

**Apa yang beda**

Di WebGL, `gl.uniform*` dieksekusi saat itu juga, jadi tiap pass benar-benar memakai nilainya sendiri. Di WebGPU, `queue.writeBuffer` adalah operasi **queue**, bukan operasi command encoder: semua `writeBuffer` yang dipanggil sebelum `submit` selesai **sebelum** command buffer berjalan. Akibatnya ketiga buffer hanya berisi nilai tulis terakhir saat pass-pass tadi dieksekusi.

**Bukti (uji terisolasi, Chrome 158)**

Dua render pass, satu buffer, tulis `1.0` sebelum pass 1 dan `0.5` sebelum pass 2, satu `submit`:

```
pass1 red (A=1.0 -> 255 kalau berurutan, 128 kalau tulis terakhir menang): 128
pass2 red (B=0.5 -> 128): 128
```

Hasil: pass 1 ikut memakai `0.5`. Sama di headless, headless+ANGLE, dan headed.

**Dampak**

- `uBlurBuf`: pass "horizontal" (`lowA → lowB`) sebenarnya vertikal, lalu pass berikutnya (`lowB → lowA`) vertikal lagi. Jadi blur latar bar glass **σ·√2 di sumbu Y dan 0 di sumbu X**. Tepi vertikal album art menembus bar, dan blur vertikal lebih kuat dari WebGL.
- `uVBlurBuf`: blur progresif strip atas juga dua-duanya vertikal.
- `uDownBuf`: pass down strip atas memakai `sat = 1 + 0.5·vib` (default 1.5) padahal WebGL memakai `1`. Strip atas jadi lebih mentah warnanya.

Bukti pendukung dari screenshot yang ada: `cmp-gpu-light.png` vs `cmp-gl-light.png` (860×1688) berbeda rata-rata hanya 0.75/765, dan **seluruh selisih yang berarti ada di area bar glass**: baris 1400–1500 rata-rata 7.31, 1500–1600 rata-rata 3.87, 1600–1688 rata-rata 1.58; baris 0–1400 praktis 0. Artinya selisihnya persis di tempat blur dipakai.

**Fix minimal (pilih satu)**

1. Pisahkan buffer per pass (paling kecil risikonya, layout tidak berubah):
   - `uDownTopBuf` (sat 1.0) + `uDownLowBuf` (sat 1+vib) → `bgDownScene` / `bgDownFinal`.
   - `uBlurHBuf` + `uBlurVBuf` → `bgBlurLowA` (pakai H) dan `bgBlurLowB` (pakai V).
   - `uVBlurHBuf` + `uVBlurVBuf` → `bgVBlurLowC` (H) dan `bgVBlurLowD` (V).
   Masing-masing tetap 16/128/48 byte; bind group-nya sudah terpisah, hanya buffer yang perlu diduplikasi.
2. Atau satu buffer dengan dua slot + `hasDynamicOffset`, seperti pola `uGlassBuf` yang sudah dipakai.

Jangan menambal dengan `submit` di tengah frame: satu frame jadi dua submission dan urutan pass jadi rapuh.

---

## 2. (Harus) Glyph texture tidak premultiplied, tapi shader memperlakukannya premultiplied

**Status: sudah diperbaiki (18 Nov 2026).** Opsi (b) dipakai: `fs_quad` sekarang `return vec4f(t.rgb, t.a * m * u_qd.alpha);`, `pipeQuad` memakai blend `blendStraight` (`src-alpha / one-minus-src-alpha`), dan `sampleBackdrop` memakai `c * (1.0 - t.a) + t.rgb * t.a` (L1924).

**Lokasi**

- WebGL: L1434 `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)` → tekstur glyph **premultiplied**.
- WebGPU: L2341 `dev.queue.copyExternalImageToTexture({ source: gcv }, …)` → hasilnya **straight alpha**.
- Shader yang berasumsi premultiplied:
  - `fs_quad` (L2035–2051) + blend `one / one-minus-src-alpha` (L2157–2160, L2170).
  - `sampleBackdrop` (L1919–1925): `c = c * (1.0 - t.a) + t.rgb`.

**Apa yang beda**

`copyExternalImageToTexture` tidak mempremultiply sumber canvas. Opsi `premultipliedAlpha: true` dan `createImageBitmap(..., { premultiplyAlpha: 'premultiply' })` dua-duanya diabaikan Chrome untuk sumber canvas.

**Bukti (uji terisolasi)**

Canvas 2D `rgba(255,0,0,0.5)`:

```
canvas2d getImageData            : 255,0,0,128
webgl premultiply=false          : 255,0,0,128
webgl premultiply=true           : 128,0,0,128   <- yang dipakai jalur WebGL
gpu canvas default               : 255,0,0,128   <- yang dipakai jalur WebGPU
gpu premultipliedAlpha:true      : 255,0,0,128   (diabaikan)
createImageBitmap(premultiply)   : 255,0,0,128   (diabaikan)
```

**Dampak**

- Quad glyph: output `t * (m·alpha)` lalu blend `one / one-minus-src-alpha`. Untuk piksel dengan alpha `a`, WebGL memberi kontribusi `C·a·m·alpha`, WebGPU memberi `C·m·alpha` → **1/a kali terlalu terang**. Label & ikon tab yang tidak terpilih digambar dengan `globalAlpha = .65` (L1425), jadi praktis **~54% terlalu terang**; semua tepi anti-alias ikut terlalu terang.
- `sampleBackdrop` untuk pil/tab: `c·(1-a) + C` (seharusnya `c·(1-a) + C·a`) → baris tab di dalam lensa pil juga terlalu terang.
- Ini juga menjelaskan sisa selisih di area bar pada perbandingan screenshot.

**Fix minimal (dua titik, hasilnya eksak sama dengan WebGL)**

1. `fs_quad`: `return vec4f(t.rgb, t.a * m * u_qd.alpha);` dan pipeline `pipeQuad` memakai
   `{ srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }` (color dan alpha).
2. `sampleBackdrop`: `c = c * (1.0 - t.a) + t.rgb * t.a;`

Alternatif (premultiply di canvas 2D sebelum upload) tidak bisa diandalkan: Chrome selalu meng-unpremultiply saat upload (lihat bukti di atas).

---

## 3. (Sebaiknya) WebGPU tidak memakai HTML-in-Canvas, jadi sumber backdrop-nya beda

**Lokasi**: `renderWebGPU` L2327–2332 selalu `drawContent()` (replica 2D) lalu upload `cv`. Jalur WebGL: `detectHIC()` L1310–1328, upload live DOM L2785–2788, `requestPaint`/transform L2693.

**Bukti**: memuat halaman yang sama di Chrome 158:

```
webgl2 -> DOM live via HTML-in-Canvas (Chrome 155+) · DPR 1 · tex 16384 · 430×844
webgpu -> WebGPU (pipeline penuh: …) · DPR 1 · WebGPU (bgra8unorm) · 430×844
('texElementSubImage2D' in WebGL2RenderingContext.prototype) = true
```

**Dampak**

Di browser yang mendukung HIC, WebGL menggambar backdrop dari DOM hidup dan WebGPU dari raster canvas. Untuk konten statis hasilnya sama (di screenshot, area teks 0–1400 berbeda 0), tapi:
- teks/ikon tidak mengikuti hinting & subpixel rendering DOM asli;
- efek CSS yang tidak direplikasi `drawContent()` tidak muncul di WebGPU;
- setiap scroll, WebGPU me-raster ulang seluruh halaman di canvas 2D (lebih mahal daripada transform + `requestPaint`).

**Saran**: minimal tulis di panel/diag bahwa WebGPU = replica canvas (bukan HIC). Kalau HIC memang harus setara, upload `pageEl` lewat `copyExternalImageToTexture` dengan `requestPaint` yang sama — perubahan besar, jadi jangan dikerjakan tanpa kebutuhan.

---

## 4. (Sebaiknya) Tidak ada self-check untuk WebGPU

**Lokasi**: `selfCheck()` L1618–1629 hanya dipanggil di cabang WebGL (L2694) dan langsung `return` kalau `!GL_OK`.

**Dampak**: kalau pipeline WebGPU menghasilkan layar kosong (device error, pipeline invalid, tekstur tidak ke-upload), tidak ada yang mendeteksi dan tidak ada fallback ke WebGL. Bandingkan dengan jalur GL yang otomatis `enterFallback()`.

Catatan terkait: `createRenderPipeline` (L2127–2172) memvalidasi secara asinkron. Hanya error kompilasi WGSL yang ditangkap (L2073–2074); error pipeline hanya muncul sebagai *uncaptured error* di console, tidak melempar exception.

**Fix minimal**: `dev.addEventListener('uncapturederror', …)` → `skipGPU()`; dan pakai readback yang sudah ada (L2520–2537) untuk cek "layar kosong" setelah beberapa frame.

---

## 5. (Sebaiknya) Batas keras 32 item glass

**Lokasi**: `uGlassBuf` 32 × 256 B (L2178), `if (!GPU || glassItemCount >= 32) return;` (L2265), stride 256 di L2298/L2300.

**Dampak**: WebGL tidak punya batas ini. Di jalur WebGPU, kalau item ke-33 dan seterusnya digambar, item itu **hilang tanpa log**. Karena pil digambar paling akhir (L2490–2516), yang hilang pertama adalah pil seleksi. Halaman Appearance punya 29 kontrol switch/slider, tapi hanya yang terlihat yang dihitung (`cym` cull di L2475), jadi batas ini belum tercapai hari ini — statusnya limit, bukan bug aktif.

**Fix minimal**: naikkan ke 48/64 (biaya 8–16 KB) atau `console.warn` sekali saat batas tercapai, supaya tidak diam-diam.

---

## 6. (Sebaiknya) Pola `writeBuffer` di dalam render loop

Ini akar masalah #1 dan layak dicatat sebagai aturan: di WebGPU, uniform yang berbeda antar-pass **tidak boleh** ditulis ke buffer yang sama sebelum `submit`. Buffer yang aman ditulis berulang hanya kalau offset-nya berbeda (seperti `uGlassBuf`). Semua buffer lain (`uDownBuf`, `uBlurBuf`, `uVBlurBuf`, `uComposeBuf`, `uQuadBuf`) harus satu nilai per frame, atau dipisah per pass.

---

## 7. (Kecil) Readback debug ikut terkirim

**Lokasi**: L2520–2537. Tiap 60 frame: buat buffer 256 B, `copyTextureToBuffer`, `submit` tambahan, `mapAsync`, tulis `document.body.dataset.gpuPx` / `gpuFrame`, lalu destroy.

Tidak ada kode aplikasi yang membaca `gpuPx`/`gpuFrame`; hanya script uji (`screenshot-webgpu.mjs`, dll). Jalur WebGL tidak punya padanannya. Biaya: satu submission + sinkronisasi tiap detik. **Saran**: hapus, atau bungkus `if (DEBUG)`.

---

## 8. (Kecil) Uniform `texFlip` tidak terpakai di WebGPU

`GlassUniforms.texFlip` (L1823) selalu 0 karena `drawGlassItemGPU` tidak pernah menerima `it.texFlip` (L2296) — dan itu **benar**: `copyTextureToTexture` untuk `compTex` (L2499) menyalin top-origin ke top-origin, jadi tidak perlu flip (beda dengan WebGL yang butuh `texFlip = 1` di L1601 karena FBO GL bottom-origin). Tidak ada bug; sisa field yang bisa dihapus atau diberi komentar satu baris.

---

## 9. (Kecil) Tidak ada timestamp GPU

`gpuBegin()/gpuEnd()` hanya dipanggil di cabang WebGL (L2694). Di WebGPU, HUD menampilkan `n/a (no timer query)` (L2703) dan `PF.gpu` tidak pernah terisi.

---

## 10. (Kecil) Teks diag WebGPU basi setelah resize

L2814 hanya memperbarui `#src` kalau `GL_OK`. Di mode WebGPU, ukuran di teks `#src` diambil sekali dari `initWebGPU().then(...)` (L2800); setelah resize, teks tidak diperbarui. `diagText()` sendiri sudah membaca nilai baru, jadi ini hanya soal kapan dipanggil.

---

## Yang sudah 1:1 (tidak perlu diubah)

Bagian ini hasil pembacaan baris per baris, bukan asumsi.

**Layout uniform** — offset byte dan isi `Float32Array` cocok untuk semua blok:

| Blok | Ukuran WGSL | `minBindingSize` | Float yang ditulis | Cocok |
|------|-------------|------------------|--------------------|-------|
| `DownUniforms` | 16 | 16 | 4 (L2318) | ya |
| `BlurUniforms` | 128 (25 bobot + padding di `array<vec4f,7>`) | 128 | 32 (L2319), bobot di `4+i` | ya |
| `VBlurUniforms` | 48 | 48 | 12 (L2320) | ya |
| `ComposeUniforms` | 32 | 32 | 12 (L2321) | ya |
| `GlassUniforms` | 176 | 176, stride 256 | 44 (L2263) | ya |
| `QuadUniforms` | 64 | 64 | 16 (L2304) | ya |

**Matematika shader** — identik dengan GLSL:
- `fs_down`: matriks saturasi GLSL ≡ `mix(gray, c, sat)` dengan bobot 0.213/0.715/0.072.
- `fs_blur`: bobot `exp(-f²/2σ²)`, `lim = ceil(3σ)`, `stp = max(1, lim/24)`, 25 tap.
- `fs_vblur`: `eio` (CubicBezier .42/0/.58/1, 6 iterasi Newton) sama; 36 tap, `stp = max(1, lim/36)`, `lim = 3.2σ`, sigma ikut easing `24dp` di tepi atas.
- `fs_compose`: `foot` (0.6–1.0), dither ±0.5/255, scrim kubik `s³`, `scrimH = FLOOR + 254`.
- `fs_glass`: `circleMap`, `gradSd`, `nrm`, `sdRR`, `boxShadow`/`rbX`/`erfa`/`gauss`, 7-tap kroma dengan bobot 1/3.5 dan 1/7, `di = chroma·(cc.x·cc.y)/(hs.x·hs.y)` (atau `chroma·0.5` untuk pill), highlight 45°, `edge·0.10`, output `vec4(rgb·a, a+shA)·clipMask`.
- `fs_quad`: 8 arah × 2 radius, dibagi 17.

**Nilai uniform** — `tint`, `shadow`, `refH`, `refA`, `chroma`, `depth`, `pillDepth`, `margin`, `zoom`, `hl`, `op`, `fill`, `tabRect`, `touch`, `gn`, `hlInner` dikirim dengan nilai yang sama persis dari `surf()`/`drawGlassItem`.

**Alur pass** — urutan identik: blit → thumb glass → 5 permukaan (`back`, `tabs`, `search`, `acc`, `menu`) → pil flat → snapshot `compTex` → glyph quad → pil glass; plus urutan `down → blur H → blur V` per strip. Blend `one / one-minus-src-alpha` untuk glass, dan `src-alpha / one-minus-src-alpha` untuk quad glyph (karena teksturnya straight-alpha, lihat #2).

**Geometri & strip**:
- `dk = max(0, (cw/bw − 1)/2)` (spasi tap down-sample), `sig = (frost ? FROST_BLUR : P.blur)·(bw/W)`, `24·(bw/W)` untuk strip atas.
- `reach = 3·sig·(H/bh) + 2`, `topEnd = menu.y + menu.h + 72`, `botStart = min(acc/tabs/tab/search.y, tabs.y − PILL_GROW) − 72`, pemisahan strip kalau `botStart > topEnd + 2·reach`.
- `bw/bh` dari `P.res` (atau `FROST_SCALE`), `lowScaleGPU` reset saat alokasi.
- Peta CSS → NDC (`p.x/view·2 − 1`, `1 − p.y/view·2`) sama dengan GLSL.

**Orientasi gambar** — keduanya berakhir sebagai citra top-down: `finalTex` WebGL baris 0 = atas halaman (karena FBO bottom-origin + blit `u_flip=1`), `finalTex` WebGPU baris 0 = atas layar. Sampling glass `uv = css/view` benar di keduanya, dan scissor band (`0..topH`, `0..topH+reach`) menunjuk region yang sama. `texFlip = 0` untuk `compTex` WebGPU sudah benar (lihat #8).

**Snapshot `compTex`** — region `[min(EX.tabs.y, L.tabs.y) − 64 − PILL_GROW, max(tab bottom) + 64 + PILL_GROW]`, dengan margin yang sama; hanya beda koordinat asal (atas vs bawah) yang sudah dikompensasi.

**Ukuran tekstur**: `sceneTex`/`finalTex`/`lowA–D` `rgba8unorm`, pipeline target `rgba8unorm`, format canvas `getPreferredCanvasFormat()` untuk pass layar — konsisten dan tidak ada mismatch format yang tersisa (semua pipeline divalidasi WGSL lewat `getCompilationInfo`, dan screenshot menampilkan konten, jadi pipeline valid).

---

## Cara verifikasi ulang

1. Ambil dua screenshot dengan Playwright, `deviceScaleFactor: 2`, `viewport 430×844`, `ST.themeMode = 1`, `P.glass = true`, satu dengan `ST.renderer = 'webgpu'` dan satu `'webgl2'`.
   **Penting**: jalur WebGL di Chrome 158 otomatis memakai HIC (`#src` = "DOM live via HTML-in-Canvas"), sedangkan WebGPU selalu memakai replica canvas. Matikan HIC dulu supaya keduanya memakai backdrop yang sama:
   ```js
   await page.addInitScript({ content: `try { delete HTMLCanvasElement.prototype.captureElementImage; delete WebGL2RenderingContext.prototype.texElementSubImage2D; } catch (e) {}` });
   ```
   Setelah itu `#src` harus berbunyi "Canvas replika (HTML-in-Canvas tidak aktif…)" di kedua sisi.
2. Bandingkan kedua PNG piksel per piksel. Hasil yang terukur 18 Nov 2026 setelah #1 dan #2 diperbaiki: rata-rata 0.0010/765, maksimum 6, **0 piksel beda >8**, 747 dari 1.451.680 piksel beda sama sekali. Kalau ada selisih besar lagi, periksa `lowA`/`lowB` dengan readback yang sudah ada di `debug-textures.mjs`.
3. Ulangi untuk halaman Appearance dengan pil glass terangkat dan thumb switch/slider kelihatan: `?debug`, lalu
   ```js
   __api.ST.renderer = 'auto';            // label segmen sama di kedua capture
   __api.openPage('cat:APPEARANCE');
   __api.P.speed = 0;                     // bekukan animasi supaya deterministik
   Object.assign(__api.pill, { isFlat: false, lifted: true, handover: 0, lp: 1, lpv: 0, lx: 1, lxv: 0, ly: 1, lyv: 0, travelActive: false, dragging: false, squash: 0, deviation: 0 });
   __api.startLoop();
   ```
   Ini menguji jalur yang tidak aktif di halaman Library: `compTex` + lensa pil + `tx_tab`, dan thumb di atas `finalTex`.
4. Cek blur arah secara visual: taruh konten bergaris vertikal di belakang bar bawah, set `P.blur = 20`; garis harus melebur ke samping. Kalau tidak, #1 balik lagi.
5. Uji device loss: paksa `dev.destroy()` dan pastikan jatuh ke WebGL2, bukan layar kosong (#4).
6. Regression cepat: buka `…html?test` di ketiga renderer; console harus "test ok (slider + renderer)".

---

## Belum diperiksa / batasan

- Tidak ada uji beban (frame time) — audit ini hanya paritas hasil.
- Tidak memeriksa jalur HIC di WebGL secara mendalam (hanya dipakai sebagai pembanding).
- Tidak memeriksa `wgpu-diag.html` dan script debug lain (`debug-*.mjs`, `trace-*.mjs`) kecuali untuk mengambil bukti; isinya tidak memengaruhi halaman.
- Tidak menguji GPU non-Chromium (Safari/Firefox WebGPU). Offset dinamis `k·256` (L2300) aman: spesifikasi menjamin `minUniformBufferOffsetAlignment` ≤ 256 dan selalu pangkat dua, jadi kelipatan 256 selalu valid. Yang belum diuji hanyalah perilaku driver di luar Chrome.

**Kesimpulan**: matematika shader dan layout uniform sudah 1:1. Dua selisih nyata — (1) uniform yang ditulis ganda per frame sehingga blur kehilangan satu sumbu, dan (2) tekstur glyph straight-alpha dipakai oleh shader premultiplied — sudah diperbaiki dan diukur: kedua renderer sekarang identik sampai pembulatan 8-bit (maks 6/765, 0 piksel >8) di halaman Library maupun halaman Appearance dengan pil glass dan thumb. Sisa temuan (3–10) bukan soal perhitungan: HIC yang belum ada di WebGPU, self-check yang belum ada, batas 32 item, dan kode debug yang masih ikut terkirim.
