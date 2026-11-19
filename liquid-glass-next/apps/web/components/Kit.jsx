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
  return (
    <>

<div className="phone dark" id="phone">
  <pre id="hud"></pre>
  <canvas id="gl" layoutsubtree="">
    <div id="page" drawable=""><div id="pageInner"></div></div>
  </canvas>
  <div id="hit"></div>
  <div className="status"><span>9:41</span><span className="ic">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="19" height="8" rx="2.2" fill="currentColor"/></svg></span></div>

  <div id="topTitle" className="abs"><span className="tt">Library</span></div>
  <div id="topBack" className="abs center"></div>
  <div id="topActions" className="abs"></div>

  <div id="acc" className="abs">
    <div className="art"></div>
    <div className="meta"><div className="t">Midnight Static</div><div className="a">Nova Reyes</div></div>
    <button id="accPlay" aria-label="Play/Pause"></button>
    <button id="accNext" aria-label="Next"></button>
  </div>
  <div id="inlineIcon" className="abs center"></div>
  <div id="searchIcon" className="abs center"></div>

  <div id="tabHit" className="hit"></div>
  <button id="searchHit" className="hit" aria-label="Search"></button>
  <div id="a11y" role="region" aria-label="Settings controls"></div>
  <div id="a11yTabs" role="tablist" aria-label="Main sections"></div>
  <div id="tabFocus"></div>
  <button id="hitBack" className="hit" aria-label="Back"></button><button id="hitShare" className="hit" aria-label="Share"></button><button id="hitMore" className="hit" aria-label="More" aria-haspopup="menu" aria-expanded="false"></button>
  <div id="menuScrim"></div>
  <div id="menu" className="abs" role="menu"><div className="mc">
    <button className="mi" role="menuitem"><span data-i="share"></span>Share</button>
    <button className="mi" role="menuitem"><span data-i="library"></span>Add to Library</button>
    <button className="mi" role="menuitem"><span data-i="explore"></span>Go to Album</button>
    <button className="mi sep" id="miSettings" role="menuitem"><span data-i="person"></span>Settings</button>
  </div></div>
  <div className="home"></div>
</div>

<button id="gear" aria-label="Pengaturan">⚙</button>
<aside className="panel" id="panel">
  <h1>Liquid Glass — iOS navigation kit v2</h1>
  <p>Scroll / seret konten ke bawah: bar menciut jadi satu baris (ambang 50dp, seperti <code>FloatingTabBarScrollConnection</code>). Scroll balik atau tap tab inline untuk membuka. Tap atau geser pill tab untuk melihat lensa.</p>
  <p>Sumber backdrop: <span id="src">…</span></p>
  <p>Renderer: <select id="selR"><option value="auto">Auto (WebGL2 → Canvas)</option><option value="webgpu">WebGPU</option><option value="webgl2">WebGL2</option><option value="canvas">Canvas 2D</option></select> <small>(memuat ulang halaman)</small></p>
  <div className="btns"><button id="bTheme">Tema: gelap</button><button id="bReset">Reset ke nilai BitChord</button></div>
  <div id="ctrls"></div>
  <p style={{ marginTop: '12px' }}>Kontrol yang sama juga ada di app: titik tiga → Settings → Appearance. Keduanya saling tersinkron.</p>
  <div className="map">
    <b>Diport dari BitChord:</b> struktur GlassNavBar (accessory + pill tab + lingkaran Search, 62dp/48dp, gutter 19/28, spasi 8/14),
    morph expanded↔inline, GlassPillMotion (spring travel/lift/material, squash dari akselerasi, handover, drag), lensa pill yang
    membiaskan page + glass bar + baris tab, rim/shadow pill, top controls 44dp + garis tepi 0,5dp, scrim bawah, blur tepi atas.<br /><br />
    <b>Renderer & fallback:</b> pilih di panel ini atau Settings → Renderer; pilihan disimpan dan halaman dimuat ulang.
    <i>Auto</i> (bawaan) = WebGL2, lalu Canvas 2D bila gagal. Rantai penuh: <b>WebGPU → WebGL2 → Canvas 2D</b>; tiap tingkat yang gagal turun satu tingkat, dan baris “Sumber backdrop” menunjukkan renderer yang sedang aktif.<br />
    • <b>WebGPU</b> (manual): port 1:1 dari pipeline WebGL2 ke WGSL (blur progresif, compose, blur Gaussian, lensa glass, shadow, touch glow, lensa pill). Daftar apa yang digambar dipakai bersama dengan WebGL2. Auto tidak memilihnya. Bila <code>navigator.gpu</code>/adapter/shader/device gagal atau device hilang, halaman dimuat ulang dengan flag sesi <code>lgSkipGPU</code> dan lanjut ke WebGL2 (tanpa loop; memilih WebGPU lagi menghapus flag). Tanpa HTML-in-Canvas.<br />
    • <b>WebGL2</b>: pipeline glass penuh. Gagal bila tidak tersedia, shader/GL error, konteks hilang, atau layar kosong padahal konten ada (selfCheck) → Canvas 2D.<br />
    • <b>Canvas 2D</b>: replika halaman + bar HTML dengan blur CSS, tanpa lensa/refraksi; juga bisa dipilih manual.<br />
    • Terpisah dari renderer: sumber backdrop <i>HTML-in-Canvas</i> (DOM live, hanya WebGL2; WebGPU memakai replika canvas) yang jatuh ke replika canvas bila tidak merespons atau gagal.<br /><br />
    <b>Sentuh & menu (tebakan):</b> dokumentasi hanya menyebut scale saat ditekan, bounce, shimmer, cahaya dari titik sentuh yang merambat ke glass di dekatnya, dan menu yang morph keluar dari tombol. Angkanya tidak dipublikasikan, jadi semua slider berlabel “tebakan” sampai diukur dari rekaman iPhone.<br /><br /><b>Masih pendekatan:</b> blur progresif tepi atas (Haze) saya tiru dengan campuran blur sigma 24 + kurva easing; tepi kiri-kanan blur di Android di-clamp ke rect elemen, di sini tidak; ikon memakai gaya SF Symbols, bukan Material Rounded.<br /><br />
    Shader: Kyant0/backdrop (Apache-2.0). Angka, layout & teks: BitChord (GPL-3.0), jadi file ini turunan GPL-3.0 (perlu verifikasi hukum).
  </div>
</aside>
    </>
  );
}
