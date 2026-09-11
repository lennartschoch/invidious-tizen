import type { Screen } from '../registry';

/** Video details: open on the player so OK starts playback. */
export const watchScreen: Screen = {
  route: /^\/watch/,
  defaultFocus: () => document.querySelector('.video-js') as HTMLElement | null,
};
