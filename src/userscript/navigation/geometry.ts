import type { Direction } from '../constants';

/** Distance score for a candidate in the pressed direction: the primary-axis
 *  gap plus a penalty for cross-axis misalignment, so aligned elements win. */
export const score = (
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

/** A candidate must genuinely overlap the current element on the cross axis,
 *  otherwise a tab/header that merely touches the row gets picked when a row or
 *  column ends. */
export const crosses = (from: DOMRect, to: DOMRect, dir: Direction): boolean => {
  if (dir === 'left' || dir === 'right') {
    return Math.min(from.bottom, to.bottom) > Math.max(from.top, to.top);
  }
  return Math.min(from.right, to.right) > Math.max(from.left, to.left);
};

/** Nearest element in `dir` from `from`, or null. */
export const nearest = (
  from: DOMRect,
  exclude: Element | null,
  els: HTMLElement[],
  dir: Direction,
): HTMLElement | null => {
  const origin = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === exclude) continue;
    const rect = el.getBoundingClientRect();
    if (!crosses(from, rect, dir)) continue;
    const s = score(origin, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, dir);
    if (s !== null && s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  return best;
};
