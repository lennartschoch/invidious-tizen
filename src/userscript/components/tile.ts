import type { FocusRule } from '../navigation/focus';

/** On a listing a video is a tile made of several links to the same content:
 *  the thumbnail, the title, the channel and the little icon actions. The D-pad
 *  wants one stop per tile — the thumbnail — so drop the tile's other links.
 *  A tile is the nearest ancestor holding exactly one `.thumbnail a` (the
 *  related-videos rail is one `.h-box` holding many tiles, so `.h-box` is not
 *  narrow enough). Coupled to Invidious markup. */
const isSecondaryLink = (el: Element): boolean => {
  if (el.tagName !== 'A') return false;
  let tile: Element | null = el.parentElement;
  while (tile && tile !== document.body) {
    const thumbs = tile.querySelectorAll('.thumbnail a[href]');
    if (thumbs.length === 1) return thumbs[0] !== el;
    if (thumbs.length > 1) return false; // several tiles share this ancestor
    tile = tile.parentElement;
  }
  return false;
};

export const tileRule: FocusRule = { skip: isSecondaryLink };
