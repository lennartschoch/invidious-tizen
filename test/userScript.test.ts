import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../dist/userScript.js', import.meta.url), 'utf8');

type Win = any;

// jsdom does not lay anything out, so the userscript's geometric navigation
// needs rects fed in; each fixture element declares them with data-box="x,y,w,h".
function setup(bodyHtml: string, url = 'https://invidious.test/', picker = false): Win {
  const dom = new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const win = dom.window as Win;
  win.Element.prototype.getBoundingClientRect = function (this: any) {
    const p = String((this.getAttribute && this.getAttribute('data-box')) || '0,0,0,0')
      .split(',')
      .map(Number);
    const x = p[0] || 0,
      y = p[1] || 0,
      w = p[2] || 0,
      h = p[3] || 0;
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h };
  };
  if (picker) win.__invidiousPicker = true;
  win.eval(SRC);
  return win;
}

function press(win: Win, code: number, key = ''): boolean {
  const e = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { get: () => code });
  Object.defineProperty(e, 'which', { get: () => code });
  win.document.dispatchEvent(e);
  return e.defaultPrevented;
}

const activeId = (win: Win): string | null => {
  const a = win.document.activeElement;
  return a ? a.id || a.tagName : null;
};

function playerStub(win: Win) {
  const calls: string[] = [];
  const state = { t: 40, paused: true, dur: 200 };
  win.player = {
    play() {
      calls.push('play');
      state.paused = false;
    },
    pause() {
      calls.push('pause');
      state.paused = true;
    },
    paused() {
      return state.paused;
    },
    currentTime(v?: number) {
      if (v === undefined) return state.t;
      calls.push('seek:' + Math.round(v));
      state.t = v;
    },
    duration() {
      return state.dur;
    },
    userActive(v?: boolean) {
      calls.push('userActive:' + !!v);
      return !!v;
    },
    controls(v?: boolean) {
      calls.push('controls:' + !!v);
    },
  };
  return { calls, state };
}

const NAV_HTML = `
  <a id="logo" href="/" data-box="0,0,100,20">logo</a>
  <a id="mid" href="/feed/trending" data-box="0,30,100,20">trending</a>
  <a id="r1" href="/watch?v=1" data-box="0,120,100,100">one</a>
  <a id="r2" href="/watch?v=2" data-box="120,120,100,100">two</a>`;

const INPUT_HTML = `
  <a id="logo" href="/" data-box="0,0,100,20">logo</a>
  <input id="search" data-box="0,30,100,20">
  <a id="r1" href="/watch?v=1" data-box="0,120,100,100">one</a>`;

const WATCH_HTML = `
  <div class="video-js" id="vjs" data-box="0,0,640,360" tabindex="0"></div>
  <video data-box="0,0,640,360"></video>`;

const PREFS_HTML = `
  <div class="h-box">
    <form class="pure-form pure-form-aligned" action="/preferences?referer=%2F">
      <fieldset><legend>Player</legend></fieldset>
    </form>
  </div>`;

describe('injection', () => {
  it('injects the focus style once and is idempotent', () => {
    const win = setup(NAV_HTML);
    expect(win.document.querySelectorAll('#itv-style').length).toBe(1);
    win.eval(SRC); // second injection
    expect(win.document.querySelectorAll('#itv-style').length).toBe(1);
  });

  it('adds the Invidious Tizen section on /preferences', () => {
    const win = setup(PREFS_HTML, 'https://invidious.test/preferences');
    const section = win.document.getElementById('itv-prefs');
    expect(section).not.toBeNull();
    expect(section.querySelector('#itv-picker-open').textContent).toBe('Open instance picker');
  });

  it('does not add the section on other pages', () => {
    const win = setup(PREFS_HTML); // pathname "/"
    expect(win.document.getElementById('itv-prefs')).toBeNull();
  });

  it('does not add the section on the picker page', () => {
    const win = setup(PREFS_HTML, 'https://invidious.test/preferences', true);
    expect(win.document.getElementById('itv-prefs')).toBeNull();
  });
});

describe('instance picker', () => {
  it('leaves key handling to the picker page', () => {
    const win = setup(NAV_HTML);
    win.__invidiousPicker = true;
    expect(press(win, 40)).toBe(false);
    expect(activeId(win)).toBe('BODY');
  });
});

describe('D-pad navigation', () => {
  it('walks the geometry: down, down, down, right', () => {
    const win = setup(NAV_HTML);
    expect(activeId(win)).toBe('BODY');
    press(win, 40);
    expect(activeId(win)).toBe('logo');
    press(win, 40);
    expect(activeId(win)).toBe('mid');
    press(win, 40);
    expect(activeId(win)).toBe('r1');
    press(win, 39);
    expect(activeId(win)).toBe('r2');
  });

  it('does not hijack arrows while typing in an input', () => {
    const win = setup(INPUT_HTML);
    const { calls } = playerStub(win);
    win.document.getElementById('search').focus();
    press(win, 40);
    expect(activeId(win)).toBe('search');
    press(win, 53); // '5'
    expect(calls).toEqual([]);
  });
});

describe('player: YouTube TV parity', () => {
  it('number keys jump to a percentage', () => {
    const win = setup(WATCH_HTML);
    const { state } = playerStub(win);
    win.document.getElementById('vjs').focus();
    press(win, 53); // 5 -> 50%
    expect(state.t).toBe(100);
    press(win, 48); // 0 -> 0%
    expect(state.t).toBe(0);
  });

  it('media play/pause toggles playback', () => {
    const win = setup(WATCH_HTML);
    const { calls, state } = playerStub(win);
    win.document.getElementById('vjs').focus();
    press(win, 10252);
    expect(state.paused).toBe(false);
    press(win, 10252);
    expect(state.paused).toBe(true);
    expect(calls).toEqual(['play', 'pause']);
  });

  it('left/right seek +-10s and rewind/ff do the same', () => {
    const win = setup(WATCH_HTML);
    const { state } = playerStub(win);
    win.document.getElementById('vjs').focus();
    press(win, 39);
    expect(state.t).toBe(50);
    press(win, 412);
    expect(state.t).toBe(40);
  });

  it('up/down reveal controls and never touch volume', () => {
    const win = setup(WATCH_HTML);
    const { calls } = playerStub(win);
    win.document.getElementById('vjs').focus();
    press(win, 38);
    press(win, 40);
    expect(calls).toEqual(['userActive:true', 'controls:true', 'userActive:true', 'controls:true']);
  });

  it('OK on a watch page with nothing focused hands control to the player', () => {
    const win = setup(WATCH_HTML);
    const { calls } = playerStub(win);
    expect(activeId(win)).toBe('BODY');
    press(win, 13);
    expect(activeId(win)).toBe('vjs');
    expect(calls).toContain('userActive:true');
  });

  it('ignores colour keys (no YouTube TV equivalent, not registered)', () => {
    const win = setup(WATCH_HTML);
    const { calls } = playerStub(win);
    win.document.getElementById('vjs').focus();
    for (const code of [403, 404, 405, 406]) {
      expect(press(win, code)).toBe(false);
    }
    expect(calls).toEqual([]);
  });
});

describe('Back precedence', () => {
  it('leaves fullscreen first', () => {
    const win = setup(WATCH_HTML);
    const exit = vi.fn();
    win.document.exitFullscreen = exit;
    Object.defineProperty(win.document, 'fullscreenElement', {
      get: () => win.document.getElementById('vjs'),
      configurable: true,
    });
    press(win, 27);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('goes back through history when not fullscreen', () => {
    const win = setup(WATCH_HTML, 'https://invidious.test/watch?v=1');
    win.history.pushState({}, '', '/watch?v=2'); // history.length now > 1
    const back = vi.fn();
    win.history.back = back;
    press(win, 10009);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('exits the Tizen app at the root', () => {
    const win = setup(WATCH_HTML, 'https://invidious.test/');
    const exit = vi.fn();
    win.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    press(win, 10009);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
