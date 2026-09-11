import { KEYS } from '../constants';
import type { KeyContext } from '../registry';
import type { Component } from '../registry';

export const isTextInput = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true;
};

/** Submit the form a single-line input belongs to (e.g. Invidious' search box),
 *  preferring the form's submit button so its own handlers run. Explicit so OK
 *  works even when the TV's on-screen keyboard swallows Enter. */
const submit = (el: Element): boolean => {
  const input = el as HTMLInputElement;
  const form = input.form || (input.closest('form') as HTMLFormElement | null);
  if (!form) return false;
  const button = form.querySelector(
    'button:not([type]), button[type="submit"], input[type="submit"]',
  ) as HTMLElement | null;
  if (button) {
    button.click();
    return true;
  }
  form.submit();
  return true;
};

/** True when the caret is at `dir`'s edge, so Left/Right may leave the field. */
const caretAtEdge = (input: HTMLInputElement, dir: 'left' | 'right'): boolean => {
  try {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const len = (input.value || '').length;
    return dir === 'left' ? start === 0 && end === 0 : start === len && end === len;
  } catch {
    return false;
  }
};

/** Text fields. On a single-line `<input>`: Up/Down leave (Invidious
 *  autofocuses the search box, which would trap the D-pad), Left/Right leave at
 *  the caret edge, and OK submits the form. Textareas/contenteditable keep all
 *  arrows and Enter for the TV keyboard. */
export const input: Component = {
  selector: 'input, textarea, [contenteditable]',
  key: (root, code, dir, ctx: KeyContext) => {
    const singleLine = root.tagName === 'INPUT';
    if (code === KEYS.ENTER) return singleLine && submit(root);
    if (!singleLine) return false;
    if (dir === 'up' || dir === 'down') return ctx.moveFocus(dir);
    if (dir === 'left' || dir === 'right') {
      return caretAtEdge(root as HTMLInputElement, dir) && ctx.moveFocus(dir);
    }
    return false;
  },
};
