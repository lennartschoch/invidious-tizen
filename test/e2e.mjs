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

// Video thumbnails are <a href="/watch…" tabindex="-1"> wrapping an <img>.
// A blanket tabindex="-1" filter used to make them unreachable, so assert a
// thumbnail can actually receive focus via the D-pad, not just that *some*
// element can.
const hasThumb = await ev(`(function(){
  var links = document.querySelectorAll('a[href*="/watch"][tabindex="-1"]');
  for (var i = 0; i < links.length; i++) {
    if (links[i].querySelector('img')) { window.__itvThumb = links[i]; return true; }
  }
  return false;
})()`);
check('search page has tabindex="-1" thumbnail links', hasThumb);
await ev('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
let thumbFocused = false;
if (hasThumb) {
  for (let i = 0; i < 30; i++) {
    await press(40, 'ArrowDown');
    await sleep(150);
    if (await ev('document.activeElement === window.__itvThumb')) { thumbFocused = true; break; }
  }
}
check('a video thumbnail link can receive focus', thumbFocused);

// A tile should be one stop: Down from its thumbnail must not land on the
// title, channel or icon links that target the same video.
const secondary = await ev(`(function(){
  var thumb = window.__itvThumb;
  var tile = thumb && thumb.closest('.h-box');
  if (!tile) return -1;
  window.__itvTileOthers = Array.prototype.filter.call(tile.querySelectorAll('a'), function(a){ return a !== thumb; });
  return window.__itvTileOthers.length;
})()`);
check('tile exposes secondary links to skip', secondary > 0, `secondary=${secondary}`);
await press(40, 'ArrowDown');
await sleep(250);
check(
  'Down leaves the tile instead of its title/channel/icons',
  await ev('window.__itvTileOthers.indexOf(document.activeElement) === -1'),
);

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
check(
  'video.js player is promoted to tabindex=0 (D-pad reachable)',
  await ev('(function(){var e=document.querySelector(".video-js");return !!e && e.getAttribute("tabindex") === "0";})()'),
);

await press(13, 'Enter'); // OK on body -> focus the player and start playback
await sleep(600);
const focused = await ev('document.activeElement ? document.activeElement.className : null');
const okPlaying = await ev('document.querySelector("video").paused === false');
check(
  'OK focuses the player and starts playback',
  typeof focused === 'string' && focused.indexOf('video-js') !== -1 && okPlaying,
  `active="${focused}" paused=${!okPlaying}`,
);

await press(53, '5'); // number 5 -> 50%
await sleep(900);
const t50 = await ev('Math.round(document.querySelector("video").currentTime)');
check('number key seeks to ~50%', Math.abs(t50 - dur / 2) <= 6, `t=${t50}s target=${Math.round(dur / 2)}s`);

await press(10252, 'MediaPlayPause'); // pause
await sleep(300);
const pausedNow = await ev('document.querySelector("video").paused');
check('MediaPlayPause pauses', pausedNow === true, `paused=${pausedNow}`);

await press(10252, 'MediaPlayPause'); // resume
await sleep(300);
const resumed = await ev('document.querySelector("video").paused');
check('MediaPlayPause starts playback', resumed === false, `paused=${resumed}`);
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

// OK entered fullscreen (when the environment allows it). Leaving fullscreen
// should hand focus back to the page, and Down should then stay off the player.
await ev('(document.fullscreenElement && document.exitFullscreen) ? document.exitFullscreen() : 0');
await sleep(600);
await ev('(function(){var p=document.querySelector(".video-js"); if(p){p.focus();return true;} return false;})()');
await sleep(100);
await press(40, 'ArrowDown');
await sleep(400);
check(
  'Down leaves the player for the content below',
  await ev('(function(){var a=document.activeElement;return !a || !a.closest || !a.closest(".video-js");})()'),
  await ev('document.activeElement ? document.activeElement.tagName : null'),
);

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
