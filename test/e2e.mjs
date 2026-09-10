/*
 * End-to-end test: loads the real self-hosted Invidious in a genuine Chromium
 * 69 (Electron 4.2.12, H.264-capable) started by scripts/chrome69.sh, injects
 * the built userscript, then drives it with trusted remote-key events and
 * asserts the YouTube-TV-parity behaviour.
 *
 *   scripts/chrome69.sh up
 *   npm run test:e2e
 *
 * Env: CDP_URL (else .cdp-url), INVIDIOUS_URL, TEST_VIDEO.
 */
import fs from 'node:fs';

const SCRIPT = fs.readFileSync(new URL('../dist/userScript.js', import.meta.url), 'utf8');
const INVIDIOUS = (process.env.INVIDIOUS_URL || 'https://invidious.tiekoetter.com').replace(/\/$/, '');
const VIDEO = process.env.TEST_VIDEO || 'dQw4w9WgXcQ';

function resolveCdp() {
  if (process.env.CDP_URL) return process.env.CDP_URL.replace(/\/$/, '');
  try { return fs.readFileSync(new URL('../.cdp-url', import.meta.url), 'utf8').trim(); } catch { return ''; }
}
const CDP = resolveCdp();
if (!CDP) {
  console.error('No CDP endpoint. Run scripts/chrome69.sh up first, or set CDP_URL.');
  process.exit(2);
}

const results = [];
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`${CDP}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('no page target in', CDP); process.exit(2); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0; const pend = new Map(); const exceptions = [];
function send(method, params = {}, ms = 20000) {
  return new Promise((res) => {
    const id = ++seq; let done = false;
    const to = setTimeout(() => { if (!done) { done = true; pend.delete(id); res({ __timeout: method }); } }, ms);
    pend.set(id, (v) => { if (!done) { done = true; clearTimeout(to); res(v); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); return; }
  if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
};
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r?.__timeout ? undefined : r?.result?.value; }
async function press(vk, key) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, key, code: key });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, key, code: key });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: SCRIPT });

// ---- browse navigation ----
await send('Page.navigate', { url: `${INVIDIOUS}/search?q=test` });
await sleep(8000);
check('userscript loads on browse', await ev('!!window.__invidiousTizen'));
check('focus style injected', await ev("!!document.getElementById('itv-style')"));
const before = await ev('document.activeElement ? document.activeElement.tagName : null');
await press(40, 'ArrowDown');
await sleep(500);
const after = await ev('document.activeElement ? (document.activeElement.tagName + "|" + (document.activeElement.getAttribute("href") || "")) : null');
check('ArrowDown moves focus off body', before === 'BODY' && !!after && after !== 'BODY', `${before} -> ${after}`);

// ---- watch page / player ----
await send('Page.navigate', { url: `${INVIDIOUS}/watch?v=${VIDEO}` });
for (let i = 0; i < 20; i++) {
  if (await ev('!!window.player && !!document.querySelector("video")')) break;
  await sleep(1000);
}
let dur = 0;
for (let i = 0; i < 25; i++) {
  dur = await ev('(function(){var v=document.querySelector("video");return v && isFinite(v.duration) ? Math.round(v.duration) : 0;})()');
  if (dur > 0) break;
  await sleep(1000);
}
check('watch page has a player with duration', dur > 0, `duration=${dur}s`);

await press(13, 'Enter'); // OK on body -> hand control to the player
await sleep(500);
const focused = await ev('document.activeElement ? document.activeElement.className : null');
check('OK hands control to the player', typeof focused === 'string' && focused.indexOf('video-js') !== -1, `active="${focused}"`);

await press(53, '5'); // number 5 -> 50%
await sleep(900);
const t50 = await ev('Math.round(document.querySelector("video").currentTime)');
check('number key seeks to ~50%', Math.abs(t50 - dur / 2) <= 6, `t=${t50}s target=${Math.round(dur / 2)}s`);

await press(10252, 'MediaPlayPause');
const paused = await ev('document.querySelector("video").paused');
check('MediaPlayPause starts playback', paused === false, `paused=${paused}`);
// software decode under Rosetta is slow to fill the buffer, so poll.
let tPlay = t50, advanced = false;
for (let i = 0; i < 20; i++) {
  await sleep(700);
  tPlay = await ev('Math.round(document.querySelector("video").currentTime)');
  if (tPlay > t50 + 1) { advanced = true; break; }
}
check('playback advances', advanced, `${t50}s -> ${tPlay}s`);

await press(39, 'ArrowRight'); // seek +10s while the player has focus
await sleep(1500);
const tSeek = await ev('Math.round(document.querySelector("video").currentTime)');
check('ArrowRight seeks forward', tSeek >= tPlay + 5, `${tPlay}s -> ${tSeek}s`);

// ---- preferences: injected "Invidious Tizen" section ----
await send('Page.navigate', { url: `${INVIDIOUS}/preferences` });
await sleep(7000);
check('preferences: Invidious Tizen section injected', await ev("!!document.getElementById('itv-prefs')"));
check('preferences: open-picker button present', await ev("!!document.getElementById('itv-picker-open')"));

// ---- report ----
console.log(`\nE2E against ${INVIDIOUS}\nvia ${CDP}\n`);
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
ws.close();
process.exit(failed ? 1 : 0);
