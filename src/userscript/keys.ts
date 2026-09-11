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
 *  A real player control (big play button, control bar) is left to the browser,
 *  except the play overlay which also goes fullscreen. */
const onEnter = (): boolean => {
  const active = document.activeElement;
  if (active && active.closest && active.closest('.vjs-big-play-button')) {
    enterFullscreen();
    play();
    return true;
  }
  if (isActivatable(active)) return false; // let the browser activate it
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
  const dir = ARROW[code];
  // While typing, leave the TV keyboard alone — except Back, and Up/Down on a
  // single-line input, which Invidious autofocuses on the home/search pages and
  // would otherwise trap the D-pad there. Left/Right stay for the caret.
  const active = document.activeElement;
  if (isTextInput(active) && code !== KEYS.BACK) {
    const singleLine = !!active && active.tagName === 'INPUT';
    if (!(singleLine && (dir === 'up' || dir === 'down'))) return;
  }

  let handled: boolean;
  if (dir) {
    if (inPlayerContext()) {
      const player = document.querySelector('.video-js');
      const vertical = dir === 'up' || dir === 'down';
      const leave =
        vertical && !document.fullscreenElement && player ? moveFocusOutside(player, dir) : false;
      handled =
        dir === 'left' ? seekBy(-10) : dir === 'right' ? seekBy(10) : leave || revealControls();
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
