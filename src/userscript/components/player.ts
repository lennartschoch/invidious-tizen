import type { FocusRule } from '../navigation/focus';

/** The video player is one D-pad stop: its control bar and big play button are
 *  not, so arrows can never clip onto the bottom bar. Coupled to video.js. */
export const playerRule: FocusRule = {
  skip: (el) => {
    const player = el.closest('.video-js');
    return !!player && player !== el;
  },
};
