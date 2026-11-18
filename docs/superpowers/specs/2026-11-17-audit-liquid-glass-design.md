# Desain pendek: audit Liquid Glass (2026-11-17)

## Niat
Perbaiki 8 temuan audit plus satu perilaku animasi agar sama dengan video Apple
(detik 674, youtube.com/watch?v=FXrcFeuYtq8). Dua item haptic (getar masih bunyi
saat dimatikan; kekuatan/jenis haptic) ditunda permintaan pengguna.

## Item dan keputusan

1. **Kecepatan animasi untuk audit.** `P.speed` (0,05–1, default 1) dikalikan ke
   `dt` di `tick`; slider di panel; ikut tersimpan. Hook `?debug` `window.__ts`
   dibiarkan.
2. **Pil music player vs bar (sesuai video).** Titik ubah `applyDOM`:
   - tabs + search pakai kurva cepat `tT = 1-(1-t)^3` (bar kompak lebih dulu),
   - pil: penyusutan/geser kanan `tA = clamp(t/0.6)` sambil tetap di atas bar,
   - pil baru turun `tAy = clamp((t-0.7)/0.3)`. Pada t = 0,7 sisi kiri pil (84)
     sudah melewati tepi kanan tab (82) dan sisi kanan pil (306) sebelum
     lingkaran search (314), jadi tidak ada frame yang tumpang tindih; jarak
     akhir 8px seperti kondisi sekarang.
3. **Knob switch tidak seimbang/keluar jalur.** Travel `22+20t` (sekarang
   `22+22t`, posisi on mepet 0px) di canvas, DOM, glass, dan matematika drag
   `switchZone`; thumb yang membesar di-clamp di dalam track.
4. **Isi slider tidak mentok.** `fw = min(w, tx + 20 - x0)` (sekarang berhenti
   di tengah thumb, terlihat saat thumb ditahan dan memudar jadi kaca).
5. **Scroll tersendat di area slider.** `pointerdown` tidak langsung merebut
   gesture: tekan-tahan 220ms tanpa gerak baru slider aktif; gerak >6px sebelum
   itu dijadikan scroll; setelah aktif thumb ikut jari dengan offset, tanpa
   lompat ke posisi sentuh.
6. **Label overshoot.** Judul baris slider di dalam app di-wrap maksimum 2 baris
   dengan `wrap()` yang sudah ada, tinggi baris naik 21px per baris tambahan;
   di panel, kolom label dikunci `minmax(0,1fr)` + `min-width:0`.
8. **Menu titik tiga kanan atas.** Tahan 350ms → haptic dan expand bersamaan;
   sambil tahan, seret ke item → item ter-highlight; lepas di atas item →
   item terpilih; tap cepat tetap buka/tutup seperti sekarang.
10. **Kartu konten hilang saat menyentuh tepi atas.** Prim `art` diberi `h:
    size`, supaya culling `drawContent` (margin 80px) tidak membuang kartu
    152/168px yang masih terlihat.

## Pendekatan yang ditolak
- Poin 2 opsi A (pil selalu di atas bar) dan C (pil memudar): video Apple
  menunjukkan pil akhirnya masuk ke baris, jadi keduanya menyimpang.
- Gerbang dinamis tiap frame untuk poin 2: kurva tetap sudah cukup dan lebih
  mudah diperiksa.

## Risiko
- Kurva morph yang baru bisa terasa lebih cepat di awal; angka 0,6 / 0,7 /
  kubik adalah titik awal, disetel setelah dicek visual.
- Sisa getar saat haptic dimatikan berasal dari peramban/OS dan tidak bisa
  dimatikan halaman (item ditunda).
- Kecepatan animasi ikut tersimpan, jadi set lambat masih lambat saat dibuka
  lagi; tombol Reset mengembalikan ke 1.
