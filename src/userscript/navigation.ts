import type { Direction } from './constants';

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[role="button"]';
// Invidious marks video thumbnails (and some channel links) tabindex="-1" to
// keep them out of the browser's tab order, but on a TV they are exactly what
// we want to focus. Only skip tabindex="-1" on otherwise non-interactive nodes.
const INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"]';

/** On a listing a video is a tile made of several links to the same content:
 *  the thumbnail, the title, the channel and the little icon actions. The D-pad
 *  wants one stop per tile — the thumbnail — so drop the tile's other links.
 *  Coupled to Invidious markup: a tile is a `.h-box` holding a `.thumbnail a`. */
const isSecondaryLink = (el: Element): boolean => {
  if (el.tagName !== 'A') return false;
  const tile = el.closest('.h-box');
  if (!tile) return false;
  const thumb = tile.querySelector('.thumbnail a[href]');
  return !!thumb && el !== thumb;
};

const isVisible = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return (
    !style || (style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0')
  );
};

const focusables = (): HTMLElement[] => {
  const found = document.querySelectorAll(FOCUSABLE);
  const out: HTMLElement[] = [];
  for (let i = 0; i < found.length; i++) {
    const el = found[i] as HTMLElement;
    if ((el as HTMLButtonElement).disabled) continue;
    if (el.getAttribute('tabindex') === '-1' && !el.matches(INTERACTIVE)) continue;
    if (isSecondaryLink(el)) continue;
    if (isVisible(el)) out.push(el);
  }
  return out;
};

const centerOf = (el: Element): { x: number; y: number } => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Distance score for a candidate in the pressed direction: the primary-axis
 *  gap plus a penalty for cross-axis misalignment, so aligned elements win. */
const score = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  dir: Direction,
): number | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const EPS = 4;
  if (dir === 'left') return dx >= -EPS ? null : from.x - to.x + Math.abs(dy) * 2;
  if (dir === 'right') return dx <= EPS ? null : to.x - from.x + Math.abs(dy) * 2;
  if (dir === 'up') return dy >= -EPS ? null : from.y - to.y + Math.abs(dx) * 2;
  return dy <= EPS ? null : to.y - from.y + Math.abs(dx) * 2;
};

/** Nearest element in `dir` from `origin`, or null. */
const nearest = (
  origin: { x: number; y: number },
  els: HTMLElement[],
  dir: Direction,
): HTMLElement | null => {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    const s = score(origin, centerOf(el), dir);
    if (s !== null && s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  return best;
};

/** Move focus to the nearest focusable element in `dir`. Returns whether focus moved. */
export const moveFocus = (dir: Direction): boolean => {
  const els = focusables();
  if (!els.length) return false;

  const active = document.activeElement;
  const current =
    active && active !== document.body && active !== document.documentElement
      ? (active as HTMLElement)
      : null;
  if (!current) {
    els[0].focus();
    return true;
  }

  const best = nearest(
    centerOf(current),
    els.filter((el) => el !== current),
    dir,
  );
  if (!best) return false;
  best.focus();
  return true;
};

/** Move focus out of `container` to the nearest focusable in `dir`. Lets the
 *  D-pad leave the video player for the page content below it. */
export const moveFocusOutside = (container: Element, dir: Direction): boolean => {
  const els = focusables().filter((el) => !container.contains(el));
  const best = nearest(centerOf(container), els, dir);
  if (!best) return false;
  best.focus();
  return true;
};

/** Keep the focused element on screen. */
export const installFocusScrolling = (): void => {
  document.addEventListener(
    'focusin',
    (e: Event): void => {
      const target = e.target;
      if (!(target instanceof Element) || !target.scrollIntoView) return;
      try {
        target.scrollIntoView({ block: 'center', inline: 'center' });
      } catch {
        /* older engines */
      }
    },
    true,
  );
};

/** After leaving fullscreen, move focus out of the player so the D-pad browses
 *  the page again instead of steering the video. */
export const installFullscreenExitFocus = (): void => {
  const onExit = (): void => {
    if (document.fullscreenElement) return;
    const player = document.querySelector('.video-js');
    const active = document.activeElement;
    if (player && active && player.contains(active)) {
      moveFocusOutside(player, 'down');
    }
  };
  document.addEventListener('fullscreenchange', onExit, false);
  document.addEventListener('webkitfullscreenchange', onExit, false);
};
