import { showHint } from './hint';

/** A uniform view over whatever is playing: the video.js player when present,
 *  else the raw <video> element. Hides the player/video branching from callers. */
interface Media {
  isPaused(): boolean;
  play(): void;
  pause(): void;
  time(): number;
  seekTo(seconds: number): void;
  duration(): number;
  revealControls(): void;
}

const player = (): VjsPlayer | null => {
  const p = window.player;
  return p && typeof p.play === 'function' ? p : null;
};

const video = (): HTMLVideoElement | null => document.querySelector('video');

const nudgeMouse = (): void => {
  const el = document.querySelector('.video-js') || video();
  if (!el) return;
  try {
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  } catch {
    /* ignore */
  }
};

const media = (): Media | null => {
  const p = player();
  if (p) {
    return {
      isPaused: () => p.paused(),
      play: () => p.play(),
      pause: () => p.pause(),
      time: () => p.currentTime(),
      seekTo: (s) => p.currentTime(s < 0 ? 0 : s),
      duration: () => (typeof p.duration === 'function' ? p.duration() : NaN),
      revealControls: () => {
        if (typeof p.userActive === 'function') p.userActive(true);
        if (typeof p.controls === 'function') p.controls(true);
        nudgeMouse();
      },
    };
  }

  const v = video();
  if (!v) return null;
  return {
    isPaused: () => v.paused,
    play: () => {
      void v.play();
    },
    pause: () => v.pause(),
    time: () => v.currentTime || 0,
    seekTo: (s) => {
      v.currentTime = s < 0 ? 0 : s;
    },
    duration: () => v.duration,
    revealControls: nudgeMouse,
  };
};

export const hasMedia = (): boolean => media() !== null;

export const togglePlay = (): boolean => {
  const m = media();
  if (!m) return false;
  if (m.isPaused()) m.play();
  else m.pause();
  return true;
};

export const pausePlayback = (): boolean => {
  const m = media();
  if (!m) return false;
  m.pause();
  return true;
};

export const seekBy = (delta: number): boolean => {
  const m = media();
  if (!m) return false;
  m.seekTo(m.time() + delta);
  showHint((delta > 0 ? '+ ' : '') + delta + 's');
  return true;
};

/** Number keys jump to a percentage of the video, like YouTube TV (1 = 10%). */
export const seekPercent = (tenths: number): boolean => {
  const m = media();
  if (!m) return false;
  const duration = m.duration();
  if (!duration || !isFinite(duration)) return false;
  m.seekTo((tenths / 10) * duration);
  showHint(Math.round(tenths * 10) + '%');
  return true;
};

/** Reveal the player controls (YouTube TV does this on Up/Down and OK). */
export const revealControls = (): boolean => {
  const m = media();
  if (!m) return false;
  m.revealControls();
  return true;
};

/** True when arrows should steer the player: fullscreen, or focus is on it. */
export const inPlayerContext = (): boolean => {
  if (document.fullscreenElement) return true;
  const el = document.activeElement;
  return !!(el && el.closest && el.closest('.video-js'));
};

export const ensurePlayerFocusable = (): void => {
  const el = document.querySelector('.video-js');
  if (el && !el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
};

export const focusPlayer = (): boolean => {
  const el = (document.querySelector('.video-js') || video()) as HTMLElement | null;
  if (!el) return false;
  if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
  el.focus();
  return true;
};
