import { KEYS } from '../constants';
import type { Component, KeyContext } from '../registry';
import {
  enterFullscreen,
  exitFullscreen,
  hideControls,
  isFullscreen,
  play,
  revealControls,
  seekBy,
  toggleMute,
  togglePlay,
} from '../media';

/** Fullscreen player modes. Non-fullscreen keeps the old simple behaviour. */
type Mode = 'watching' | 'controls' | 'scrub' | 'menu';

const HIDE_MS = 2000;

// Bar items we treat as D-pad stops. Share and playback-rate are excluded (share
// is pointless on a TV; this build's rate menu never opens). Order comes from the
// DOM, so it is always left-to-right.
const ITEMS = [
  '.vjs-play-control',
  '.vjs-volume-panel',
  '.vjs-progress-control',
  '.vjs-captions-button',
  '.vjs-http-source-selector',
  '.vjs-fullscreen-control',
].join(',');

let mode: Mode = 'watching';
let index = 0;
let menuOwner: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const fullscreen = (): boolean => !!document.fullscreenElement || isFullscreen();

const visible = (el: Element | null): el is HTMLElement => {
  if (!el || el.classList.contains('vjs-hidden')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** video.js bar items are a mix of buttons and plain divs/li; promote the
 *  latter to tabindex=-1 so they can take focus from the D-pad. */
const focusEl = (el: HTMLElement | null): void => {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !el.matches('button, a[href], input, select, textarea')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus();
};

const items = (root: Element): HTMLElement[] => {
  // Scope to the bar (some classes also sit on the player root) and keep DOM
  // order so ←/→ runs left-to-right. Some items repeat the class on a wrapper
  // and its inner button (e.g. captions), so drop contained duplicates.
  const bar = root.querySelector('.vjs-control-bar') || root;
  const found = bar.querySelectorAll(ITEMS);
  const out: HTMLElement[] = [];
  for (let i = 0; i < found.length; i++) {
    const el = found[i] as HTMLElement;
    if (!visible(el)) continue;
    let dup = false;
    for (let j = 0; j < out.length; j++) {
      if (out[j].contains(el)) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(el);
  }
  return out;
};

const clearTimer = (): void => {
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = null;
};

const resetTimer = (root: Element): void => {
  clearTimer();
  revealControls(); // also reset video.js' own ~2s inactivity
  hideTimer = setTimeout(() => hide(root), HIDE_MS);
};

const hide = (root: Element): void => {
  clearTimer();
  mode = 'watching';
  menuOwner = null;
  hideControls();
  (root as HTMLElement).focus();
};

const focusItem = (root: Element, next: number): void => {
  const list = items(root);
  if (!list.length) return;
  index = (next + list.length) % list.length;
  focusEl(list[index]);
};

const focusOwner = (root: Element, owner: HTMLElement): void => {
  const list = items(root);
  const at = list.indexOf(owner);
  focusItem(root, at >= 0 ? at : 0);
};

/** Selectable menu options. The captions menu's "Caption settings" entry opens
 *  a big settings dialog, so it is skipped for now. */
const menuItems = (owner: HTMLElement): HTMLElement[] => {
  const all = Array.from(owner.querySelectorAll<HTMLElement>('.vjs-menu-item'));
  return all.filter((el) => visible(el) && !el.classList.contains('vjs-texttrack-settings'));
};

const menuButton = (owner: HTMLElement): HTMLElement | null =>
  owner.querySelector('button') as HTMLElement | null;

const openMenu = (owner: HTMLElement): void => {
  const button = menuButton(owner);
  if (!button) return;
  button.click();
  const options = menuItems(owner);
  if (!options.length) return;
  mode = 'menu';
  menuOwner = owner;
  index = 0;
  focusEl(options[0]);
};

const showControls = (root: Element): void => {
  revealControls();
  mode = 'controls';
  focusItem(root, 0);
  resetTimer(root);
};

const watching = (dir: string | undefined, code: number): boolean => {
  if (dir === 'left') return seekBy(-10);
  if (dir === 'right') return seekBy(10);
  if (dir === 'up') return revealControls();
  if (code === KEYS.ENTER) return togglePlay();
  return false;
};

const controls = (dir: string | undefined, code: number, root: Element): boolean => {
  if (dir === 'left' || dir === 'right') {
    focusItem(root, index + (dir === 'left' ? -1 : 1));
    resetTimer(root);
    return true;
  }
  if (dir === 'up' || dir === 'down') {
    resetTimer(root);
    return true;
  }
  if (code === KEYS.BACK || code === KEYS.ESCAPE) {
    hide(root);
    return true;
  }
  if (code !== KEYS.ENTER) return false;
  const item = items(root)[index];
  if (!item) return false;
  if (item.matches('.vjs-play-control')) {
    togglePlay();
    resetTimer(root);
    return true;
  }
  if (item.matches('.vjs-volume-panel')) {
    toggleMute(); // no slider on TV: the volume icon just mutes/unmutes
    resetTimer(root);
    return true;
  }
  if (item.matches('.vjs-progress-control')) {
    mode = 'scrub';
    focusEl(item);
    resetTimer(root);
    return true;
  }
  if (item.matches('.vjs-fullscreen-control')) {
    exitFullscreen();
    hide(root);
    return true;
  }
  openMenu(item);
  return true;
};

/** Timeline focused: ←/→ skip, Back returns to the bar. The +10/-10 overlay is
 *  suppressed here so it does not cover the bar the user is looking at. */
const scrub = (dir: string | undefined, code: number, root: Element): boolean => {
  if (dir === 'left') {
    seekBy(-10, false);
    resetTimer(root);
    return true;
  }
  if (dir === 'right') {
    seekBy(10, false);
    resetTimer(root);
    return true;
  }
  if (dir === 'up' || dir === 'down') {
    resetTimer(root);
    return true;
  }
  if (code === KEYS.ENTER) {
    mode = 'controls'; // OK again unselects the timeline
    const progress = root.querySelector('.vjs-progress-control') as HTMLElement | null;
    if (progress) focusOwner(root, progress);
    resetTimer(root);
    return true;
  }
  if (code === KEYS.BACK || code === KEYS.ESCAPE) {
    mode = 'controls';
    const progress = root.querySelector('.vjs-progress-control') as HTMLElement | null;
    if (progress) focusOwner(root, progress);
    resetTimer(root);
    return true;
  }
  return false;
};

const menuMode = (dir: string | undefined, code: number, root: Element): boolean => {
  const owner = menuOwner;
  if (!owner) return false;
  const options = menuItems(owner);
  if (dir === 'up' || dir === 'down') {
    if (!options.length) return false;
    index = (index + (dir === 'up' ? -1 : 1) + options.length) % options.length;
    focusEl(options[index]);
    resetTimer(root);
    return true;
  }
  if (dir === 'left' || dir === 'right') {
    resetTimer(root);
    return true;
  }
  if (code === KEYS.ENTER) {
    if (options[index]) options[index].click();
    mode = 'controls';
    menuOwner = null;
    focusOwner(root, owner);
    resetTimer(root);
    return true;
  }
  if (code === KEYS.BACK || code === KEYS.ESCAPE) {
    const button = menuButton(owner);
    if (button) button.click();
    mode = 'controls';
    menuOwner = null;
    focusOwner(root, owner);
    resetTimer(root);
    return true;
  }
  return false;
};

/** The video player is one D-pad stop: its control bar and big play button are
 *  not, so arrows can never clip onto the bottom bar. In fullscreen, Down opens
 *  a bar-navigation mode (←/→ between items, OK activates, 2s auto-hide). */
export const player: Component = {
  selector: '.video-js',
  skip: (el) => {
    const root = el.closest('.video-js');
    return !!root && root !== el;
  },
  key: (root, code, dir, ctx: KeyContext) => {
    if (!fullscreen()) {
      // Non-fullscreen: keep the old behaviour (seek, leave, enter fullscreen).
      mode = 'watching';
      clearTimer();
      if (dir) {
        if (dir === 'left') return seekBy(-10);
        if (dir === 'right') return seekBy(10);
        const vertical = dir === 'up' || dir === 'down';
        return (vertical && ctx.moveFocusOutside(root, dir)) || revealControls();
      }
      if (code === KEYS.ENTER) {
        enterFullscreen();
        play();
        return true;
      }
      return false;
    }
    if (mode === 'watching') {
      if (dir === 'down') {
        showControls(root);
        return true;
      }
      return watching(dir, code);
    }
    if (dir || code === KEYS.ENTER || code === KEYS.BACK || code === KEYS.ESCAPE) {
      resetTimer(root);
    }
    switch (mode) {
      case 'controls':
        return controls(dir, code, root);
      case 'scrub':
        return scrub(dir, code, root);
      case 'menu':
        return menuMode(dir, code, root);
      default:
        return false;
    }
  },
};
