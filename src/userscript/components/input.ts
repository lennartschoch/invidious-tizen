import { KEYS } from '../constants';
import type { KeyContext } from '../registry';
import type { Component } from '../registry';

/** Marker for a text field that is highlighted but not yet editable, so the
 *  on-screen keyboard does not pop open just from focusing it. */
const PENDING = 'data-itv-edit-pending';

export const isTextInput = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true;
};

const editable = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';

const setReadOnly = (el: Element, value: boolean): void => {
  if (editable(el)) (el as HTMLInputElement).readOnly = value;
};

/** The field we just activated; its re-focus must not re-enter the read-only
 *  state (the keyboard should open). */
let justActivated: Element | null = null;

/** Focus a text field without opening the keyboard; OK starts editing. */
export const installInputDeferral = (): void => {
  document.addEventListener(
    'focusin',
    (e: Event): void => {
      const el = e.target;
      if (!(el instanceof Element) || !editable(el)) return;
      if (justActivated === el) {
        justActivated = null;
        return;
      }
      if (!el.hasAttribute(PENDING)) {
        setReadOnly(el, true);
        el.setAttribute(PENDING, '1');
      }
    },
    true,
  );
  document.addEventListener(
    'focusout',
    (e: Event): void => {
      const el = e.target;
      if (!(el instanceof Element) || !el.hasAttribute(PENDING)) return;
      el.removeAttribute(PENDING);
      setReadOnly(el, false);
    },
    true,
  );
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

/** Text fields are highlighted on focus but stay read-only until OK, so the TV
 *  keyboard only appears when the user asks to type. On a single-line `<input>`
 *  Up/Down leave, Left/Right leave at the caret edge once editing, and OK either
 *  starts editing or submits. Textareas/contenteditable keep their arrows. */
export const input: Component = {
  selector: 'input, textarea, [contenteditable]',
  key: (root, code, dir, ctx: KeyContext) => {
    const singleLine = root.tagName === 'INPUT';
    if (code === KEYS.ENTER) {
      if (root.hasAttribute(PENDING)) {
        // Start editing: drop read-only and re-focus so the keyboard opens.
        root.removeAttribute(PENDING);
        setReadOnly(root, false);
        justActivated = root;
        (root as HTMLElement).blur();
        (root as HTMLElement).focus();
        return true;
      }
      return singleLine && submit(root);
    }
    if (!singleLine) return false;
    if (dir === 'up' || dir === 'down') return ctx.moveFocus(dir);
    if (dir === 'left' || dir === 'right') {
      return caretAtEdge(root as HTMLInputElement, dir) && ctx.moveFocus(dir);
    }
    return false;
  },
};
