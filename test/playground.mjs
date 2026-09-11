/*
 * Local playground: an interactive, keyboard-only view of the real Chromium 69
 * used by the e2e test.
 *
 *   scripts/chrome69.sh up
 *   npm run playground --instance invidious.example.com
 *   # open http://localhost:7331, click once, then drive with the keyboard
 *
 * It connects to the container over CDP, injects the built userscript at
 * document start, streams the page back with Page.startScreencast, and forwards
 * ONLY your keyboard (arrows, Enter, Space, Escape, and typing) as input events.
 * The mouse never reaches the page, so navigation behaves like the TV remote.
 *
 * Instance: `--instance <host>`, `--instance=<host>`, or a bare host/URL after
 *   `npm run playground --`. Also PLAYGROUND_URL / INVIDIOUS_URL.
 * Env: CDP_URL (else .cdp-url), PORT, BIND.
 */
import fs from 'node:fs';
import http from 'node:http';

const SCRIPT = fs.readFileSync(new URL('../dist/userScript.js', import.meta.url), 'utf8');

/* A real Fullscreen API request from a trusted key event hangs Electron 4 under
 * Xvfb (the renderer stalls), and the streamed view is already the full screen,
 * so emulate fullscreen here instead. This is playground-only: the userscript
 * still uses the real API on the TV. */
const FULLSCREEN_SHIM = `(function () {
  function shim() {
    var p = window.player;
    if (!p) return void setTimeout(shim, 100);
    if (p.__itvFsShim) return;
    p.__itvFsShim = true;
    var on = false;
    function apply() {
      var el = document.querySelector('.video-js');
      if (!el) return;
      if (on) {
        el.classList.add('vjs-fullscreen');
        el.style.cssText += ';position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483646';
      } else {
        el.classList.remove('vjs-fullscreen');
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.height = '';
        el.style.zIndex = '';
      }
    }
    p.requestFullscreen = function () { on = true; apply(); document.dispatchEvent(new Event('fullscreenchange')); };
    p.isFullscreen = function () { return on; };
    p.exitFullscreen = function () { on = false; apply(); document.dispatchEvent(new Event('fullscreenchange')); };
    try {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: function () { return on ? document.querySelector('.video-js') : null; },
      });
    } catch (e) { /* already defined */ }
  }
  shim();
})();`;

/** `--instance host`, `--instance=host`, `-i host`, or npm's space form where
 *  the flag is consumed and only the host is left as a positional argument. */
function instanceArg() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--instance' || a === '-i') return argv[i + 1];
    if (a.startsWith('--instance=')) return a.slice('--instance='.length);
    if (!a.startsWith('-')) return a;
  }
  return '';
}

function targetUrl(value) {
  const v = String(value || '').trim();
  if (!v) return 'https://invidious.tiekoetter.com';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const fromNpm = process.env.npm_config_instance;
const rawTarget =
  (fromNpm && fromNpm !== 'true' ? fromNpm : '') ||
  instanceArg() ||
  process.env.PLAYGROUND_URL ||
  process.env.INVIDIOUS_URL ||
  '';
const TARGET = targetUrl(rawTarget);
const PORT = Number(process.env.PORT || 7331);
const HOST = process.env.BIND || '127.0.0.1';

function resolveCdp() {
  if (process.env.CDP_URL) return process.env.CDP_URL.replace(/\/$/, '');
  try { return fs.readFileSync(new URL('../.cdp-url', import.meta.url), 'utf8').trim(); } catch { return ''; }
}
const CDP = resolveCdp();
if (!CDP) {
  console.error(`No CDP endpoint (would load ${TARGET}). Run scripts/chrome69.sh up first, or set CDP_URL.`);
  process.exit(2);
}

const targets = await (await fetch(`${CDP}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.error('No page target in', CDP);
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
const viewers = new Set();
let lastFrame = '';

function send(method, params = {}, ms = 20000) {
  return new Promise((resolve) => {
    const id = ++seq;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      pending.delete(id);
      resolve({ __timeout: method });
    }, ms);
    pending.set(id, (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

let frames = 0;
let screencastTimer = null;

async function startScreencast() {
  await send('Page.startScreencast', {
    format: 'jpeg',
    quality: 70,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 1,
  });
}

/** A navigation can drop the screencast session, so (re)start it after each
 *  main-frame navigation rather than once at startup. */
function scheduleScreencast() {
  clearTimeout(screencastTimer);
  screencastTimer = setTimeout(() => void startScreencast(), 300);
}

ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); return; }
  if (m.method === 'Page.screencastFrame') {
    frames++;
    if (frames === 1) console.log('[screencast] streaming');
    void send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
    // A static page only emits a frame on paint, so keep the latest one to hand
    // to viewers that connect (or reload) afterwards.
    lastFrame = JSON.stringify({ data: m.params.data });
    const frame = `data: ${lastFrame}\n\n`;
    for (const res of viewers) res.write(frame);
  } else if (m.method === 'Page.frameNavigated' && m.params.frame.parentId === undefined) {
    scheduleScreencast();
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.error('[page]', d?.exception?.description || d?.text || 'exception');
  }
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: FULLSCREEN_SHIM });
await send('Page.addScriptToEvaluateOnNewDocument', { source: SCRIPT });
await send('Page.navigate', { url: TARGET });
scheduleScreencast();

const VIEWER = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invidious TV playground</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: #0f0f0f; color: #eee;
         font: 14px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { display: flex; gap: 16px; align-items: baseline; padding: 10px 16px; background: #1a1a1a; }
  header b { color: #fff; }
  header span { color: #888; }
  #status { margin-left: auto; }
  #status.on { color: #4ade80; }
  #stage { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
  #screen { max-width: 100%; max-height: 100%; background: #000; outline: none; }
  #hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,.72); color: #fff; font-size: 20px; cursor: pointer; }
  #hint.hidden { display: none; }
  kbd { background: #333; border-radius: 4px; padding: 1px 5px; }
</style>
</head>
<body>
  <header>
    <b>Invidious TV playground</b>
    <span><kbd>&#8592;</kbd><kbd>&#8593;</kbd><kbd>&#8595;</kbd><kbd>&#8594;</kbd> D-pad</span>
    <span><kbd>Enter</kbd> OK</span>
    <span><kbd>Space</kbd> play/pause</span>
    <span><kbd>Esc</kbd> Back</span>
    <span id="status">click below to enable the keyboard</span>
  </header>
  <div id="stage">
    <img id="screen" alt="Chromium 69 screencast">
    <div id="hint">Click here, then use your keyboard</div>
  </div>
  <script>
    // NOTE: do not name these locals screen/status/name — those are built-in
    // window properties and a top-level 'var screen' does not shadow them.
    var screenEl = document.getElementById('screen');
    var statusEl = document.getElementById('status');
    var hintEl = document.getElementById('hint');

    function setActive(on) {
      statusEl.className = on ? 'on' : '';
      statusEl.textContent = on ? 'keyboard active' : 'click below to enable the keyboard';
      hintEl.className = on ? 'hidden' : '';
    }
    window.addEventListener('focus', function () { setActive(true); });
    window.addEventListener('blur', function () { setActive(false); });
    hintEl.addEventListener('mousedown', function () { hintEl.className = 'hidden'; window.focus(); });
    setActive(document.hasFocus());

    // Coalesce frames to one paint per animation frame to keep typing snappy.
    var latest = null, scheduled = false;
    new EventSource('/events').onmessage = function (e) {
      latest = JSON.parse(e.data).data;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        screenEl.src = 'data:image/jpeg;base64,' + latest;
        scheduled = false;
      });
    };

    function forward(e, type) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false; // leave OS/browser shortcuts alone
      var payload = { type: type, key: e.key, code: e.code, vk: e.keyCode };
      if (type === 'keyDown' && e.key && e.key.length === 1) payload.text = e.key;
      fetch('/key', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return true;
    }

    document.addEventListener('keydown', function (e) {
      if (!forward(e, 'keyDown')) return;
      e.preventDefault();
      var label = e.key === ' ' ? 'Space' : e.key;
      statusEl.textContent = 'key: ' + label;
    }, true);
    document.addEventListener('keyup', function (e) {
      if (forward(e, 'keyUp')) e.preventDefault();
    }, true);
  </script>
</body>
</html>`;


const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(VIEWER);
    return;
  }
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 1500\n\n');
    if (lastFrame) res.write(`data: ${lastFrame}\n\n`);
    viewers.add(res);
    req.on('close', () => viewers.delete(res));
    return;
  }
  if (req.method === 'POST' && req.url === '/key') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const { type, vk, key, code, text } = JSON.parse(body);
        if (type === 'keyDown' && key === 'Enter') {
          // Enter's default action (form submit / button click) needs a real
          // keypress, which a bare keyDown does not generate.
          await send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: vk,
            nativeVirtualKeyCode: vk,
            key,
            code,
          });
          await send('Input.dispatchKeyEvent', { type: 'char', text: '\r', unmodifiedText: '\r' });
        } else {
          const params = {
            type,
            windowsVirtualKeyCode: vk,
            nativeVirtualKeyCode: vk,
            key,
            code,
          };
          if (text) {
            params.text = text;
            params.unmodifiedText = text;
          }
          await send('Input.dispatchKeyEvent', params);
        }
      } catch { /* ignore malformed input */ }
      res.writeHead(204);
      res.end();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`\nPlayground ready
  display:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}
  loading:  ${TARGET}
  browser:  ${CDP}

Click the screen once, then use the keyboard:
  arrows  D-pad        Enter  OK        Space  play/pause        Esc  Back

Ctrl-C to quit.\n`);
});

// Fire-and-forget: awaiting a CDP reply here can hang SIGINT when the browser
// is busy, so stop the screencast best-effort and exit immediately.
const shutdown = () => {
  try { ws.send(JSON.stringify({ id: ++seq, method: 'Page.stopScreencast' })); } catch { /* ignore */ }
  try { server.close(); } catch { /* ignore */ }
  try { ws.close(); } catch { /* ignore */ }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
