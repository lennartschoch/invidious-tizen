import { KEYS } from '../constants';
import type { KeyContext } from '../registry';
import type { Component } from '../registry';
import { enterFullscreen, isFullscreen, play, revealControls, seekBy, togglePlay } from '../media';

/** The video player is one D-pad stop: its control bar and big play button are
 *  not, so arrows can never clip onto the bottom bar. Arrows steer it, OK
 *  enters fullscreen / toggles playback. Coupled to video.js. */
export const player: Component = {
  selector: '.video-js',
  skip: (el) => {
    const root = el.closest('.video-js');
    return !!root && root !== el;
  },
  key: (root, code, dir, ctx: KeyContext) => {
    if (dir) {
      if (dir === 'left') return seekBy(-10);
      if (dir === 'right') return seekBy(10);
      const vertical = dir === 'up' || dir === 'down';
      return (
        (vertical && !document.fullscreenElement && ctx.moveFocusOutside(root, dir)) ||
        revealControls()
      );
    }
    if (code === KEYS.ENTER) {
      if (document.fullscreenElement || isFullscreen()) return togglePlay();
      enterFullscreen();
      play();
      return true;
    }
    return false;
  },
};
