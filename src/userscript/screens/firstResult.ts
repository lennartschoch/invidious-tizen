import { components } from '../components';
import { focusables } from '../navigation/focus';

/** The listing grid: the nearest ancestor holding several video thumbnails. */
const gridOf = (el: Element): Element | null => {
  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    if (node.querySelectorAll('.thumbnail a').length >= 2) return node;
    node = node.parentElement;
  }
  return null;
};

/** The first result on a listing, whatever it is (channel card, playlist, video,
 *  ...): the first D-pad stop inside the results grid, so a listing screen opens
 *  on its first item. */
export const firstResult = (): HTMLElement | null => {
  const els = focusables(components);
  let grid: Element | null = null;
  for (let i = 0; i < els.length; i++) {
    if (els[i].matches('.thumbnail a')) {
      grid = gridOf(els[i]);
      break;
    }
  }
  for (let i = 0; i < els.length; i++) {
    if (grid ? grid.contains(els[i]) : els[i].matches('.thumbnail a')) return els[i];
  }
  return null;
};
