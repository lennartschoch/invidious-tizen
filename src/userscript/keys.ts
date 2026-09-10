import { ARROW, KEYS } from './constants';
import {
  enterFullscreen,
  exitFullscreen,
  focusPlayer,
  hasMedia,
  inPlayerContext,
  isFullscreen,
  pausePlayback,
  play,
  revealControls,
  seekBy,
  seekPercent,
  togglePlay,
} from './media';
import { moveFocus, moveFocusOutside } from './navigation';

const isTextInput = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true;
};

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

/** YouTube TV-style: OK selects a video, so on a watch page it focuses the
 *  player and enters fullscreen playback; in fullscreen it toggles play/pause.
 *  A real player control (big play button, control bar) is left to the browser. */
const onEnter = (): boolean => {
  if (isActivatable(document.activeElement)) return false; // let the browser activate it
  if (document.fullscreenElement || isFullscreen()) return togglePlay();
  if (!hasMedia()) return false;
  focusPlayer();
  enterFullscreen();
  play();
  return true;
};

/** Back: leave fullscreen, else walk history back toward TizenBrew's module
 *  list, else exit the app once there is nowhere left to go. */
const handleBack = (): boolean => {
  if (exitFullscreen()) return true;
  if (window.history && window.history.length > 1) {
    window.history.back();
    return true;
  }
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
  // Let the TV keyboard work; only Back is intercepted while typing.
  if (isTextInput(document.activeElement) && code !== KEYS.BACK) return;

  let handled: boolean;
  const dir = ARROW[code];
  if (dir) {
    if (inPlayerContext()) {
      const player = document.querySelector('.video-js');
      const leaveDown =
        dir === 'down' && !document.fullscreenElement && player
          ? moveFocusOutside(player, 'down')
          : false;
      handled =
        dir === 'left' ? seekBy(-10) : dir === 'right' ? seekBy(10) : leaveDown || revealControls();
    } else {
      handled = moveFocus(dir);
    }
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
