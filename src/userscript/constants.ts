/** Tizen key codes. Arrows, Enter and Back are always delivered to the page;
 *  the media keys are registered by TizenBrew from package.json's "keys". */
export const KEYS = {
  ENTER: 13,
  ESCAPE: 27,
  SPACE: 32,
  BACK: 10009,
  NUM_0: 48,
  NUM_9: 57,
  PLAY_PAUSE: 10252,
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  REWIND: 412,
  FAST_FORWARD: 417,
} as const;

export type Direction = 'left' | 'right' | 'up' | 'down';

export const ARROW: { readonly [code: number]: Direction } = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
};

export const VERSION = '0.1.1';

/** GitHub Pages URL of the instance picker (built from src/picker). */
export const PICKER_URL = 'https://lennartschoch.github.io/invidious-tizen/dist/index.html';
