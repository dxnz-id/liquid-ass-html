import fs from 'node:fs';
const PORT = 9462, sleep = ms => new Promise(r => setTimeout(r, ms));
let list = [];
for (let i = 0; i < 60; i++) {
  try {
    list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (list.some(t => t.type === 'page' && t.url.startsWith('http://localhost:3000'))) break;
  } catch (e) {}
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
  if (m.method === 'Runtime.consoleAPICalled') { const t = m.params.type; if (t === 'error' || t === 'warning') errors.push(t.toUpperCase() + ' ' + m.params.args.map(a => a.value ?? a.description ?? a.type).join(' ')); }
  if (m.method === 'Log.entryAdded') { const e = m.params.entry; if (e.level === 'error' || e.level === 'warning') errors.push('LOG ' + e.level + ' ' + e.text); }
});
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
let ready = false;
for (let i = 0; i < 80 && !ready; i++) {
  try { const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true }); ready = r.result.value === true; } catch (e) {}
  if (!ready) await sleep(200);
}
await sleep(1200);
const expr = `JSON.stringify((()=>{const g=document.querySelector('#gl'),s=document.querySelector('#src');return{ready:window.__ready===true,fallback:!!document.querySelector('#fallbackCv'),glDisplay:g&&g.style.display,src:s&&s.textContent,tabsFb:!!document.querySelector('#tabsFb'),accHit:!!document.querySelector('#accHit'),menuClass:document.querySelector('#menu').className,canvas:[g&&g.width,g&&g.height]}})())`;
const diag = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(new URL('out/claude-main.png', import.meta.url), Buffer.from(shot.data, 'base64'));
console.log('READY', ready);
console.log('DIAG', diag.result.value);
console.log('ERRORS', JSON.stringify(errors, null, 1));
ws.close();
