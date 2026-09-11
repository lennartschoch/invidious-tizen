import { KEYS } from '../constants';
import type { Component } from '../registry';

const TAG = 'data-itv-comment';

/** Invidious comments: each comment row is a `.comments .pure-g` with a direct
 *  `.channel-profile`. Tag it as one stop and skip its inner links; OK opens the
 *  author. Coupled to Invidious markup. */
const prepare = (): void => {
  const rows = document.querySelectorAll('.comments .pure-g');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as HTMLElement;
    if (row.getAttribute(TAG) === '1') continue;
    const kids = row.children;
    let isComment = false;
    for (let j = 0; j < kids.length; j++) {
      if (kids[j].classList.contains('channel-profile')) {
        isComment = true;
        break;
      }
    }
    if (!isComment) continue;
    row.setAttribute(TAG, '1');
    row.setAttribute('tabindex', '0');
  }
};

export const comment: Component = {
  selector: `[${TAG}]`,
  prepare,
  skip: (el) => {
    const root = el.closest(`[${TAG}]`);
    return !!root && root !== el;
  },
  key: (root, code) => {
    if (code !== KEYS.ENTER) return false;
    const author = root.querySelector(
      'a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]',
    ) as HTMLAnchorElement | null;
    if (!author) return false;
    author.click();
    return true;
  },
};
