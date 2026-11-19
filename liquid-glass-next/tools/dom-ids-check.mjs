import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../liquid-glass-ios-kit-v2 (5).html', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('<body>'), src.indexOf('<script>'));
const want = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const page = await (await fetch('http://localhost:3000/')).text();
const have = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const missing = [...want].filter(id => !have.has(id));
console.log('asli:', want.size, '| SSR:', have.size, '| hilang:', JSON.stringify(missing));
process.exit(missing.length ? 1 : 0);
