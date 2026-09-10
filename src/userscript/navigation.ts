import type { Direction } from './constants';

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[role="button"]';

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
    if (el.getAttribute('tabindex') === '-1') continue;
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

  const origin = centerOf(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === current) continue;
    const s = score(origin, centerOf(el), dir);
    if (s !== null && s < bestScore) {
      bestScore = s;
      best = el;
    }
  }

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
