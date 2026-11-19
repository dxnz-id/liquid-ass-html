# Desain: Sinkronisasi port ke referensi `liquid-glass-ios-kit-v2 (5).html`

Tanggal: 2026-11-19
Status: DISETUJUI user (2026-11-19, "ya"). User memilih **opsi 2** (ikut referensi sepenuhnya, termasuk jendela fold `.7`).

## Intent

Port Next.js (`liquid-glass-next/`) saat ini menyalin kit dari `liquid-glass-ios-kit-v2.html` (file lama di repo). User menunjuk `/storage/emulated/0/Download/liquid-glass-ios-kit-v2 (5).html` sebagai referensi dan meminta semua implementasi renderer disesuaikan; setelah ditanya, user memilih mengikuti referensi itu sepenuhnya, bukan renderer saja.

Hasilnya: tiga artefak port (CSS, markup, script) bersumber dari file (5), sehingga perilaku port = perilaku (5), termasuk jalur WebGPU/WebGL2 yang baru dan jendela fold `.7`.

## Approaches

1. **Renderer-only, fold tetap `.8`** (ditolak user): tukar fungsi renderer saja. Tersempit, tapi meninggalkan dua sumber kebenaran (kit lama + renderer baru) dan melewatkan delta kit yang cuma sedikit.
2. **Ikut (5) sepenuhnya** (DIPILIH user): ganti isi `globals.css`, `Kit.jsx`, dan `lib/kit.js` dari file (5) memakai prosedur ekstraksi yang sama seperti Task 2 (verbatim + aturan konversi JSX yang sama). Satu sumber kebenaran, verifikasi satu arah. Alasan lain: di luar renderer, beda yang nyata cuma jendela fold `.7` plus beberapa delta kecil (label opsi WebGPU, dukungan `?renderer=`, opsi konteks 2D glyph) yang semuanya kebawa dengan sendirinya.

## Hasil recon (bukti)

| Lapisan | Temuan |
|---|---|
| CSS | 78 aturan di kedua file, 76 identik, urutan sama. Dua yang beda persis renderer: `#gl,#fallbackCv,#gpuCv` (lama) jadi `#gl` + `#fallbackCv` terpisah; aturan `#wgpu-dbg` hilang dari (5). |
| Markup body | Beda 6 potong, semuanya teks bantuan renderer + label opsi `<select>` WebGPU. Struktur id di region yang dicek `dom-ids-check` (`<body>`..`<script>`): 32 id, identik. Elemen `#wgpu-dbg` ada di file lama setelah `</script>`, tidak ikut masuk Kit.jsx sejak awal. |
| Script | 44 fungsi identik (kit inti: `buildDOM`, `openPage`, `onTap`, `setTheme`, `setScroll`, dst). Renderer ditulis ulang: 8 fungsi baru (`glassPlan`, `execPlanGL`, `fsPass`, `lowStrips`, `composePassGPU`, `renderGPU`, `uploadGlyphsGPU`, `glassVals`), 7 fungsi lama hilang (`bootWebGL`, `bootFallback`, `drawQuadGPU`, `drawGlassItemGPU`, `renderWebGPU`, `updateGlassLowABindGroup`, `updateGlyphBindGroupsGPU`), plus delta di `tick`, `resize`, `diagText`, `detectHIC`, `drawGlyphs`, `setRenderer`, `selfCheck`, `skipGPU`, `renderFallback`. |
| Kit non-renderer | `applyDOM`: `clamp(t/.7)` di (5) vs `clamp(t/.8)` di file lama (fold). Lainnya kecil: `?renderer=` URL param (baru di (5)), `gcx=getContext('2d',C2D)`, teks help Settings. |
| Debug hooks | `window.__ready`, `window.__api`, `?hud` tetap ada di (5). Probe aman. |
| Settings | 26 baris settings identik di kedua file. |

## Keputusan desain

1. **Sumber kebenaran port = file (5)**, disalin ke repo root dengan nama aslinya `liquid-glass-ios-kit-v2 (5).html` (nama mengandung spasi dan kurung; pilihan sadar: tanpa penamaan ulang, dan file di Download berisiko dibersihkan seperti pelajaran Task 1). File lama `liquid-glass-ios-kit-v2.html` tetap tidak disentuh. *(Bisa dikoreksi user: kalau mau nama lain atau tidak usah disalin, bilang.)*
2. **Tiga artefak di-sync** memakai prosedur Task 2: `globals.css` dari `<style>`, `Kit.jsx` dari markup `<body>`..`<script>` dengan aturan konversi JSX yang sama, `lib/kit.js` = seluruh isi `<script>` dari (5) dibungkus `initKit()` (kontrak tidak berubah).
3. **`tools/dom-ids-check.mjs` dialihkan** membaca salinan repo file (5) (region `<body>`..`<script>`, 32 id).
4. **Baseline probe di-kunci ulang**: jalankan keempat probe terhadap build baru, bandingkan dengan `tools/baseline/*.txt` lama, evaluasi tiap beda. DIAG pasti berubah (`diagText` baru); fold mungkin berubah; beda yang tidak bisa dijelaskan = hentikan dan lapor. Baseline lama disimpan sebagai `*.pre5.txt`, bukan dihapus.
5. **Plan di-amend** setelah desain ini disetujui: kriteria GATE 1 fold `[0..0,8]` jadi `[0..0,7]`; peta modul Task 3 memakai nama fungsi renderer baru; konstanta `FOLD` Task 5 = `.7`.
6. **Tidak disentuh**: file sumber lama, `server.js`, isi probe (kontrak), manifest package, `docs/` selain amendmen plan.

## Urutan kerja

Task baru (2.5) di antara Task 2 dan Task 3: sync tiga artefak + verifikasi lokal + re-lock baseline. Task 3 (ekstraksi engine) baru jalan setelah Task 2.5 beres, dan peta modulnya mengikuti kode (5).

## Verifikasi

- Kesesuaian verbatim: `globals.css` vs `<style>` (5), isi `kit.js` vs `<script>` (5), `Kit.jsx` vs markup (5) dengan aturan konversi (pola pemeriksaan Task 2).
- `pnpm build` exit 0; `dom-ids-check` `hilang: []`.
- Empat probe vs baseline baru (delta terekam di laporan).
- **GATE 1 di HP wajib diulang** setelah sync: jalur WebGPU/WebGL2 baru tidak bisa dibuktikan lokal (GPU device crash, yang teruji lokal hanya fallback Canvas2D).

## Risiko dan batas

- Performa/feel jalur GPU hanya terbukti di HP user; lokal nol informasi tentang itu.
- Gaya format script (5) lebih padat daripada file lama; kit.js akan jauh lebih pendek. Verbatim menang di atas estetika.
- Param URL `?renderer=` dari (5) ikut masuk (bawaan referensi, tidak berbahaya).
- `fold-check.mjs` lama memakai jendela `.7`; setelah sinkronisasi justru cocok dengan referensi. Task 5 tetap mengimpornya dari satu sumber.
