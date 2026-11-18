# Audit Liquid Glass: 8 Perbaikan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delapan perbaikan hasil audit pada kit navigasi iOS (animasi pil sesuai
video Apple, switch/slider, label, menu titik tiga, kartu hilang, kecepatan
animasi untuk audit).

**Architecture:** Satu berkas `liquid-glass-ios-kit-v2.html` berisi HTML + CSS +
satu IIFE besar. Semua perubahan menyentuh berkas itu saja. Verifikasi memakai
`node` (parse check) dan Firefox headless (`--screenshot`) dengan probe yang
memaksa state lewat `window.__api` (hanya ada saat URL `?debug`).

**Tech Stack:** HTML/CSS/JS tunggal, WebGL2 + canvas 2D fallback, tanpa build
step, tanpa framework tes.

**Spec:** `docs/superpowers/specs/2026-11-17-audit-liquid-glass-design.md`

## Global Constraints

- Satu berkas: `liquid-glass-ios-kit-v2.html`; tidak ada dependensi baru.
- Repo TIDAK berada di git: langkah commit tidak berlaku; ganti dengan
  verifikasi akhir (parse check + probe) di tiap task.
- Nilai tetap dari spec: kecepatan `P.speed` default 1 (rentang 0,05–1);
  `tA = t/0.6`, `tAy = (t-0.7)/0.3`, `tT = 1-(1-t)^3`; travel switch `22+20t`;
  `fw = min(w, tx+20-x0)`; tahan slider 220ms, slop batal 6px; tahan menu
  350ms; prim `art` diberi `h: size`.
- Dua item haptic (getar saat mati; kekuatan/jenis) TIDAK disentuh.
- Label teks yang ditambah pengguna ditulis dalam bahasa Indonesia mengikuti
  label panel yang ada.

## Alat verifikasi (dipakai semua task)

Parse check (wajib setelah tiap task):

```bash
node -e 'const s=require("fs").readFileSync("liquid-glass-ios-kit-v2.html","utf8");
const src=s.slice(s.indexOf("<script>")+8, s.lastIndexOf("<\/script>"));
new Function(src); console.log("parse OK")'
```

Probe screenshot (untuk task visual):

```bash
D=/private/var/folders/bv/dhhy_wrd0ll8420gvyrmc2zm0000gn/T/opencode/lg
cp "liquid-glass-ios-kit-v2.html" $D/p.html
cat >> $D/p.html <<'EOF'
<script>(() => { const a = window.__api; if (!a) return;
  /* state yang dipaksa, contoh: */ a.openPage('settings'); a.openPage('cat:APPEARANCE');
  const keep = () => { a.startLoop(); requestAnimationFrame(keep); }; keep();   // kunci loop supaya screenshot selalu setelah 1 frame
})();</script>
EOF
"/Applications/Firefox.app/Contents/MacOS/firefox" -no-remote -headless \
  -profile "$D/ffprof" --window-size=1440,1500 --screenshot "$D/p.png" \
  "file://$D/p.html?debug" >/dev/null 2>&1
```

Catatan: profil `$D/ffprof` sudah dibuat; tanpa `?debug`, `window.__api`
tidak ada dan probe diam-diam tidak berlaku.

## Review Focus

1. **Kecepatan animasi tersimpan di bawah 1** → halaman terasa lambat saat
   dibuka lagi. Dipin ke Task 1: `P.speed` ada di `DEFAULTS`, tombol Reset
   `#bReset` dan "Reset to BitChord" mengembalikannya ke 1; verifikasi grep
   `speed: 1` di `DEFAULTS`.
2. **Tahan slider terlalu pendek/panjang** → melepas sebelum 220ms tidak boleh
   mengubah nilai dan tidak boleh memblokir scroll; melepas setelah aktif
   harus mengakhiri drag. Dipin ke Task 5: jalur `endDrag` membersihkan timer
   via `hold === null` dan `sdrag.press(false)`; verifikasi akhir di perangkat
   sentuh pengguna (timer tidak bisa dijalankan headless).
3. **Menu titik tiga: tap cepat vs tahan** → tap harus tetap toggle persis
   sekali (flag `heldOpen` dikonsumsi `click`), tahan 350ms harus membuka
   tanpa toggle ganda. Dipin ke Task 7: flag dibaca lalu direset di awal
   handler `click`; verifikasi di perangkat sentuh pengguna.
4. **Animasi balik (expand) pil** → saat `S.t` menurun, pil harus naik dulu
   sebelum bar melebar, tanpa frame tumpang tindih. Dipin ke Task 2: formula
   sama untuk dua arah (`tAy = 0` tepat saat `t = 0,7`) plus self-check runtime;
   verifikasi probe dengan `a.S.inline=false; a.S.t=0.4` (posisi expand).
5. **Knob switch saat ditekan di ujung** → tidak boleh lompat keluar track
   dan tidak boleh bergeser dari posisi diam saat mulai ditekan. Dipin ke
   Task 3: `fitIn()` tidak mengubah geometri diam (idle sudah di dalam batas);
   verifikasi perhitungan pada langkah task + screenshot posisi diam.

---

### Task 1: P.speed (kecepatan animasi untuk audit)

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — `DEFAULTS` (baris `const DEFAULTS`),
  `tick` (baris `const dt = Math.min(.05, ...)`), `CTRL_DEFS` (baris terakhir
  array).

**Interfaces:**
- Produces: `P.speed` (number, 0,05–1, default 1) — dipakai `tick` setiap frame;
  slider panel memakai kunci `speed` seperti kunci `res`/`blur` (sinkron
  otomatis lewat `syncCtrls`).

- [ ] **Step 1: Tambah `speed: 1` ke `DEFAULTS`**

Di `const DEFAULTS = { ... }`, sisipkan `speed: 1,` sebelum `hud: false`.

- [ ] **Step 2: Kalikan `dt` dengan `P.speed`**

Baris `const dt = Math.min(.05, (now - last) / 1000) * (DEBUG && window.__ts || 1)`
menjadi `... / 1000) * P.speed * (DEBUG && window.__ts || 1)`.

- [ ] **Step 3: Slider panel**

Tambah `['speed', 'Kecepatan animasi (× audit)', .05, 1, .05]` sebagai
elemen terakhir array `CTRL_DEFS`.

- [ ] **Step 4: Parse check**

Run: parse check (alat verifikasi). Expected: `parse OK`.

- [ ] **Step 5: Verifikasi persistensi**

Run: `grep -n "speed: 1" liquid-glass-ios-kit-v2.html`
Expected: satu baris di `DEFAULTS` (Reset mengembalikan ke 1).

---

### Task 2: Animasi pil player sesuai video Apple

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — fungsi `applyDOM` (blok `const t = S.t`
  sampai `accNext.style.marginLeft`).

**Interfaces:**
- Consumes: `EX.acc/EX.tabs/EX.search`, `IN.acc/IN.tab/IN.search`, `mix()`,
  `lerp()`, `clamp()`, `R()` — sudah ada.
- Produces: progres lokal `tA` (penyusutan pil), `tAy` (turun pil ke baris),
  `tT` (kurva bar); `acc0` hasil campuran x/w dari `tA` dan y dari `tAy`.

- [ ] **Step 1: Pisahkan progres pil dan bar di `applyDOM`**

Ganti `const acc0 = mix(EX.acc, IN.acc, t)` dan
`const tabs = mix(EX.tabs, IN.tab, t), search0 = mix(EX.search, IN.search, t)`
menjadi:

```js
const tA = clamp(t / .6, 0, 1), tAy = clamp((t - .7) / .3, 0, 1), tT = 1 - Math.pow(1 - t, 3);
const acc0 = R(lerp(EX.acc.x, IN.acc.x, tA), lerp(EX.acc.y, IN.acc.y, tAy),
               lerp(EX.acc.w, IN.acc.w, tA), lerp(EX.acc.h, IN.acc.h, tA));
const tabs = mix(EX.tabs, IN.tab, tT), search0 = mix(EX.search, IN.search, tT);
```

- [ ] **Step 2: Samakan isi dalam pil dengan `tA`**

Baris `setR(accEl, acc0)` … `fb(accNext, e)` memakai `t` untuk geometri dalam
pil (`paddingRight`, `accMeta.style.marginLeft`, `accNext.style.width`) dan
`e = clamp(1 - t * 3, 0, 1)` → ganti `t` itu dengan `tA` pada baris-baris
tersebut (variabel `t` lain di `applyDOM` yang mengatur judul/top actions
tetap `t`).

- [ ] **Step 3: Self-check runtime (sekali, warn)**

Setelah `L = { ... }` di `applyDOM`, tambah:

```js
if (!S.nav.length && t > .01 && t < .99 && !applyDOM._warned){
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  if (hit(acc, tabs) || hit(acc, search0)) { applyDOM._warned = true; console.warn('pill overlap bar', { acc, tabs, search0 }); }
}
```

(`acc` di sini = varietas hasil `scaleR` yang sudah ada di baris atas; kalau
yang dipakai `acc0`, pakai `acc0` — pilih rect mentah tanpa skala tekan.)

- [ ] **Step 4: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 5: Probe tiga posisi**

Probe A (diam, kondisi penuh): paksa `a.S.t = 0; a.S.tv = 0; a.S.inline = false;`
+ keepalive → screenshot → pill di atas, jarak 8px seperti semula.
Probe B (mid-collapse): `a.S.t = 0.75; a.S.tv = 0; a.S.inline = true;` →
screenshot → pil masih di ATAS bar, sisi kirinya melewati tepi ikon, tanpa
peringatan `pill overlap bar` di console (baca lewat `a` juga: jalankan probe
yang menulis `console.warn` ke `document.title` bila terpicu).
Probe C (mid-expand): `a.S.t = 0.4; a.S.tv = 0; a.S.inline = false;` → pil
sudah naik di atas bar.
Expected: ketiga screenshot tanpa tumpang tindih; nilai t akhir bisa sedikit
bergeser (spring) — selisih <0,05 tidak masalah.

---

### Task 3: Knob switch simetris dan tidak keluar track

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — helper `thumbGeo`, tiga situs
  `22 + 22 *` (canvas `p.k === 'sw'`, DOM `p.k === 'sw'`, loop glass `GT`),
  `switchZone` (dua rumus drag).

**Interfaces:**
- Produces: `fitIn(g, bx, by, bw, bh) -> {x,y,w,h,r}` (posisi di-clamp, ukuran
  di-cap) dipakai renderer canvas, DOM, dan glass untuk thumb switch.

- [ ] **Step 1: Tambah helper `fitIn`**

Setelah `thumbGeo`, tambah:

```js
const fitIn = (g, bx, by, bw, bh) => { const w = Math.min(g.w, bw), h = Math.min(g.h, bh);
  return { x: clamp(g.x, bx, bx + bw - w), y: clamp(g.y, by, by + bh - h), w, h, r: Math.min(w, h) / 2 }; };
```

- [ ] **Step 2: Travel `22+20t` di tiga renderer dan drag**

Ganti `22 + 22 * p.t` (canvas), `22 + 22 * p.t` (DOM), `22 + 22 * st.x` (glass)
menjadi `22 + 20 * …`; di `switchZone`: `off: px - (tx0 + 22 + 20 * g.x)` dan
`g.x = clamp((px - st.off - tx0 - 22) / 20, 0, 1)`.

- [ ] **Step 3: Bungkus thumb switch dengan `fitIn`**

- canvas: `drawThumb(c, fitIn(thumbGeo(p.x + 22 + 20 * p.t, p.y + 14, p.pr), p.x, p.y, 64, 28), p.ta)`
- DOM: `domThumb(e, fitIn(thumbGeo(...), p.x, p.y, 64, 28), p.x, p.y, p.ta)`
- glass: `const tg = fitIn(thumbGeo(cxm, cym, pr), g.tx, g.ty, 64, 28)` (variabel
  `tg` dipakai baris berikutnya tanpa diubah lagi).

- [ ] **Step 4: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 5: Verifikasi angka posisi diam**

Run:
`node -e 'const c=(v,a,b)=>Math.min(b,Math.max(a,v)); const t=0,w=40; console.log(2+ (22+20*t) - w/2, (22+20*1)+w/2-2)'`
Expected: `2 62` (inset 2px di kedua ujung pada track 64px).

- [ ] **Step 6: Probe Appearance**

Probe (buka `settings` → `cat:APPEARANCE`) → screenshot → knob posisi diam
simetris, tidak menembus tepi track.

---

### Task 4: Isi slider mentok di ujung

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — satu baris di `buildSettingsPrims`
  (`out.push({ k: 'slider', ... })`).

**Interfaces:**
- Produces: `p.fw` (lebar isi) dipakai renderer canvas (`p.fw`) dan DOM
  (`width: p.fw + 'px'`) — keduanya otomatis ikut.

- [ ] **Step 1: Ubah formula `fw`**

`fw: tx - x0` → `fw: Math.min(w, tx - x0 + 20)`.

- [ ] **Step 2: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 3: Probe nilai maksimum**

Probe: `a.openPage('settings'); a.openPage('cat:APPEARANCE'); a.P.blur = 32;`
(set sebelum `openPage` kedua agar `buildPrims` memakainya) + keepalive →
screenshot → isi baris "Blur radius (dp)" menyentuh ujung kanan track di bawah
thumb.

---

### Task 5: Slider tekan-tahan, scroll tidak tersendat

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — `sliderZone`, dan handler
  `pointerdown`/`pointermove`/`endDrag` pada `hit`.

**Interfaces:**
- Consumes: `zoneAt(e)`, `relX(e)`, `sdrag`, `pressed`, `drag`, `vel`.
- Produces: konstanta `SLIDER_HOLD_MS = 220`, `HOLD_SLOP_PX = 6` (dideklarasi
  di blok `/* ============ input ============ */`); penanda lokal `grab` di
  `sliderZone` (offset thumb–jari, tanpa lompat).

- [ ] **Step 1: Konstanta**

Tambah di awal blok input:
`const SLIDER_HOLD_MS = 220, HOLD_SLOP_PX = 6;`

- [ ] **Step 2: `sliderZone` dengan offset grab**

```js
function sliderZone(sl, g, x0, w, ry){
  const setFrom = px => { /* isi lama, tidak berubah */ };
  let grab = null;
  const thumbX = () => x0 + 20 + clamp((sl.get() - sl.min) / (sl.max - sl.min), 0, 1) * (w - 40);
  HITS.push({ y: ry + 26, h: 46, x: x0 - 10, w: w + 20,
    drag: px => { if (grab === null) grab = px - thumbX(); setFrom(px - grab); },
    press: on => { if (!on) grab = null; g.pt = on ? 1 : 0; startLoop(); },
    end: () => { grab = null; } });
}
```

- [ ] **Step 3: Tahan sebelum mengambil gesture di `hit`**

`pointerdown`: cabut cabang `if (z && z.drag){ sdrag = z; ... return; }`, ganti
dengan: mulai timer `setTimeout(SLIDER_HOLD_MS)` yang saat fired akan:
`drag = null; vel = 0; sdrag = z; z.press(true); z.drag(<px saat down>)`;
state disimpan di variabel `hold = { z, px, timer }` (deklarasikan bersama
`sdrag`). Scroll `drag` tetap dibentuk seperti biasa supaya gerak = scroll.

`pointermove`: sebelum `if (sdrag)`, tambah: bila `hold` masih aktif dan
`Math.abs(e.clientX - hold.px) > HOLD_SLOP_PX || Math.abs(e.clientY - <y down>) > HOLD_SLOP_PX`
→ `clearTimeout(hold.timer); hold = null;` (scroll dibiarkan jalan).

`endDrag`: di awal, bila `hold` → `clearTimeout(hold.timer); hold = null;`
kemudian jalur lama (`sdrag` / `pressed` / `drag`) tanpa diubah.

- [ ] **Step 4: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 5: Verifikasi jalur pelepasan (baca kode)**

Cek tiga jalur di `endDrag`: (a) lepas sebelum 220ms → `hold` dibersihkan,
`drag` masih ada → `onTap` menilai `drag.mv` seperti biasa (scroll tetap
jalan); (b) lepas setelah aktif → `sdrag.press(false)` + `sdrag.end()` memanggil
`end()` yang mereset `grab`; (c) `pointercancel` memakai `endDrag` yang sama.
Expected: ketiga jalur tanpa sisa state.

---

### Task 6: Label baris slider tidak overshoot

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — `buildSettingsPrims` (pass ukur
  `if (r.slider) h = 72;` dan pass gambar blok `if (r.slider){ ... }`), CSS
  `.row` dan `.row label`.

**Interfaces:**
- Consumes: `wrap(str, 16, maxW)` (sudah ada, ter-cache), `cx.measureText`.
- Produces: field `tOff` pada entri `L` (offset vertikal ekstra baris judul,
  kelipatan 21px) dipakai pass gambar, `sliderZone`, dan `addA11y`.

- [ ] **Step 1: Pass ukur — tinggi baris mengikuti jumlah baris judul**

Di blok ukur, ganti `else if (r.slider) h = 72;` dengan:

```js
else if (r.slider){ const tl = wrap(r.title, 16, cw - 2 * RI - 46); h = 72 + (tl.length - 1) * 21; sliderTitles.set(r.slider.key, tl); }
```

(`sliderTitles` = `Map` lokal di `buildSettingsPrims`; 46 = cadangan nilai
+ jarak.) Simpan `tOff` pada `L.push({ r, h, subLines, y })` → tambah
`tOff: (lines.length - 1) * 21` (pakai kalkulasi yang sama).

- [ ] **Step 2: Pass gambar — judul wrap, track dan zona ikut turun**

Blok `if (r.slider){ ... }`: gambar tiap baris judul dengan `text(x0, ry + 29 + j*21, 16, 400, th.fg, ln, { ls: .2 })`
dari `wrap(...)` yang sama; `tcy = ry + 54 + tOff`; `sliderZone(...)` dan
`addA11y(...)` menerima `ry + tOff` untuk kolom sentuh/ring (baris `ring`
menjadi `[x0 - 6, ry + 4 + tOff, w + 12, 64]`). Nilai kanan tetap
`ry + 29` (baris pertama).

- [ ] **Step 3: CSS panel**

`.row{display:grid;grid-template-columns:1fr auto;...}` → `minmax(0,1fr) auto`;
tambah `min-width:0` ke `.row label`.

- [ ] **Step 4: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 5: Probe dua posisi**

Probe: buka Appearance + `a.setScroll(<posisi grup Liquid Glass tuning>)`
(cari dengan menambah ±200 sampai baris "Backdrop sample resolution" terlihat)
→ screenshot → judul wrap maksimum 2 baris, tidak melewati tepi kartu, nilai
kanan tidak tertimpa, track di bawah judul.
Probe panel: window 400px + `panel.classList.add('open')` → label baris
"Backdrop sample resolution" tetap di dalam kolomnya.

---

### Task 7: Menu titik tiga — tahan, lalu seret ke item

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — `bind($('#hitMore'), ...)`,
  handler `click #hitMore`, blok `#menu .mi:active` di CSS, dan blok input
  (`#hitMore`).

**Interfaces:**
- Consumes: `haptic(10)`, `S.menuOpen`, `startLoop()`, `q('#menu .mi')`,
  `q('#menu')` (rect), `MENU_HOLD_MS = 350`.

**Callers yang berubah:** handler `click` `#hitMore` lama (toggle + delay 80ms)
dipertahankan untuk tap, ditambah flag `heldOpen`.

- [ ] **Step 1: Konstanta + haptic tidak lagi di `pointerdown`**

`const MENU_HOLD_MS = 350;` di dekat konstanta menu. Ubah
`bind($('#hitMore'), 'act', true)` → `bind($('#hitMore'), 'act')` (haptic pindah
ke momen expand, sesuai spec).

- [ ] **Step 2: State hold di atas `#hitMore`**

```js
let menuHold = null, heldOpen = false;
```

`pointerdown` pada `#hitMore`: simpan `x/y` awal, pasang `setTimeout(MENU_HOLD_MS)`
yang isinya `menuHold = null; heldOpen = true; haptic(10); S.menuOpen = true; startLoop();`,
dan pasang listener `pointermove`/`pointerup` di `document`.

- [ ] **Step 3: Gerak dan lepas**

`pointermove`: bila timer masih jalan dan gerak > 6px → batal
(`clearTimeout`, lepas listener, `menuHold = null`). Bila menu sudah terbuka →
hit-test rect tiap `#menu .mi` (`getBoundingClientRect`), toggle class `hov`
pada item yang di bawah jari (simpan `menuHold.mi`).

`pointerup`: lepas semua listener. Bila menu terbuka dari tahan:
`menuHold.mi` ada → `mi.click()` (handler `click` item menutup menu);
tanpa `mi` tapi jari di luar rect `#menu` → `S.menuOpen = false; startLoop();`;
di dalam menu → biarkan terbuka.

- [ ] **Step 4: Flag tap**

Handler `click` `#hitMore` yang ada: di awal `if (heldOpen){ heldOpen = false; return; }`
sebelum `setTimeout(...)` toggle.

- [ ] **Step 5: CSS highlight**

Tambah `#menu .mi.hov{background:rgba(127,127,127,.22)}` di samping
`#menu .mi:active`.

- [ ] **Step 6: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 7: Verifikasi jalur (baca kode) + cek perangkat**

Baca empat jalur: tap cepat (flag dikonsumsi, toggle sekali), tahan <350ms
lalu lepas (batal, klik biasa tetap jalan), tahan ≥350ms lalu lepas di luar
menu (tutup), tahan + seret ke item lalu lepas (item terpilih, menu tertutup).
Sisa verifikasi waktunya di perangkat sentuh pengguna.

---

### Task 8: Kartu konten tidak hilang di tepi atas

**Files:**
- Modify: `liquid-glass-ios-kit-v2.html` — `card()` di `buildPrims`.

**Interfaces:**
- Consumes: ekspresi culling `drawContent`:
  `p.y + (p.h || 0) + 80 < S.scrollY`.
- Produces: prim `art` dengan `h: size`.

- [ ] **Step 1: Tambah `h` ke prim art**

`out.push({ k: 'art', x, y: yy, s: size, seed, r: 10 })` (di `card()`) →
tambahkan `h: size`. (Prim `art` baris `Songs` berukuran 48px sudah aman,
tidak diubah.)

- [ ] **Step 2: Parse check**

Run: parse check. Expected: `parse OK`.

- [ ] **Step 3: Probe scroll 580**

Probe: `a.setScroll(580)` + keepalive → screenshot → kartu "Made For You"
baris pertama masih menyembul ±26px di bawah status bar (tanpa fix: hilang,
padahal labelnya belum lewat).

---

## Self-review

- Cakupan spec: 8 item = Task 1–8; dua item haptic memang di luar scope.
- Konsistensi nama: `tA/tAy/tT` dipakai di Task 2 saja; `fitIn` Task 3 saja;
  `SLIDER_HOLD_MS/HOLD_SLOP_PX` Task 5; `MENU_HOLD_MS` Task 7; `tOff` Task 6.
- Task 7 dan 5 tidak berbagi state (handler `#hitMore` vs overlay `#hit`).
- Verifikasi otomatis terbatas headless (timer tidak jalan sebelum screenshot);
  dua task interaktif (5, 7) jujur menyebut cek perangkat sentuh sebagai
  gerbang terakhir.
