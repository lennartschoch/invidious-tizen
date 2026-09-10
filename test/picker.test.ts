import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../src/picker/index.html', import.meta.url), 'utf8');
const STORE_KEY = 'invidious-tizen.instance';

function load(): any {
  // jsdom can't navigate; location.replace is a no-op we don't need.
  return new JSDOM(HTML, {
    url: 'https://picker.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  }).window;
}

describe('instance picker', () => {
  it('marks itself and renders preset instances', () => {
    const win = load();
    expect(win.__invidiousPicker).toBe(true);
    const buttons = win.document.querySelectorAll('#presets button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('first launch shows the picker, not a loading state', () => {
    const win = load();
    expect(win.document.getElementById('picker').hidden).toBe(false);
    expect(win.document.getElementById('loading').hidden).toBe(true);
    expect(win.document.getElementById('status').textContent).toBe('Choose an instance');
  });

  it('moves focus with the D-pad', () => {
    const win = load();
    const buttons = Array.from(win.document.querySelectorAll('#presets button')) as any[];
    win.Element.prototype.getBoundingClientRect = function (this: any) {
      const i = buttons.indexOf(this);
      const y = i * 60;
      return { x: 0, y, left: 0, top: y, width: 400, height: 40, right: 400, bottom: y + 40 };
    };
    const press = (code: number): boolean => {
      const e = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'keyCode', { get: () => code });
      win.document.dispatchEvent(e);
      return e.defaultPrevented;
    };

    expect(win.document.activeElement).toBe(buttons[0]);
    expect(press(40)).toBe(true); // ArrowDown
    expect(win.document.activeElement).toBe(buttons[1]);
  });

  it('does not hijack arrows while typing in the URL box', () => {
    const win = load();
    const input = win.document.getElementById('url');
    input.focus();
    const e = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => 40 });
    win.document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(win.document.activeElement).toBe(input);
  });

  it('goes back toward TizenBrew when there is history', () => {
    const win = load();
    win.history.pushState({}, '', '/?hop=1');
    const back = vi.fn();
    win.history.back = back;
    const exit = vi.fn();
    win.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    const e = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => 10009 });
    win.document.dispatchEvent(e);
    expect(back).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it('exits the Tizen app on Back when there is no history', () => {
    const win = load();
    const exit = () => {
      win.__exited = true;
    };
    win.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    const e = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => 10009 });
    win.document.dispatchEvent(e);
    expect(win.__exited).toBe(true);
    expect(e.defaultPrevented).toBe(true);
  });

  it('saves a preset when chosen', () => {
    const win = load();
    win.document.querySelectorAll('#presets button')[0].click();
    expect(win.localStorage.getItem(STORE_KEY)).toMatch(/^https:\/\//);
  });

  it('normalizes a custom URL', () => {
    const win = load();
    win.document.getElementById('url').value = 'invidious.example.com';
    win.document
      .getElementById('custom')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    expect(win.localStorage.getItem(STORE_KEY)).toBe('https://invidious.example.com/');
  });

  it('?pick=1 shows the picker even when an instance is saved', () => {
    const win: any = new JSDOM(HTML, {
      url: 'https://picker.test/?pick=1',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      beforeParse(w: any) {
        w.localStorage.setItem(STORE_KEY, 'https://saved.example/');
      },
    }).window;
    expect(win.document.getElementById('status').textContent).toBe('Choose an instance');
  });

  it('prefills the URL box with the saved instance when the picker is forced', () => {
    const win: any = new JSDOM(HTML, {
      url: 'https://picker.test/?pick=1',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      beforeParse(w: any) {
        w.localStorage.setItem(STORE_KEY, 'https://saved.example/');
      },
    }).window;
    expect(win.document.getElementById('url').value).toBe('https://saved.example/');
  });

  it('?instance= saves the requested instance (from the preferences form)', () => {
    const win: any = new JSDOM(HTML, {
      url: 'https://picker.test/?instance=invidious.example.com',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    }).window;
    expect(win.localStorage.getItem(STORE_KEY)).toBe('https://invidious.example.com/');
  });
});
