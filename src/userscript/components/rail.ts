import type { ScopeRule } from '../navigation/focus';

/** A listing grid or the related-videos rail: the nearest ancestor holding
 *  several video thumbnails. Vertical movement sticks to it so the D-pad does
 *  not jump sideways into another column. Coupled to Invidious markup. */
export const railScope: ScopeRule = {
  scope: (el) => {
    let node: Element | null = el.parentElement;
    while (node && node !== document.body) {
      if (node.querySelectorAll('.thumbnail a').length >= 2) return node;
      node = node.parentElement;
    }
    return null;
  },
};
