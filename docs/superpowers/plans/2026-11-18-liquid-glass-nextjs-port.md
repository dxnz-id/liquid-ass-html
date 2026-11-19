# Port Liquid Glass ke Next.js + pnpm workspace: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan kit `liquid-glass-ios-kit-v2.html` (2841 baris) ke workspace
pnpm berisi `packages/glass` (engine), `packages/ui` (komponen React), dan
`apps/web` (demo Next.js), dengan paritas perilaku penuh. Sejak Task 2.5 rujukan
port adalah salinan `liquid-glass-ios-kit-v2 (5).html` (desain
`2026-11-19-renderer-sync-design.md`): renderer WebGPU/WebGL2 baru + fold `.7`.

**Architecture:** Ekstraksi bertahap, bukan rewrite. Task 1 membuktikan toolchain
di Termux. Task 2 memindahkan seluruh isi file ke Next sebagai satu modul client.
Task 2.5 menyinkronkan CSS/markup/script dengan referensi (5): paritas terhadap
(5) tercapai di sini. Task 3 memecah modul itu: engine ke `packages/glass`.
Task 4: komponen + CSS ke `packages/ui`. Task 5: perapian. Probe hijau setelah
setiap task; dua gerbang verifikasi HP setelah task 2.5 dan task 4.

**Tech Stack:** Next.js 16.4.6 (App Router, JavaScript, webpack via flag
`--webpack`), React ^19, pnpm, CSS biasa, probe CDP (chromium headless + WebSocket
raw, tanpa Playwright/Puppeteer).

**Spec:** `docs/superpowers/specs/2026-11-18-liquid-glass-nextjs-design.md`

## Global Constraints

- **Paritas di atas segalanya.** Jangan mengubah matematika motion, spring, atau
  shader. Pindahkan kode apa adanya; hanya sesuaikan impor, pembungkus modul, dan
  referensi elemen.
- **Identitas DOM tetap.** Semua `id`, `class`, `role`, `aria-*` pada elemen JSX
  wajib persis seperti file asli. Probe lama memakai selector itu sebagai kontrak.
- File sumber `liquid-glass-ios-kit-v2.html` dan `server.js` TIDAK disentuh.
  Sejak Task 2.5 rujukan port adalah salinan `liquid-glass-ios-kit-v2 (5).html`
  di repo root (nama asli dipertahankan; `dom-ids-check` membacanya).
- **Tanpa commit kecuali user menyuruh.** Tiap task diakhiri verifikasi hijau,
  bukan commit. (Repo dalam keadaan dirty: fix scrim menu belum di-commit; jangan
  menyentuhnya.)
- Toolchain: pnpm dipasang via `npm i -g pnpm` (corepack tidak ada). Semua script
  `dev`/`build` memakai `--webpack` sejak baris pertama (Turbopack menolak SWC WASM).
- `reactStrictMode: false` di `next.config.mjs` (init kit imperatif tidak
  punya pasangan cleanup; double-mount akan menggandakan listener).
- Debug hooks wajib bertahan: `?debug` → `DEBUG`, `window.__ready = true` di akhir
  boot, `window.__api` (diisi web: { buildDOM, applyDOM, S, ST, P, pill, SPR,
  openPage, popPage, HITS, setTab, setTheme, setScroll, startLoop, HIC, hicOK }),
  `?hud` → `P.hud`. Probe bergantung pada semuanya.
- `packages/glass` dilarang mengimpor React, `packages/ui`, atau `apps/web`.
  `packages/ui` boleh mengimpor `packages/glass`. `apps/web` boleh mengimpor keduanya.
- Lisensi package: `GPL-3.0-only` di `package.json` + atribusi di README
  (angka/layout/teks BitChord GPL-3.0; shader Kyant0 Apache-2.0).

## Alat verifikasi (dipakai semua task)

Probe ada di `liquid-glass-next/tools/` (dipindah di Task 1 dari
`/data/data/com.termux/files/usr/tmp/lg-chrome/`). Semua probe CDP butuh:

```sh
cd liquid-glass-next && pnpm dev    # terminal 1, biarkan jalan
sh tools/run-smoke.sh               # terminal 2, dst.
```

| Alat | Cek | Hijau = |
|---|---|---|
| `node tools/fold-check.mjs` | Geometri fold (acc vs tab row, W=320..512) | `PASS: 0 tabrakan` |
| `sh tools/run-smoke.sh` | Boot, renderer label, elemen fallback, error console | `READY true` + DIAG = baseline + `ERRORS []` |
| `sh tools/run-menu-probe.sh` | Menu: buka, klik luar nutup, klik item nutup | `RESULT PASS` + `ERRORS []` |
| `sh tools/run-fold-probe.sh` | Fold: expand tanpa dead frame | `max dead-frame berturut = 0` |
| `sh tools/run-probe-acc.sh` | Aksesori: play/next klik, tab a11y | `AFTER_PLAY` toggle, `AFTER_NEXT_TITLE` ganti, `AFTER_TAB tab:0` |
| `node tools/dom-ids-check.mjs` | Id statis file asli ⊆ SSR Next | `hilang: []` |
| `pnpm build` | Gerbang sintaks + impor lintas package | exit 0 |

Catatan: `run-probe-acc.sh` dan `run-fold-probe.sh` sama-sama pakai port CDP
9463; jangan dijalankan bersamaan. Probe berjalan dengan `--disable-webgl`
(jalur fallback Canvas2D), sama seperti baseline; jalur WebGPU/WebGL2 diverifikasi
di HP (gerbang task 2 dan 4).

**Baseline:** di akhir Task 1, simpan keluaran keempat probe terhadap FILE ASLI ke
`tools/baseline/*.txt`. Task 2 dan seterusnya wajib menghasilkan keluaran yang sama
(bagian yang bergantung URL boleh beda).

## Fokus risiko

1. **SWC WASM di Termux belum terbukti.** Task 1 spike adalah gerbangnya. Kalau
   `pnpm dev --webpack`/`pnpm build --webpack` gagal memuat SWC, STOP dan eskalasi
   ke user (opsi: Next 15 atau proot) sebelum lanjut. Jangan menambah dependensi
   untuk memaksa jalan.
2. **Konversi JSX kehilangan sesuatu.** Aturan konversi dipin di Task 2 step 3;
   `dom-ids-check` + diff DIAG baseline menangkap kehilangan id/atribut.
3. **Urutan dalam `tick` berubah saat dipecah.** `tick` (L2670-2720) bercampur:
  physics kit (vel, spring fold/press/menu/GS/icon, pill, applyDOM) dan engine
  (spring touch, render, selfCheck, HUD). Interface `onFrame` di Task 3 mempertahankan
  urutan persis; verifikasi dengan fold-probe + menu-probe + smoke.
4. **Pemisahan CSS salah pemilik.** Aturan per Task 4 step 2; elemen buatan engine
  (`#gl`, `#fallbackCv`, `#page`, `#pageInner`) kecuali dari CSS → inline style.
5. **Bagian input sengaja TIDAK masuk `packages/ui`.** Blob gesture (drag, hold,
  scroll, `HITS`) menangani konten web dan kit sekaligus; tetap di `apps/web`
   (Task 4). Ini interpretasi desain: daftar isi `liquid-glass-ui` di spec tidak
   menyebut input.

---

### Task 1: Spike workspace pnpm + pindah probe

**Files:**
- Create: `liquid-glass-next/pnpm-workspace.yaml`, `liquid-glass-next/package.json`
- Create: `liquid-glass-next/apps/web/{package.json,next.config.mjs,app/layout.js,app/page.js,app/globals.css}`
- Create: `liquid-glass-next/packages/glass/package.json` + `src/index.js` (stub)
- Create: `liquid-glass-next/packages/ui/package.json` + `src/index.js` (stub)
- Create: `.gitignore` (repo root, belum ada)
- Copy: 9 file probe dari `/data/data/com.termux/files/usr/tmp/lg-chrome/`
  (`fold-check.mjs`, `fold-probe.mjs`, `menu-probe.mjs`, `smoke.mjs`,
  `probe-acc.mjs`, `run-fold-probe.sh`, `run-menu-probe.sh`, `run-smoke.sh`,
  `run-probe-acc.sh`) → `liquid-glass-next/tools/`
- Modify: `run-*.sh` (path `D`), `*.mjs` (path keluaran)

**Interfaces:**
- Produces: struktur workspace persis seperti spek Keputusan 2; `next dev --webpack`
  dan `next build --webpack` terbukti jalan di mesin ini.

- [ ] **Step 1: Pindah probe dulu (risiko tmp dibersihkan)**

  Salin 9 file di atas ke `liquid-glass-next/tools/`. Jangan edit isinya dulu
  selain Step 2.

- [ ] **Step 2: Adaptasi path di skrip (target file:// DIPERTAHANKAN)**

  Di tiap `run-*.sh`: ganti `D=/data/data/.../lg-chrome` menjadi
  `D=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)`; tambah `mkdir -p $D/out`;
  arahkan log chromium ke `$D/out/`. URL `file:///storage/emulated/0/Download/liquid-ass-html/liquid-glass-ios-kit-v2.html?debug`
  tetap. Di tiap `*.mjs`: ganti path tulis keluaran absolut
  (`/data/data/.../lg-chrome/*.png`, `fold-samples.json`) menjadi
  `<tools>/out/...` berbasis `import.meta.url`.

- [ ] **Step 3: Baseline keluaran probe**

  Jalankan keempat probe (`run-smoke.sh`, `run-menu-probe.sh`,
  `run-fold-probe.sh`, `run-probe-acc.sh`) dari lokasi baru terhadap file asli.
  Simpan keluarannya: `sh tools/run-smoke.sh > tools/baseline/smoke.txt 2>&1`
  (dst; buat folder `tools/baseline/`). Semua wajib lolos seperti sebelum pindah.

- [ ] **Step 4: Scaffold workspace**

  `pnpm-workspace.yaml`:

  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```

  `liquid-glass-next/package.json` (root, private; memetakan ke app + probe):

  ```json
  {
    "name": "liquid-glass-next",
    "private": true,
    "scripts": {
      "dev": "pnpm --filter web dev",
      "build": "pnpm --filter web build",
      "start": "pnpm --filter web start",
      "check:fold": "node tools/fold-check.mjs",
      "probe:smoke": "sh tools/run-smoke.sh",
      "probe:menu": "sh tools/run-menu-probe.sh",
      "probe:fold": "sh tools/run-fold-probe.sh",
      "probe:acc": "sh tools/run-probe-acc.sh"
    }
  }
  ```

  `apps/web/package.json`:

  ```json
  {
    "name": "web",
    "private": true,
    "scripts": {
      "dev": "next dev --webpack",
      "build": "next build --webpack",
      "start": "next start"
    },
    "dependencies": {
      "next": "16.4.6",
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  }
  ```

  `apps/web/next.config.mjs`:

  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = { reactStrictMode: false };
  export default nextConfig;
  ```

  `apps/web/app/layout.js`:

  ```jsx
  export const metadata = { title: 'Liquid Glass — iOS Navigation Kit v2' };
  export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
  export default function RootLayout({ children }) {
    return <html lang="id"><body>{children}</body></html>;
  }
  ```

  (Judul memakai tanda yang sama dengan file asli; jangan "memperbaiki" teks
  yang sudah ada.)

  `apps/web/app/page.js`: `export default function Page(){ return <main/>; }`
  (diganti di Task 2). `apps/web/app/globals.css`: kosong dulu.

  Stub package: `packages/glass/package.json` =
  `{ "name": "liquid-glass", "version": "0.1.0", "private": true, "type": "module",
  "license": "GPL-3.0-only", "main": "src/index.js" }` + `src/index.js` berisi
  `export {};`. `packages/ui/package.json` sama dengan `"name": "liquid-glass-ui"`.

  `.gitignore` di root repo:

  ```
  node_modules/
  .next/
  liquid-glass-next/tools/out/
  ```

- [ ] **Step 5: Install pnpm + dependensi**

  `npm i -g pnpm` lalu `pnpm --version`. Di `liquid-glass-next/`: `pnpm install`.
  Kalau install gagal pada `sharp` (optional native), ulangi dengan
  `pnpm install --no-optional` (SWC WASM diunduh Next saat runtime, bukan lewat
  optional dependency). Catat jalur yang dipakai.

- [ ] **Step 6: Buktikan Next jalan (SPIKE GATE)**

  ```sh
  cd liquid-glass-next && pnpm dev    # background
  # tunggu, lalu:
  curl -sf -o /dev/null http://localhost:3000 && echo DEV-OK
  pnpm build                          # harus exit 0
  ```

  Expected: `DEV-OK`, build lolos, log dev TIDAK memuat `Failed to load SWC`
  (wajib terlihat kompilasi sukses; kalau ada wasm fallback notice, itu normal).
  **Kalau gagal: STOP, eskalasi ke user** dengan pesan log lengkap (opsi Next 15 /
  proot adalah keputusan user, bukan implementor). Matikan dev server.

- [ ] **Step 7: Verifikasi fold standalone**

  Run: `node liquid-glass-next/tools/fold-check.mjs`
  Expected: `PASS: 0 tabrakan acc vs tab row (W=320..512, t=0..1)`.

---

### Task 2: Port penuh ke apps/web (satu modul client)

**Files:**
- Create: `apps/web/app/globals.css` (isi `<style>` file asli, verbatim)
- Create: `apps/web/components/Kit.jsx` (body HTML sebagai JSX + mount initKit)
- Create: `apps/web/lib/kit.js` (seluruh isi `<script>` sebagai `export function initKit()`)
- Modify: `apps/web/app/page.js` (render `<Kit/>`), `next.config` (sudah benar)
- Modify: `tools/run-*.sh` + 3 probe `.mjs` (target `http://localhost:3000/?debug`)
- Create: `tools/dom-ids-check.mjs`

**Interfaces:**
- Produces: `initKit()` (dipanggil TEPAT SATU KALI setelah JSX ter-mount); seluruh
  kode lama berjalan di dalamnya (termasuk `window.__ready` dan `window.__api`
  di akhir). Tidak ada perubahan logika di dalam.

- [ ] **Step 1: CSS verbatim**

  ```sh
  sed -n '/<style>/,/<\/style>/p' ../../liquid-glass-ios-kit-v2.html | sed '1d;$d' > app/globals.css
  diff <(sed -n '/<style>/,/<\/style>/p' ../../liquid-glass-ios-kit-v2.html | sed '1d;$d') app/globals.css && echo CSS-VERBATIM
  ```

  Expected: `CSS-VERBATIM`. `layout.js` mengimpor `./globals.css`.

- [ ] **Step 2: Kit.jsx dari body (L608-712)**

  Salin struktur `<body>` apa adanya sebagai JSX pada `components/Kit.jsx`
  (`'use client'` di baris pertama). Aturan konversi, tidak ada yang lain:

  - `class=` → `className=`; `for=` → `htmlFor=`
  - `layoutsubtree` dan `drawable` → `layoutsubtree=""` dan `drawable=""`
    (nilai kosong, persis seperti serialisasi HTML asli; jangan memakai shorthand
    boolean yang menghasilkan `"true"`)
  - Atribut SVG `stroke-width` dsb. → camelCase (`strokeWidth`); `viewBox`,
    `opacity`, `rx` tetap
  - Komentar HTML → buang; `&amp;` → `&` di teks
  - Akar tunggal: bungkus `<>...</>` (isinya: `#phone` lalu `#gear` lalu `#panel`,
    urutan seperti asli; urutan menentukan tumpukan z)
  - Semua `id`, `data-i`, `role`, `aria-*`, isi teks panel: identik

  Mount kit:

  ```jsx
  'use client';
  import { useEffect, useRef } from 'react';
  import { initKit } from '../lib/kit';

  export default function Kit() {
    const started = useRef(false);
    useEffect(() => {
      if (started.current) return;
      started.current = true;
      initKit();
    }, []);
    return ( /* JSX body */ );
  }
  ```

  Guard `started` mencegah double-init walau efek berjalan dua kali.

- [ ] **Step 3: lib/kit.js dari seluruh `<script>`**

  Ambil isi antara `<script>` (L714) dan `</script>` (L2838): buang baris
  `(() => {` (L715) dan `})();` penutup IIFE di akhir; sisanya (mulai
  `'use strict';` L716, termasuk `window.__ready = true`) dibungkus:

  ```js
  export function initKit() {
    'use strict';
    // ...seluruh isi verbatim, tanpa edit lain...
  }
  ```

  Tidak ada perubahan lain. Kode top-level (`const phone = $('#phone')` dsb.)
  kini berjalan saat `initKit()` dipanggil, yaitu setelah DOM ada.

- [ ] **Step 4: page.js**

  `export default function Page(){ return <Kit/>; }`.

- [ ] **Step 5: Retarget probe ke Next**

  - `run-*.sh`: URL → `http://localhost:3000/?debug`. Tambah sebelum meluncurkan
    chromium: tunggu server lalu pre-warm (kompilasi on-demand Next):

    ```sh
    for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000/ && break; sleep 1; done
    curl -sf -o /dev/null 'http://localhost:3000/?debug'; sleep 2
    ```

    Chromium tetap dibuka oleh run script (dev server harus sudah jalan di
    terminal lain, lihat Alat verifikasi).
  - `smoke.mjs`, `menu-probe.mjs`, `fold-probe.mjs`: ganti filter target
    `t.url.startsWith('file:')` → `t.url.startsWith('http://localhost:3000')`
    (dua tempat: loop tunggu dan `find`). `probe-acc.mjs` sudah memakai
    `startsWith('http')`; kencangkan juga ke `http://localhost:3000` supaya tidak
    salah sasaran.

- [ ] **Step 6: Tulis + jalankan dom-ids-check**

  `tools/dom-ids-check.mjs`:

  ```js
  import fs from 'node:fs';
  const src = fs.readFileSync(new URL('../../liquid-glass-ios-kit-v2.html', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('<body>'), src.indexOf('<script>'));
  const want = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const page = await (await fetch('http://localhost:3000/')).text();
  const have = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const missing = [...want].filter(id => !have.has(id));
  console.log('asli:', want.size, '| SSR:', have.size, '| hilang:', JSON.stringify(missing));
  process.exit(missing.length ? 1 : 0);
  ```

  Run dengan dev server hidup. Expected: `hilang: []`. (Id yang dibuat runtime
  seperti `#fallbackCv`/`#tabsFb` tidak ada di kedua sisi statis, jadi tidak
  ikut dibandingkan; keberadaannya dicek lewat DIAG probe.)

- [ ] **Step 7: Probe penuh vs baseline**

  Jalankan keempat probe. Expected: lolos + output sama dengan
  `tools/baseline/*.txt` (kecuali bagian yang menampilkan URL). Khusus smoke:
  bandingkan `DIAG` baris per baris dengan baseline. Selisih apa pun = hentikan,
  telusuri sebelum lanjut.

- [ ] **Step 8: Build hijau**

  `pnpm build` exit 0.

- [ ] **Step 9: GATE 1 (verifikasi HP user, MENGHENTIKAN task berikutnya)**

  Jalankan SETELAH Task 2.5 (urutan eksekusi: Task 2 → 2.5 → GATE 1 → Task 3);
  yang diverifikasi adalah build hasil sinkronisasi referensi (5). Sampaikan ke
  user untuk cek di HP (`http://localhost:3000`):
  - scroll collapse ambang 50dp + fold naik [0,55..1] / melebar [0..0,7]
  - tahan menu 350ms + seret pilih item; klik luar / Escape / klik item menutup
  - fill lensa konstan; tekanan spring; panel gear + Settings sinkron
  - pemilih renderer: auto → WebGL2 → Canvas 2D; WebGPU dari `localhost` (HP)
  - a11y (tablist/region/aria) dan persist localStorage (reload bertahan)

  Task 3 tidak dimulai sebelum user menyatakan lolos.

---

### Task 2.5: Sinkronisasi ke referensi `liquid-glass-ios-kit-v2 (5).html`

Keputusan user (desain `docs/superpowers/specs/2026-11-19-renderer-sync-design.md`):
port mengikuti file (5) sepenuhnya: CSS, markup, dan script, termasuk renderer
WebGPU/WebGL2 baru dan jendela fold `.7`.

**Files:**
- Create: `liquid-glass-ios-kit-v2 (5).html` (salinan verbatim dari Download, di repo root)
- Modify: `apps/web/app/globals.css`, `apps/web/components/Kit.jsx`, `apps/web/lib/kit.js`
- Modify: `tools/dom-ids-check.mjs` (path sumber → salinan (5))
- Modify: `tools/baseline/*.txt` (kunci ulang; baseline lama disimpan sebagai `*.pre5.txt`)
- Tidak disentuh: file sumber lama, `server.js`, isi probe, manifest package

**Interfaces:**
- Kontrak `initKit()` tidak berubah. Isi tiga artefak = (5) verbatim (modulo
  aturan konversi JSX yang sama dengan Task 2).
- `kit.js` kini memuat baris (5) apa adanya: `baris_kit.js = baris_(5) − 178`
  (konten mulai `'use strict';` L180 tanpa IIFE). Peta baris Task 3 memakai
  nomor (5).
- Baseline baru = pembanding objektif untuk Task 3 ke atas.

Semua perintah di bawah dijalankan dari repo root kecuali Step 7 (dari
`liquid-glass-next/`); dev server (`pnpm dev`) hidup untuk Step 5-7.

- [ ] **Step 1: Salin referensi ke repo root**

  ```sh
  cp "/storage/emulated/0/Download/liquid-glass-ios-kit-v2 (5).html" "./liquid-glass-ios-kit-v2 (5).html"
  cmp "/storage/emulated/0/Download/liquid-glass-ios-kit-v2 (5).html" "./liquid-glass-ios-kit-v2 (5).html" && echo REF-SALIN
  ```

  Expected: `REF-SALIN`. (File Download berisiko dibersihkan, pelajaran Task 1;
  nama asli dipertahankan, tanpa penamaan ulang.)

- [ ] **Step 2: globals.css verbatim**

  ```sh
  sed -n '/<style>/,/<\/style>/p' 'liquid-glass-ios-kit-v2 (5).html' | sed '1d;$d' > liquid-glass-next/apps/web/app/globals.css
  diff <(sed -n '/<style>/,/<\/style>/p' 'liquid-glass-ios-kit-v2 (5).html' | sed '1d;$d') liquid-glass-next/apps/web/app/globals.css && echo CSS-VERBATIM
  ```

  Expected: `CSS-VERBATIM`. Perubahan yang diharapkan dari globals.css lama:
  aturan `#wgpu-dbg` hilang; `#gl,#fallbackCv,#gpuCv` jadi `#gl` dan
  `#fallbackCv` terpisah.

- [ ] **Step 3: kit.js dari seluruh `<script>` (5)**

  Region (5): `<script>` L178 … `</script>` L1546; buang baris IIFE `(() => {`
  (L179) dan `})();` (L1545). Sisanya L180 (`'use strict';`) … L1544
  (`window.__ready = true;`) dibungkus TEPAT seperti Task 2 Step 3; isi di
  kolom 0, tanpa indentasi ulang, tanpa edit satu pun baris:

  ```js
  export function initKit() {
  …isi L180-1544 verbatim…
  }
  ```

  Periksa (dari repo root):

  ```sh
  diff <(sed -n '180,1544p' 'liquid-glass-ios-kit-v2 (5).html') <(tail -n +2 liquid-glass-next/apps/web/lib/kit.js | head -n -1) && echo KIT-VERBATIM
  ```

  Expected: `KIT-VERBATIM`. Termasuk di dalam, tanpa perubahan: `const RURL`
  (param `?renderer=`), blok DEBUG `__shot`/`?test`, dan seluruh teks literal.

- [ ] **Step 4: Kit.jsx dari markup (5) L114-176**

  Ganti isi JSX body `Kit.jsx` dengan region `<body>` (L113) sampai tepat
  sebelum `<script>` (L178), yaitu L114-176, memakai aturan konversi Task 2
  Step 2 TANPA perubahan lain: `className`/`htmlFor`, `layoutsubtree=""` dan
  `drawable=""`, atribut SVG camelCase, komentar dibuang, `&amp;`→`&`, akar
  tunggal `<>…</>` berurutan `#phone` lalu `#gear` lalu `#panel`. Kerangka
  `Kit.jsx` (guard `started`, `useEffect`) tetap. Beda isi dari Kit.jsx lama:
  enam potong teks bantuan renderer dan label opsi `<select>` WebGPU kini
  `WebGPU` (bukan `WebGPU (Pipeline WGSL penuh)`).

- [ ] **Step 5: dom-ids-check membaca salinan (5)**

  Di `tools/dom-ids-check.mjs` ganti path sumber jadi
  `'../../liquid-glass-ios-kit-v2 (5).html'` (spasi dan kurung aman: `new URL`
  meng-encode, `readFileSync` file-URL mendeode). Dengan dev server hidup:

  ```sh
  node liquid-glass-next/tools/dom-ids-check.mjs
  ```

  Expected: `hilang: []`. Region `<body>`..`<script>` (5) berisi 32 id;
  himpunan identik dengan file lama, jadi hasilnya tidak berubah.

- [ ] **Step 6: Build + literal fold**

  `pnpm build` exit 0. Lalu:

  ```sh
  grep -n 't / .7' liquid-glass-next/apps/web/lib/kit.js
  node liquid-glass-next/tools/fold-check.mjs
  ```

  Expected: tepat satu hit di `applyDOM` (`clamp(t / .7, 0, 1)`), dan
  fold-check `PASS` (jendela fold-check `.7` kini memang cocok dengan
  referensi).

- [ ] **Step 7: Probe, evaluasi tiap delta, lalu kunci ulang baseline**

  Dari `liquid-glass-next/`, dengan dev server hidup, jalankan berurutan
  (fold dan acc berbagi port 9463; jangan bersamaan):

  ```sh
  sh tools/run-smoke.sh > tools/baseline/smoke.new.txt 2>&1
  sh tools/run-menu-probe.sh > tools/baseline/menu.new.txt 2>&1
  sh tools/run-fold-probe.sh > tools/baseline/fold.new.txt 2>&1
  sh tools/run-probe-acc.sh > tools/baseline/acc.new.txt 2>&1
  diff tools/baseline/smoke.txt tools/baseline/smoke.new.txt   # ulangi utk menu, fold, acc
  ```

  Evaluasi WAJIB tiap selisih sebelum mengunci:
  - Baris `DIAG` (smoke): pasti berbeda: format `diagText` (5) baru; sebutkan
    perubahannya di laporan.
  - Angka fold: jendela `.7` boleh mengubah keluaran; syarat lolos tetap
    `0 dead frame` (lihat Alat verifikasi).
  - Selisih lain wajib bisa dijelaskan perubahannya; yang tak bisa dijelaskan =
    STOP, jangan kunci ulang, lapor.
  Kalau semua terjelaskan, kunci ulang keempatnya:
  `mv tools/baseline/X.txt tools/baseline/X.pre5.txt` lalu
  `mv tools/baseline/X.new.txt tools/baseline/X.txt`. Baseline lama TIDAK
  dihapus.

- [ ] **Step 8: Laporan**

  Hasil setiap check (`REF-SALIN`, `CSS-VERBATIM`, `KIT-VERBATIM`,
  `hilang: []`, build, fold-check, keempat probe), daftar delta baseline
  beserta alasannya, dan konfirmasi literal fold `t / .7`.

---

### Task 3: Ekstrakt engine ke packages/glass

**Files:**
- Create: `packages/glass/src/{util,params,state,icons,shaders-gl,shaders-wgsl,renderer-gl,renderer-gpu,hic,engine,index}.js`
  (daftar isi per file di bawah)
- Modify: `apps/web/lib/kit.js` → berkurang drastis (kini hanya kit: content,
  layout, applyDOM, input, panel); mengimpor dari `liquid-glass`
- Modify: `apps/web/next.config.mjs` → `transpilePackages: ['liquid-glass']`
- Modify: `apps/web/package.json` → `"liquid-glass": "workspace:*"`

**Peta modul (sumber → tujuan).** Anchor utama adalah nama fungsi; baris sebagai
panduan. Ambil potongan VERBATIM; sesuaikan hanya impor/ekspor dan referensi ke
state lewat parameter yang sudah dipin.

Catatan Task 2.5: baris renderer di bawah (mulai `pickRenderer`) sudah memakai
nama dan nomor baris file (5). Baris non-renderer masih nomor `kit.js` format
lama; setelah sinkronisasi semua baris bergeser (`baris_kit.js = baris_(5) − 178`);
cari dengan nama fungsi (isinya identik). Berlaku juga untuk paragraf
"Sisa `kit.js`" di bawah tabel.

| Sumber (baris) | Isi | Tujuan |
|---|---|---|
| 717-723 | `$`, `clamp`, `lerp`, `sgn`, `DPR`, `FONT` | `util.js` |
| 1388, 1404, 1489 | `R`, `mix`, `scaleR` (geometri dipakai render dan kit) | `util.js` |
| 726-730, 904 | `DEFAULTS`, `LENS_MAX/SCALE/FROST_*`, `ST` + `createParams(saved) -> {P, ST}` (baca `SAVE_KEY`/`localStorage` dari parameter `saved`, bukan langsung) | `params.js` |
| 738-739 | `S`, `SPR` (objek mutable diekspor; `notify` store dipanggil engine tiap tick) | `state.js` |
| 741-747 | `PF`, `TQ`, `gpuBegin/gpuEnd` (HUD timer) | `engine.js` |
| 755-793 | `IC`, `svg()` | `icons.js` (leaf; dipakai kit, web, fallback) |
| (5) 531-537 | `RURL`, `pickRenderer`, state GL (`progBlit` ... `lowScale`) | `engine.js` / `renderer-gl.js` |
| (5) 538-689 | Shader GLSL (`VS_FULL` ... `FS_*`) | `shaders-gl.js` |
| (5) 690-763 | `compile`, `mk`, `U`, `tex`, `fbo`, `initGL`, `allocGL`, `composePass`, `lowStrips`, `ensureLow`, `blurWeights`, `blurUniforms`, `pass` | `renderer-gl.js` |
| (5) 764-784 | `detectHIC`, `hicUpload` | `hic.js` |
| (5) 859-892 | state atlas (`glyphDirty` dsb.), `colors()`, `drawGlyphs` | `renderer-gl.js` / `util.js` |
| (5) 938-1040 | flag render (`sceneDirty`/`blurDirty`/`needsRender`), `drawGlassItem`, `glassUniformsBase`, `render()`, `glassPlan`, `execPlanGL` (baru: rencana gambar per item) | `renderer-gl.js` |
| (5) 1041-1066 | `diagText`, `enterFallback`, `selfCheck` | `engine.js` |
| (5) 1067-1194 | WGSL (`WG_COMMON`, `WG_QUAD`, `WG`) | `shaders-wgsl.js` |
| (5) 1195-1307 | `skipGPU`, `setRenderer`, `ARENA_SLOTS`, `initWebGPU`, `allocGPU`, `ensureLowGPU`, `uploadGlyphsGPU`, `fsPass`, `composePassGPU`, `glassVals`, `renderGPU` | `renderer-gpu.js` / `engine.js` |
| (5) 1308-1312 | `renderFallback` (memanggil `opts.paintContent2D`) | `engine.js` |
| (5) 1421-1464 | `startLoop`, `tick` (dipecah, lihat interface) | `engine.js` |
| (5) 1476-1486 | `resize` (penyesuaian `#fallbackCv` di dalamnya) | `engine.js` |
| (5) 1508-1544 | rantai boot: inisialisasi GL (try/catch → fallback canvas), HIC, `initWebGPU().catch(skipGPU)`, `window.__api`, hook DEBUG `__shot`/`?test`, `window.__ready` | `engine.js` |

Sisa `kit.js` (tetap di web): icons content (`art`, `mulberry32`), prims
(`buildPrims`, `drawContent`, `domEl`, `buildDOM`, `patchDOM`), settings
(`buildSettingsPrims`, `switchZone`, `sliderZone`, `thumbGeo` dsb.), state kit
(`HITS`, `GT` DIKUNCI ke engine, `A11Y`, `gs`, `pageTitle`, `persist`,
`refreshPage`, `openPage`, `popPage`, `setThemeMode`), `syncA11y`, `onTap`,
seluruh blok input (L2552-2666), layout (`buildLayoutX`, `buildTop`, `setVertical`,
`tabInnerW`, `fb`, `setTopTitle`), `PillMotion` + `pill`, `applyDOM`,
`menuRects`, `initFallbackUI`, `syncFallbackTabs`, `resize` (kit), panel
(L2747-2772), dan penyusunan `window.__api`.

**Interfaces:**

```js
// packages/glass/src/index.js (satu-satunya impor yang dipakai web)
export function createGlassEngine(opts) { ... }  // → engine
export const S, SPR, DEFAULTS;                   // rujukan mutable yang sama dengan lama
export function createParams(saved) { ... }      // → { P, ST }
export function subscribe(fn) { ... }            // store: dipanggil engine tiap tick
```

`createGlassEngine(opts)`:

```js
{
  params: { P, ST },            // dari createParams(saved); persist tetap di web
  phone,                        // #phone; canvas diberikan saat boot
  pill, iconScale, GT,          // pemilik: kit/web; engine membaca (render, atlas, tick GS lewat onFrame)
  onFrame,                      // (dt, now, flags) => boolean; lihat di bawah
  onResize,                     // (w, h) => void; kit/content rebuild
  hudLabel,                     // () => string; label halaman untuk HUD debug
  paintContent2D,               // (ctx) => void; replika canvas (drawContent web)
  initFallbackUI, syncFallbackTabs,  // dipanggil jalur fallback (milik web)
  onGlyphsDirty, ...            // hanya bila ternyata dibutuhkan; jangan menambah selain itu
}
→ engine {
  boot({ canvas }),             // rantai renderer verbatim; di akhir: DEBUG → window.__ready = true
  startLoop(), invalidate({ scene, blur, glyph }), // invalidate menyetel flag + needsRender
  register(key, el), unregister(key),               // registry permukaan (Keputusan 6 spek)
  measure(key),                 // rect terukur ternormalisasi ke koordinat canvas (untuk konsumen/probe)
  resize(), dispose(),
  flags,                        // { sceneDirty, blurDirty, glyphDirty, needsRender } untuk dibaca onFrame
}
```

**Kontrak `onFrame` (kunci Task 3):** web mendaftarkan SATU fungsi hasil komposisi
yang meniru urutan `tick` lama:

1. fisika gesture kit (`vel` decay → `setScroll`) + spring kit (fold `S.t/S.tv`,
   acc press, `SPR.back/act/srch`, `SPR.menu` target `S.menuOpen`, blok `GS`,
   `iconScale`) + `pill.tick`, yaitu semua yang dulu ada SEBELUM blok render
2. `applyDOM()` di dalam gerbang yang sama seperti lama:
   `if (active || flags.needsRender || flags.sceneDirty)`; `flags` diberikan engine
3. engine mengeksekusi spring `SPR.touch` sendiri SETELAH `onFrame` (urutan ini
   aman: touch hanya membaca render)
4. engine render (`renderGPU` / `render` + `selfCheck` / `renderFallback`),
   lalu memutuskan frame berikutnya dari `boolean` hasil `onFrame` + `flags` +
   aktivitas touch, persis logika `if (active || sceneDirty)` lama

`onFrame` mengembalikan `active` kit (true = masih animasi). Blok HUD (`#hud`,
`pageTitle`) memakai `hudLabel()`.

- [ ] **Step 1: Batch A (leaf)**

  Scaffold `src/` + pindahkan `util.js`, `params.js`, `state.js`, `icons.js`,
  `shaders-gl.js`, `shaders-wgsl.js` sesuai peta. `kit.js` mengimpor dari
  `'liquid-glass'` (daftarkan `workspace:*` + `transpilePackages` di step ini).
  Hapus salinan lokal. Verifikasi: 4 probe + dom-ids-check + `pnpm build`.

- [ ] **Step 2: Batch B (renderer)**

  Pindahkan `renderer-gl.js`, `renderer-gpu.js`, `hic.js`, flag scene, dan
  fungsi diagnostik. Renderer kini diekspor sebagai bagian `engine` internal;
  `kit.js` memakai `engine.invalidate(...)`, `engine.startLoop()` menggantikan
  penulisan `sceneDirty/needsRender` langsung. Verifikasi: 4 probe + build.
  (Error kompilasi shader ketangkap `ERRORS` di smoke/fold probe.)

- [ ] **Step 3: Batch C (tick + boot, pemecahan terbesar)**

  Pindahkan `startLoop`, `tick` (dipecah sesuai kontrak onFrame), `resize`,
  `renderFallback`, dan rantai boot ke `engine.js`. `kit.js` mendaftarkan
  `onFrame` komposisi (Step interface di atas) + `onResize` (kit rebuild:
  `buildPrims` + `buildDOM` + `glyphDirty` seperti `resize` lama) +
  `paintContent2D: drawContent` + `initFallbackUI`/`syncFallbackTabs` +
  `hudLabel: () => S.nav.length ? pageTitle() : TITLES[S.tab]`. `window.__api`
  disusun web SEBELUM `engine.boot(...)` (urutan lama: `__api` lalu `__ready`).
  Glow touch: engine memasang listener `pointermove` sendiri pada `#hit`
  (terpisah dari blob gesture web; jangan menyentuh blob gesture). Verifikasi:
  4 probe + dom-ids-check + build.

- [ ] **Step 4: Aturan batas (grep)**

  ```sh
  grep -rn "from 'react'" packages/glass/src && echo FAIL || echo OK-react
  grep -rnE "S\.(menuOpen|playing|accPress|accScale|inline|tv)|setTab|pageTitle|applyDOM|buildPrims" packages/glass/src && echo FAIL || echo OK-kit
  ```

  Expected: dua-duanya `OK`. `S.dark/nav/scrollY/t/tab` BOLEH dibaca engine
  (bacaan render yang sudah ada). Selain itu, kalau ada identifier kit yang
  ternyata dipakai render, pindahkan bacaannya ke `onFrame`/opts, jangan
  mengimpor kit ke engine. Verifikasi akhir: 4 probe + dom-ids-check + build.

---

### Task 4: Ekstrakt komponen ke packages/ui

**Files:**
- Create: `packages/ui/src/{frame,layout,motion,components/*,store,hook,index}.js(x)`
- Create: `packages/ui/styles.css` (potongan CSS komponen dari `globals.css`)
- Modify: `apps/web/app/globals.css` (berkurang; chrome demo saja)
- Modify: `apps/web/components/Kit.jsx` (rakit ulang dari komponen)
- Modify: `apps/web/app/layout.js` → `import 'liquid-glass-ui/styles.css'`
- Modify: `next.config.mjs` → `transpilePackages: ['liquid-glass', 'liquid-glass-ui']`
- Modify: `apps/web/package.json` → `"liquid-glass-ui": "workspace:*"`

**Inventaris komponen (JSX, id identik):**

- `GlassTopBar`: `#topTitle`, `#topBack`, `#topActions`, `#hitBack`, `#hitShare`, `#hitMore`
- `GlassAccessory`: `#acc` (isi: `.art`, `.meta`, `#accPlay`, `#accNext`)
- `GlassTabBar`: `#inlineIcon`, `#searchIcon`, `#tabHit`, `#searchHit`, `#tabFocus`, `#a11yTabs`
- `GlassMenu`: `#menuScrim`, `#menu`
- Sisa Kit.jsx (web): `#phone`, `#hud`, `#gl` + `#page`/`#pageInner`, `#hit`,
  `.status`, `.home`, `#a11y`, `#gear`, `#panel`

**Interfaces:**

```js
// packages/ui/src/index.js
export { GlassTopBar, GlassAccessory, GlassTabBar, GlassMenu, GlassProvider, useGlass, useKitState };
export function createKitFrame(engine, injected) { ... }  // → onFrame (kontrak Task 3)
export * as layout from './layout.js';                    // konstanta + FOLD untuk fold-check
```

- `GlassProvider`: membuat engine saat render (`useMemo`, konstruksi saja),
  `boot({ canvas, phone })` di efek SETELAH anak mount (urutan efek React:
  anak dulu → register, baru provider boot), `dispose` saat unmount; menyediakan
  context engine.
- `createKitFrame(engine, injected)`: `injected = { getTitle, syncFallbackTabs }`
  (judul dan fallback butuh data web). Isi = pemindahan verbatim: `computeLayout`
  (perhitungan `L` lama, dipanggil sekali per frame) → updater per komponen
  (`updateAccessory`, `updateTabBar`, `updateTopBar`, `updateMenu` = pemotongan
  blok `applyDOM` L1468-1487 tanpa mengubah satu baris matematika pun) →
  spring kit + `pill.tick` + gerbang, sesuai kontrak onFrame Task 3.
- `useKitState(selector)`: `useSyncExternalStore(subscribe, () => selector(S))`.
  Demo boleh tidak memakainya (semua tulisan DOM tetap imperatif, paritas);
  hook ini permukaan library untuk konsumen. `engine` memanggil `subscribe`
  notifikasi setiap tick.
- Pemilik CSS: selector yang membangun elemen inventaris di atas →
  `packages/ui/styles.css`. `#gl/#page/#pageInner/#fallbackCv` → pindahkan
  deklarasinya ke inline style di tempat elemen dibuat/dirender (aturan spek:
  engine tanpa CSS). Sisanya (`.phone`, `.status`, `#hud`, `.panel`, `#gear`,
  `.home`, `body/#phone` chrome, dsb.) tetap di `globals.css`.
  Kalau ragu: cek siapa yang MEMBUAT elemennya; pembuat = pemilik CSS.

- [ ] **Step 1: Batch A (layout + motion + frame)**

  Scaffold `packages/ui` + `workspace:*` + `transpilePackages`. Pindahkan
  `PillMotion` + `pill`, `buildLayoutX`, `buildTop`, `setVertical`, `tabInnerW`,
  `fb`, `setTopTitle`, konstanta layout (L732-737 termasuk `SCROLL_THRESHOLD`
  dan `TABS/SEARCH/NT/TITLES`), `applyDOM`, `scaleR`, `menuRects`, `playIcon`,
  `setR`, dan `computeLayout`. Web mengimpor `createKitFrame` + konstanta yang
  dipakai input (`tabSlot` butuh `EX/IN` lewat layout export). `applyDOM` boleh
  dipindah UTUH dulu (satu fungsi); pemotongan per komponen di Step 3.
  Verifikasi: 4 probe + dom-ids-check + build.

- [ ] **Step 2: Batch B (JSX + CSS)**

  Pisahkan Kit.jsx menjadi 4 komponen di atas (markup identik, urutan di dalam
  Kit.jsx tetap seperti asli agar z-order tumpukan tidak berubah). Potong CSS
  pemilik komponen ke `packages/ui/styles.css`; `layout.js` mengimpornya.
  Pindahkan deklarasi `#gl/#page/#pageInner` ke inline style; `#fallbackCv`
  ke inline style saat dibuat di catch boot ((5) L1510; dulu `bootFallback`).
  Verifikasi: 4 probe + dom-ids-check
  (id wajib tetap sama) + build. Bandingkan DIAG smoke dengan baseline.

- [ ] **Step 3: Batch C (split applyDOM per komponen + provider)**

  Potong blok `applyDOM` menjadi `updateAccessory` / `updateTabBar` /
  `updateTopBar` / `updateMenu` + `computeLayout` (yang mengisi `L` untuk
  render). Tambahkan `GlassProvider` + `register/unregister` di komponen +
  `useKitState`. Komposisi `onFrame` di web: blok `GS` settings web dahulu,
  lalu `createKitFrame(...)`. Verifikasi: 4 probe (khususnya fold-probe:
  urutan frame tidak boleh berubah) + build.

- [ ] **Step 4: Aturan batas (grep)**

  ```sh
  grep -rn "from 'react'" packages/glass/src && echo FAIL || echo OK-react
  grep -rn "liquid-glass-ui\|apps/web" packages/glass/src && echo FAIL || echo OK-dep
  grep -rn "from 'liquid-glass'" packages/ui/src >/dev/null && echo OK-ui-uses-glass
  ```

  Verifikasi akhir: semua alat hijau.

- [ ] **Step 5: GATE 2 (verifikasi HP user, MENGHENTIKAN task berikutnya)**

  Daftar cek sama dengan GATE 1, ditambah: pemilih WebGPU via `localhost` di HP
  (secure context) dan WebGL2 dari PC (`http://<ip-HP>:3000`). Task 5 tidak
  dimulai sebelum user menyatakan lolos.

---

### Task 5: Rapikan (README, metadata, fold-check satu sumber)

**Files:**
- Modify: `packages/{glass,ui}/package.json` (description, exports, license)
- Create: `liquid-glass-next/README.md`
- Modify: `tools/fold-check.mjs` (impor konstanta dari `liquid-glass-ui`)

**Interfaces:**
- Produces: `liquid-glass-ui` mengekspor konstanta geometri + jendela fold
  (`FOLD = { wide: .7, riseFrom: .55, riseSpan: .45 }`) yang dipakai `applyDOM`
  DAN `fold-check`, sehingga tidak ada lagi salinan yang bisa kedaluwarsa.

- [ ] **Step 1: Satu sumber konstanta fold**

  Buat `packages/ui/src/layout.js` berisi konstanta geometri (sudah pindah di
  Task 4) plus `FOLD`. `applyDOM` memakai `FOLD.wide` dan
  `FOLD.riseFrom/riseSpan`; angkanya HARUS identik dengan literal referensi (5)
  (`t / .7`, `(t - .55) / .45`, smoothstep tetap; jangan mengubah satu pun
  angka). `fold-check.mjs` mengimpor konstanta geometri DAN `FOLD` dari
  `'liquid-glass-ui'` (package bertipe module, import langsung jalan di Node);
  fold-check lama sudah memakai `t/.7` sehingga kini cocok; impor tetap
  mewajibkan satu sumber agar tidak bisa kedaluwarsa lagi.
  Run: `node tools/fold-check.mjs` → PASS.

- [ ] **Step 2: Metadata + README**

  `package.json` masing-masing package: `"license": "GPL-3.0-only"`,
  `"description"`, `"exports"` (glass: `"."` → `src/index.js`; ui: `"."` +
  `"./styles.css"`). README `liquid-glass-next/`: cara menjalankan
  (`pnpm install`, `pnpm dev`, probe), susunan tiga folder, catatan `--webpack`
  (alasan Termux), dan atribusi lisensi (BitChord GPL-3.0, Kyant0/backdrop
  Apache-2.0, mengutip komentar lisensi file asli).

- [ ] **Step 3: Verifikasi akhir penuh**

  `pnpm build` + `node tools/dom-ids-check` + `node tools/fold-check` + keempat
  probe, semua hijau dan DIAG cocok dengan baseline.

---

## Self-review

- Cakupan spek: Tujuan 1-5 = Task 1-5, ditambah Task 2.5 (sinkronisasi
  referensi (5), desain 2026-11-19); dua gerbang HP (spek: Verifikasi) = Task 2
  Step 9 (dijalankan setelah 2.5) dan Task 4 Step 5; persist `P`/`ST` urusan web (Keputusan 8) tetap di web
  (`createParams` hanya menerima `saved`); kontrol settings tetap imperatif di
  web (Keputusan 5) tidak dipindah.
- Interpretasi yang perlu diketahui user: (a) Keputusan 6 spek "engine mengukur
  rect tiap frame" dieksekusi sebagai registry `register` + perhitungan layout
  `L` seperti sekarang (nilai sama, risiko nol), dengan `measure()` tersedia
  untuk konsumen; (b) bagian input sengaja tetap di `apps/web` (Fokus risiko 5).
- Konsistensi nama: `onFrame` dipakai di Task 3 dan 4; `createKitFrame` hanya
  Task 4; `FOLD` hanya Task 5; `invalidate({scene,blur,glyph})` menggantikan
  semua penulisan flag langsung dari web.
- Urutan `tick` lama (gesture → spring kit → applyDOM → spring touch → render)
  dipertahankan sebagai kontrak; fold-probe (0 dead frame) dan menu-probe adalah
  detektornya.
- Probe lama tidak diubah logikanya, hanya target URL/path: baseline Task 1
  menjadi pembanding objektif tiap task berikutnya; setelah Task 2.5 baseline
  dikunci ulang terhadap build tersinkron (yang lama disimpan `*.pre5.txt`).
- Yang di luar scope sesuai spek: TypeScript, publish npm, Tailwind, perubahan
  visual, Storybook, file LICENSE penuh (atribusi via package.json + README).
