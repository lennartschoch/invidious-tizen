import type { Direction } from '../constants';

export const isTextInput = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true;
};

/** Whether an arrow key should move focus out of the focused text field rather
 *  than stay for the caret. On a single-line `<input>`: Up/Down always leave
 *  (Invidious autofocuses the search box, which would otherwise trap the D-pad),
 *  and Left/Right leave once the caret is at that edge. Textareas and
 *  contenteditable never yield arrows, so editing keeps working. */
export const inputArrowAllowed = (el: Element, dir: Direction | undefined): boolean => {
  if (el.tagName !== 'INPUT') return false;
  if (dir === 'up' || dir === 'down') return true;
  if (dir !== 'left' && dir !== 'right') return false;
  const input = el as HTMLInputElement;
  try {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const len = (input.value || '').length;
    return dir === 'left' ? start === 0 && end === 0 : start === len && end === len;
  } catch {
    return false;
  }
};
