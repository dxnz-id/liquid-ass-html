import fs from 'node:fs';
const PORT = 9463, sleep = ms => new Promise(r => setTimeout(r, ms));
let list = [];
for (let i = 0; i < 60; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.some(t => t.type === 'page' && t.url.startsWith('http://localhost:3000'))) break; } catch (e) {}
  await sleep(250);
}
const target = list.find(t => t.type === 'page' && t.url.startsWith('http://localhost:3000'));
if (!target) { console.error('NO_TARGET'); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errors.push(m.params.type + ' ' + m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
});
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Log.enable');
const evalx = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
for (let i = 0; i < 80; i++) { if (await evalx('window.__ready === true')) break; await sleep(200); }
await sleep(600);

// recorder: sample #acc top/width every frame
await evalx(`(() => { window.__fs = []; const el = document.querySelector('#acc');
  (function rec(){ window.__fs.push([performance.now(), parseFloat(el.style.top)||0, parseFloat(el.style.width)||0]); requestAnimationFrame(rec); })();
  return true; })()`);
await sleep(300);
const base = await evalx(`(() => { const f = window.__fs; return { t0: f[0][0], top: f[f.length-1][1], w: f[f.length-1][2] }; })()`);

// collapse
await evalx(`(() => { window.__t0 = performance.now(); window.__api.S.inline = true; window.__api.startLoop(); return true; })()`);
await sleep(700);
const afterCol = await evalx(`(() => { const f = window.__fs; return { top: f[f.length-1][1], w: f[f.length-1][2] }; })()`);

// expand (the phase the user complained about)
await evalx(`(() => { window.__t1 = performance.now(); window.__api.S.inline = false; window.__api.startLoop(); return true; })()`);
await sleep(700);
const all = await evalx('window.__fs');
const afterExp = all[all.length - 1];
const t1 = await evalx('window.__t1');

const exp = all.filter(s => s[0] >= t1 - 16);  // expand window only (1 frame margin)

const dTop = [], dW = [];
for (let i = 1; i < exp.length; i++) { dTop.push(exp[i][1] - exp[i - 1][1]); dW.push(exp[i][2] - exp[i - 1][2]); }
const maxJump = (arr) => { let m = 0, mi = 0; for (let i = 1; i < arr.length; i++) { const d = Math.abs(arr[i] - arr[i - 1]); if (d > m) { m = d; mi = i; } } return [m, mi]; };
const [topJump, tjI] = maxJump(dTop), [wJump, wjI] = maxJump(dW);
// first frame width moves meaningfully
let wFirst = dW.findIndex(d => Math.abs(d) > 0.4);
const topTravelAtWFirst = wFirst < 0 ? NaN : (exp[0][1] - exp[wFirst][1]) / (afterCol.top - afterExp.top || 1);
// dead frames: both static but not settled
const settledT = Math.abs(exp[exp.length - 1][1] - afterExp[1]) < 0.5;
let dead = 0, maxDead = 0;
for (let i = 0; i < dTop.length; i++) {
  const unfinished = Math.abs(exp[i + 1][1] - afterExp[1]) > 1 || Math.abs(exp[i + 1][2] - afterExp[2]) > 1;
  if (unfinished && Math.abs(dTop[i]) < 0.3 && Math.abs(dW[i]) < 0.3) { dead++; maxDead = Math.max(maxDead, dead); } else dead = 0;
}
console.log('BASE   ', JSON.stringify(base));
console.log('COLLAPSE', JSON.stringify(afterCol), '(top naik + width turun = benar)');
console.log('EXPAND  final', JSON.stringify({ top: afterExp[1], w: afterExp[2] }), 'roundtrip_ok=', Math.abs(afterExp[1] - base.top) < 1 && Math.abs(afterExp[2] - base.w) < 1);
console.log('EXPAND  max dTop/frame=', topJump.toFixed(1), 'px @frame', tjI, '| max dW/frame=', wJump.toFixed(1), 'px @frame', wjI);
console.log('EXPAND  width mulai bergerak di frame', wFirst, '| top travel saat itu =', (topTravelAtWFirst * 100).toFixed(0) + '%');
console.log('EXPAND  max dead-frame berturut (belum settle, dua-duanya diam) =', maxDead);
console.log('ERRORS', JSON.stringify(errors.filter(e => !e.includes('WebGL2'))));
fs.writeFileSync(new URL('out/fold-samples.json', import.meta.url), JSON.stringify({ base, afterCol, exp }));
ws.close();
