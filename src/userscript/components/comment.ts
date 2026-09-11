import type { FocusRule } from '../navigation/focus';

/** Invidious comments: each comment row is a `.comments .pure-g` with a direct
 *  `.channel-profile`. Tag it as one D-pad stop and skip its inner links;
 *  pressing OK then opens the author. Coupled to Invidious markup. */
const tagComments = (): void => {
  const rows = document.querySelectorAll('.comments .pure-g');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as HTMLElement;
    if (row.getAttribute('data-itv-comment') === '1') continue;
    const kids = row.children;
    let isComment = false;
    for (let j = 0; j < kids.length; j++) {
      if (kids[j].classList.contains('channel-profile')) {
        isComment = true;
        break;
      }
    }
    if (!isComment) continue;
    row.setAttribute('data-itv-comment', '1');
    row.setAttribute('tabindex', '0');
  }
};

export const commentRule: FocusRule = {
  prepare: tagComments,
  skip: (el) => {
    const comment = el.closest('[data-itv-comment]');
    return !!comment && comment !== el;
  },
};

/** The author's channel link of the comment containing `el`, or null. */
export const commentAuthor = (el: Element | null): HTMLAnchorElement | null => {
  const comment = el && el.closest ? el.closest('[data-itv-comment]') : null;
  if (!comment) return null;
  return comment.querySelector(
    'a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]',
  ) as HTMLAnchorElement | null;
};
