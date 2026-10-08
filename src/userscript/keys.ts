import { components } from './components';
import { isTextInput } from './components/input';
import { ARROW, KEYS, PICKER_URL } from './constants';
import {
  enterFullscreen,
  exitFullscreen,
  focusPlayer,
  hasMedia,
  isFullscreen,
  pausePlayback,
  play,
  seekBy,
  seekPercent,
  togglePlay,
} from './media';
import { moveFocus, moveFocusOutside } from './navigation';
import type { KeyContext } from './registry';

const isActivatable = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'a' ||
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    el.getAttribute('role') === 'button'
  );
};

/** Base OK when no component handles it: activate the focused element, or hand
 *  a watch page to the player and start fullscreen playback. */
const onEnter = (): boolean => {
  if (isActivatable(document.activeElement)) return false; // let the browser activate it
  if (document.fullscreenElement || isFullscreen()) return togglePlay();
  if (!hasMedia()) return false;
  focusPlayer();
  enterFullscreen();
  play();
  return true;
};

/** Would popping one history entry stay on this instance?
 *
 *  The referrer says where this page was loaded from, and it survives a history
 *  restore, so a page reached with Back still reports the picker or TizenBrew
 *  when the instance was entered through it. That page is the instance's front
 *  door, and popping history from there drifts off the instance — onto the
 *  picker's loading state, which answers by bouncing forward again.
 *  `history.length` cannot answer this: it counts the whole list, not the
 *  current position within it.
 */
/* Invidious serves `referrer-policy: same-origin` or `strict-origin-when-cross-
 * origin`; both keep the referrer for same-origin hops (as an origin, which is
 * all this compares) and still report the picker on the hop in, so the check
 * holds on a real instance. Should a webview strip it entirely, an empty referrer
 * counts as the front door: Back then opens the chooser rather than drifting onto
 * the loader — a blunt answer, but never a dead end.
 */
const atInstanceFrontDoor = (): boolean => {
  try {
    const ref = document.referrer;
    return !ref || new URL(ref).origin !== window.location.origin;
  } catch {
    return true;
  }
};

/** Hand the remote to the picker chooser. A forward navigation to `?pick=1`, so
 *  it works whatever the history looks like and can never land on the loader.
 *  Back from the chooser pops to this page again.
 */
const openPicker = (): boolean => {
  window.location.href = `${PICKER_URL}?pick=1`;
  return true;
};

/** Back: leave fullscreen; walk history while inside the instance; open the
 *  picker chooser at its front door; exit the app only with nowhere left to go. */
const handleBack = (): boolean => {
  if (exitFullscreen()) return true;
  const canPop = !!(window.history && window.history.length > 1);
  if (canPop && !atInstanceFrontDoor()) {
    window.history.back();
    return true;
  }
  if (canPop) return openPicker();
  try {
    if (typeof tizen !== 'undefined' && tizen && tizen.application) {
      tizen.application.getCurrentApplication().exit();
      return true;
    }
  } catch {
    /* not on Tizen */
  }
  return false;
};

const onKeyDown = (e: KeyboardEvent): void => {
  // The instance picker page handles its own keys.
  if (window.__invidiousPicker) return;

  const code = e.keyCode;
  const dir = ARROW[code];
  const active = document.activeElement;
  const ctx: KeyContext = { moveFocus, moveFocusOutside };

  // A component whose selector contains the focused element gets first refusal.
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const root = active && active.closest ? active.closest(c.selector) : null;
    if (root && c.key && c.key(root, code, dir, ctx)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  // Base. While typing, leave the TV keyboard alone — only Back gets through.
  if (isTextInput(active) && code !== KEYS.BACK) return;

  let handled: boolean;
  if (dir) {
    handled = moveFocus(dir);
  } else {
    switch (code) {
      case KEYS.ESCAPE:
      case KEYS.BACK:
        handled = handleBack();
        break;
      case KEYS.ENTER:
        handled = onEnter();
        break;
      case KEYS.SPACE:
      case KEYS.PLAY_PAUSE:
      case KEYS.PLAY:
        handled = togglePlay();
        break;
      case KEYS.PAUSE:
      case KEYS.STOP:
        handled = pausePlayback();
        break;
      case KEYS.REWIND:
        handled = seekBy(-10);
        break;
      case KEYS.FAST_FORWARD:
        handled = seekBy(10);
        break;
      default:
        handled = code >= KEYS.NUM_0 && code <= KEYS.NUM_9 ? seekPercent(code - KEYS.NUM_0) : false;
    }
  }

  if (handled) {
    e.preventDefault();
    e.stopPropagation();
  }
};

export const installKeyHandler = (): void => {
  document.addEventListener('keydown', onKeyDown, true);
};
