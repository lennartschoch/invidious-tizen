import type { Component } from '../registry';

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[role="button"]';
// Invidious marks video thumbnails (and some channel links) tabindex="-1" to
// keep them out of the browser's tab order, but on a TV they are exactly what
// we want to focus. Only skip tabindex="-1" on otherwise non-interactive nodes.
const INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"]';

export const isVisible = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return (
    !style || (style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0')
  );
};

/** The D-pad stops, after every component's focus rules have been applied. */
export const focusables = (components: Component[]): HTMLElement[] => {
  for (let c = 0; c < components.length; c++) components[c].prepare?.();
  const found = document.querySelectorAll(FOCUSABLE);
  const out: HTMLElement[] = [];
  for (let i = 0; i < found.length; i++) {
    const el = found[i] as HTMLElement;
    if ((el as HTMLButtonElement).disabled) continue;
    if (el.getAttribute('tabindex') === '-1' && !el.matches(INTERACTIVE)) continue;
    let skip = false;
    for (let c = 0; c < components.length; c++) {
      if (components[c].skip?.(el)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    if (isVisible(el)) out.push(el);
  }
  return out;
};
