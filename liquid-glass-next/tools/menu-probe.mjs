const PORT = 9464, sleep = ms => new Promise(r => setTimeout(r, ms));
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
});
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable');
const evalx = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
for (let i = 0; i < 80; i++) { if (await evalx('window.__ready === true')) break; await sleep(200); }
await sleep(500);

// buka menu titik tiga
await evalx(`(() => { window.__api.S.menuOpen = true; window.__api.startLoop(); return true; })()`);
await sleep(350);
const openBefore = await evalx('window.__api.S.menuOpen');
const scrimShown = await evalx(`getComputedStyle(document.querySelector('#menuScrim')).display`);

// klik di luar menu (pointerdown kena scrim)
await evalx(`(() => { document.querySelector('#menuScrim').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true })); return true; })()`);
const timeline = [];
for (let i = 0; i < 20; i++) {
  await sleep(50);
  timeline.push(await evalx(`[Math.round(performance.now()), window.__api.S.menuOpen, document.querySelector('#menuScrim').style.display]`));
}
const openAfter = timeline[timeline.length - 1][1];
const scrimAfter = await evalx(`getComputedStyle(document.querySelector('#menuScrim')).display`);
console.log('TIMELINE (t, menuOpen, inline display):');
for (const row of timeline) console.log('  ', JSON.stringify(row));

// buka lagi, lalu klik item menu -> juga harus nutup
await evalx(`(() => { window.__api.S.menuOpen = true; window.__api.startLoop(); return true; })()`);
await sleep(350);
await evalx(`(() => { document.querySelector('#menu .mi').click(); return true; })()`);
await sleep(350);
const openAfterItem = await evalx('window.__api.S.menuOpen');

console.log('BUKA      -> menuOpen:', openBefore, '| scrim display:', scrimShown);
console.log('KLIK LUAR -> menuOpen:', openAfter, '| scrim:', scrimAfter);
console.log('KLIK ITEM -> menuOpen:', openAfterItem);
const pass = openBefore === true && scrimShown === 'block' && openAfter === false && openAfterItem === false;
console.log('RESULT', pass ? 'PASS: klik luar nutup menu, klik item juga nutup' : 'FAIL');
console.log('ERRORS', JSON.stringify(errors.filter(e => !e.includes('WebGL2'))));
ws.close();
process.exit(pass && !errors.filter(e => !e.includes('WebGL2')).length ? 0 : 1);
