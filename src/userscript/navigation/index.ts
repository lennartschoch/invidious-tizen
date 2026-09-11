import { focusRules, scopeRules } from '../components';
import type { Direction } from '../constants';
import { focusables } from './focus';
import { nearest } from './geometry';

/** The movement scope for `el` (e.g. a listing grid / related-videos rail). */
const resolveScope = (el: Element): Element | null => {
  for (let i = 0; i < scopeRules.length; i++) {
    const scope = scopeRules[i].scope(el);
    if (scope) return scope;
  }
  return null;
};

/** Move focus to the nearest focusable element in `dir`. Returns whether focus moved. */
export const moveFocus = (dir: Direction): boolean => {
  const els = focusables(focusRules);
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

  const pool = els.filter((el) => el !== current);

  if (dir === 'up' || dir === 'down') {
    const scope = resolveScope(current);
    if (scope) {
      const bestInScope = nearest(
        current.getBoundingClientRect(),
        current,
        pool.filter((el) => scope.contains(el)),
        dir,
      );
      if (bestInScope) {
        bestInScope.focus();
        return true;
      }
    }
  }

  const best = nearest(current.getBoundingClientRect(), current, pool, dir);
  if (!best) return false;
  best.focus();
  return true;
};

/** Move focus out of `container` to the nearest focusable in `dir`. Lets the
 *  D-pad leave the video player for the page content around it. */
export const moveFocusOutside = (container: Element, dir: Direction): boolean => {
  const els = focusables(focusRules).filter((el) => !container.contains(el));
  const best = nearest(container.getBoundingClientRect(), null, els, dir);
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
