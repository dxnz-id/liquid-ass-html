import fs from 'node:fs';
const PORT = 9463, sleep = ms => new Promise(r => setTimeout(r, ms));
let list = [];
for (let i = 0; i < 60; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.some(t => t.type === 'page' && t.url.startsWith('http://localhost:3000'))) break; } catch (e) {}
  await sleep(250);
}
const target = list.find(t => t.type === 'page' && t.url.startsWith('http://localhost:3000'));
if (!target) { console.error('NO_TARGET', JSON.stringify(list)); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('ERR ' + m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
});
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable');
let ready = false;
for (let i = 0; i < 80 && !ready; i++) { try { const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true }); ready = r.result.value === true; } catch (e) {} if (!ready) await sleep(200); }
await sleep(800);
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
const before = JSON.parse(await ev(`(()=>{const p=document.querySelector('#accPlay'),n=document.querySelector('#accNext');
const at=r=>{const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e?(e.id||e.className||e.tagName):null};
const rp=p.getBoundingClientRect(),rn=n.getBoundingClientRect();
return JSON.stringify({playAt:at(rp),nextAt:at(rn),playRect:[rp.x,rp.y,rp.width,rp.height],a11yTabsChildren:document.querySelector('#a11yTabs').children.length,tabHitRole:document.querySelector('#tabHit').getAttribute('role'),sel:[...document.querySelector('#a11yTabs').children].map(b=>b.getAttribute('aria-selected')).join(','),playing:window.__api.S.playing,tab:window.__api.S.tab,title:document.querySelector('#acc .t').textContent})})()`));

const [px, py, pw, ph] = before.playRect;
await click(px + pw / 2, py + ph / 2); await sleep(300);
const afterPlay = await ev('window.__api.S.playing');

const nr = JSON.parse(await ev(`(()=>{const r=document.querySelector('#accNext').getBoundingClientRect();return JSON.stringify([r.x,r.y,r.width,r.height])})()`));
await click(nr[0] + nr[2] / 2, nr[1] + nr[3] / 2); await sleep(300);
const afterNext = await ev(`document.querySelector('#acc .t').textContent`);

await ev(`document.querySelector('#a11yTabs').children[0].click()`); await sleep(300);
const afterTab = JSON.parse(await ev(`JSON.stringify({tab:window.__api.S.tab,sel:[...document.querySelector('#a11yTabs').children].map(b=>b.getAttribute('aria-selected')).join(',')})`));

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(new URL('out/fix5-main.png', import.meta.url), Buffer.from(shot.data, 'base64'));
console.log('BEFORE', JSON.stringify(before));
console.log('AFTER_PLAY', afterPlay);
console.log('AFTER_NEXT_TITLE', afterNext);
console.log('AFTER_TAB', JSON.stringify(afterTab));
console.log('ERRORS', JSON.stringify(errors));
ws.close();
