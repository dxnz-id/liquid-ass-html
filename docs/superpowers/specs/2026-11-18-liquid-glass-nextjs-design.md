# Desain: Liquid Glass ke Next.js + pnpm workspace (2026-11-18)

Tanggal: 2026-11-18
Status: draft, menunggu persetujuan

## Niat

Kit Liquid Glass sekarang hidup di satu file, `liquid-glass-ios-kit-v2.html`
(2841 baris: CSS 575, HTML 108, JS 2125). Tujuan proyek ini: memindahkan seluruh
isi file itu ke aplikasi Next.js di folder baru memakai pnpm, dan memisahkan
bagian liquid glass-nya menjadi library (engine) serta UI kit (komponen React)
supaya bisa dipakai ulang dari project lain.

## Tujuan

1. Folder `liquid-glass-next/` di root repo ini, pnpm workspace tiga bagian:
   `packages/glass` (engine), `packages/ui` (UI kit React), `apps/web`
   (demo Next.js).
2. Paritas perilaku penuh: semua interaksi yang ada di file sekarang jalan
   identik di Next.js (daftar lengkap di bagian Verifikasi).
3. `packages/glass` framework-agnostic: rantai renderer
   WebGPU/WebGL2/Canvas2D, shader, spring, parameter glass, backdrop, sentuh dan
   glow. Tidak mengimpor React.
4. `packages/ui`: komponen React (bar tab pil, kontrol bar atas, pil musik
   aksesori, menu titik tiga beserta scrim) beserta CSS-nya.
5. `apps/web`: demo yang memperagakan kit persis seperti showcase sekarang
   (bingkai phone, halaman konten, panel gear, HUD debug, pemilih renderer).

## Bukan tujuan

- Rewrite TypeScript. Logika dipindah apa adanya (JS).
- Publish ke npm. Struktur disiapkan; publish keputusan terpisah.
- Ubah visual atau feel. Paritas saja, tidak ada fitur baru.
- Tailwind atau library animasi eksternal. Spring yang ada tetap dipakai.
- Menyentuh `liquid-glass-ios-kit-v2.html` dan `server.js`. File lama tetap
  utuh dan tetap jalan sebagai referensi.
- Storybook atau situs dokumentasi.

## Anti tujuan (gagal kalau ini terjadi)

- Menulis ulang matematika motion atau spring dari nol. Perbaikan yang sudah
  terverifikasi (jendela fold, tahan menu, fill lensa) harus selamat.
- Engine mengimpor React. Batas library-nya hilang kalau ini terjadi.
- Periode panjang di mana tidak ada yang bisa dijalankan. Port harus bisa
  diverifikasi setiap langkah.
- WebGL/WebGPU dikirim tanpa uji. Uji lokal selalu jatuh ke Canvas2D.

## Batasan

- Termux, Node v26.13.0, npm 12.2.2, registry npm jalan. pnpm belum terpasang:
  pasang dengan `npm i -g pnpm` (corepack tidak tersedia di env ini).
- **Next.js di Termux.** Next 16.4.6 tidak menyediakan binary SWC native untuk
  android/arm64. Next jatuh ke SWC WASM (`@next/swc-wasm-nodejs` 16.4.6 ada),
  tetapi Turbopack (bundler bawaan Next 16) menolak WASM. Solusi resmi dari
  dokumentasi Next.js: jalankan `next dev --webpack` dan `next build --webpack`.
  Resolusi ini wajib dipakai sejak awal dan wajib dibuktikan di spike pertama.
  Kalau gagal, eskalasi ke pengguna sebelum port besar.
- Uji GPU tidak bisa dilakukan lokal (headless selalu Canvas2D). WebGPU dan
  WebGL2 diverifikasi di HP pengguna, seperti sekarang.
- Lisensi: karya turunan (angka, layout, dan teks BitChord GPL-3.0; shader
  Kyant0/backdrop Apache-2.0), jadi package baru bawa GPL-3.0. Relisensi di
  luar lingkup.
- Paritas adalah kontrak. Setiap perilaku yang sudah diverifikasi wajib sama.

## Pendekatan

- **A (dipilih): pnpm workspace tiga bagian.** Batas library sungguhan, bisa
  dipakai dari project lain, dan pnpm workspace adalah fitur utama pnpm.
  Harga: setup lebih banyak (3 `package.json` plus konfigurasi workspace).
- **B (ditolak): satu aplikasi Next.js dengan kode glass di `src/`.** Lebih
  cepat jadi, tetapi "library" hanya konvensi folder. Kalau nanti harus dipakai
  lintas project, harus extract ulang.

## Keputusan

1. **Folder dan nama package.** `liquid-glass-next/` di root repo, satu repo
   git. Nama package: `liquid-glass` (engine) dan `liquid-glass-ui` (React).
   Kalau suatu saat mau publish dan nama sudah dipakai, ganti saat itu.
2. **Susunan workspace.**

   ```
   liquid-glass-next/
   ├── pnpm-workspace.yaml
   ├── package.json            (private; scripts dev/build pakai --webpack)
   ├── packages/
   │   ├── glass/              → package `liquid-glass`
   │   └── ui/                 → package `liquid-glass-ui`
   └── apps/
       └── web/                → Next.js App Router, JavaScript
   ```

3. **Toolchain.** Next.js 16 (terbaru 16.4.6), App Router, JavaScript, CSS
   biasa tanpa Tailwind, pnpm. Script `dev` dan `build` memakai `--webpack`
   sejak awal. Package workspace dikonsumsi sebagai source lewat
   `transpilePackages`, tanpa build step.
4. **Strategi port: ekstraksi, bukan penulisan ulang.** Urutan langkah:
   1. Spike: workspace plus halaman Next minimal; `pnpm dev --webpack` hidup di
      Termux dan `pnpm build --webpack` lolos.
   2. Pindahkan seluruh isi file (CSS, HTML, JS) ke `apps/web` sebagai satu
      modul client dulu. Paritas tercapai di Next.js, probe hijau.
   3. Ekstrak engine ke `packages/glass`.
   4. Ekstrak komponen ke `packages/ui`.
   5. Rapikan: README, metadata package.
   Probe hijau setelah setiap langkah.
5. **Batas paket.**
   - `liquid-glass`: renderer, shader, spring, parameter glass, backdrop (HIC
     plus hook replika canvas), sentuh dan glow, util. Tidak tahu soal tab,
     menu, atau musik.
   - `liquid-glass-ui`: komponen, CSS, dan logika layout serta motion khusus
     kit (PillMotion, slot tab, rect menu, padanan applyDOM per komponen).
   - `apps/web`: halaman dan konten demo (album, settings), bingkai phone,
     panel gear, HUD, pemilih renderer, persist localStorage.
   - Kontrol settings (switch, slider, baris Settings di dalam app) tetap kode
     imperatif di `apps/web` seperti sekarang, tidak di-React-kan di v1.
     Alasannya: kontrol itu berpasangan dengan pipeline prims muka ganda (DOM
     hidup untuk HIC plus replika canvas untuk fallback); mengubahnya jadi
     komponen berarti membelah pipeline itu dan menyentuh renderer fallback,
     lapisan a11y, serta registry thumb glass sekaligus. Kalau nanti mau jadi
     bagian kit, itu langkah terpisah.
6. **Cara React bertemu engine (keputusan kunci).**
   - Loop per-frame (tick, spring, penulisan posisi) tetap imperative di
     engine dan menulis ke ref DOM. React tidak re-render tiap frame.
   - React memiliki markup (JSX) dan state semantik (tab, menu terbuka,
     parameter). Engine menyimpan state semantik itu di store kecil;
     komponen membacanya lewat hook langganan (`useSyncExternalStore`) dan
     menulis lewat aksi.
   - Komponen mendaftarkan elemen glass-nya ke engine saat mount (fungsi
     sejenis `registerSurface`); engine mengukur rect elemen tiap frame.
7. **CSS.** Satu `styles.css` per package, diimport konsumen sekali di layout.
   CSS komponen pindah ke `liquid-glass-ui`; CSS chrome demo (bingkai phone,
   panel, HUD, halaman) tetap di `apps/web`; engine tanpa CSS (canvas di-style
   inline oleh provider).
8. **Persist.** Panel settings demo memegang `P` (parameter glass) dan `ST`
   (renderer, tema, haptic). `P` dibaca dan ditulis lewat API engine; persist
   localStorage urusan app. Bentuk data diserahkan ke builder (murah kalau
   bentuk lama dipertahankan).

## Verifikasi

- Spike pertama membuktikan Next jalan di Termux sebelum port besar.
- Probe CDP yang sudah ada di `/data/data/com.termux/files/usr/tmp/lg-chrome/`
  (`fold-check`, `fold-probe`, `menu-probe`, `smoke`, `probe-acc` beserta skrip
  `run-`nya) dipindah ke `liquid-glass-next/tools/` pada awal spike. Lokasi lama
  di tmp bisa kapan saja dibersihkan, jadi pemindahan tidak boleh menunggu.
  Setelah dipindah, probe diarahkan ke `http://localhost:3000`: `fold-check`
  (geometri; konstanta diimpor dari package supaya jadi satu sumber), `smoke`
  (play, next, a11y), `menu-probe` (klik luar nutup menu), `fold-probe`
  (0 dead frame).
- Dua gerbang verifikasi di HP pengguna, menghalangi langkah besar:
  1. setelah langkah 2 (paritas tercapai di Next.js), sebelum ekstraksi;
  2. setelah langkah 4 (ekstraksi engine dan komponen selesai).
  Antara gerbang, probe lokal jalan setiap langkah. Error kompilasi shader atau
  exception runtime ketangkap probe lewat kumpulan error, jadi kerusakan GL yang
  kasat (shader gagal, uniform lewat) tidak menunggu gerbang.
- Daftar paritas:
  - scroll collapse ambang 50dp;
  - fold: kanal naik jalan di t = 0,55 sampai 1, kanal melebar di t = 0 sampai
    0,8, keduanya smoothstep dua ujung;
  - tahan menu 350ms lalu seret untuk memilih item;
  - klik luar (scrim) menutup menu; Escape menutup; klik item menutup;
  - fill lensa konstan;
  - tekanan spring (press scale dan damping);
  - rantai fallback renderer serta pemilih renderer;
  - a11y: tablist, region, tombol aria;
  - persist localStorage.
- `pnpm build --webpack` hijau menjadi gerbang sintaks dan impor.
- WebGPU dan WebGL2: uji manual di HP pengguna. Cara aksesnya dua:
  - dari HP: `http://localhost:3000`; localhost termasuk secure context sehingga
    WebGPU hidup. Ini jalur gerbang verifikasi WebGPU.
  - dari PC lewat Wi-Fi: `http://<ip-HP>:3000`; HTTP polos termasuk insecure
    context sehingga WebGPU tidak tersedia dan renderer jatuh ke WebGL2. Ini
    aturan browser, bukan bug. `next dev` melayani semua antarmuka (baris
    Network di log); kalau tidak, tambah `-H 0.0.0.0`.
  - WebGPU dari PC hanya dipasang kalau memang diinginkan: flag Chrome
    `unsafely-treat-insecure-origin-as-secure` atau HTTPS lewat mkcert. Keduanya
    di luar jalur kritis karena gerbang WebGPU sudah tercakup dari HP.

## Risiko

- WASM SWC plus webpack di Termux belum terbukti di mesin ini sampai spike
  jalan. Kalau jalur itu gagal, opsi eskalasi: Next 15 atau lingkungan proot.
- Port memutus motion halus. Ini risiko terbesar; diredam oleh probe, daftar
  paritas, dan aturan matematika tidak disentuh.
- HIC memakai atribut DOM eksperimental (`layoutsubtree`, `drawable`) milik
  Chrome. Tidak berubah oleh port; tetap diverifikasi di HP.
- Konten punya dua wajah: DOM hidup untuk HIC, replika canvas untuk fallback.
  Satu sumber data (ALBUMS, ARTISTS, CATS) dipakai keduanya supaya tidak
  divergen.

## Serah ke builder

- Pemetaan modul per baris untuk 2125 baris JS (aturan batas sudah di atas).
- Bentuk API engine: nama fungsi, props komponen, nama hook.
- Pilihan scaffold: `create-next-app` dengan flag non-interaktif atau berkas
  manual.
- Adaptasi probe (URL, selector) dan urutan langkah port lebih rinci.
- Bentuk persist `P` dan `ST`: pertahankan `SAVE_KEY` lama atau buat baru.
