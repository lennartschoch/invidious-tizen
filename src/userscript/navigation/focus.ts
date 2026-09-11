/** A component's contribution to which nodes are D-pad stops. `prepare` runs
 *  before each scan (idempotent DOM setup); `skip` drops a candidate. */
export interface FocusRule {
  prepare?: () => void;
  skip?: (el: Element) => boolean;
}

/** A component's vertical-movement scope: the container Up/Down should stay
 *  within when `el` is focused, or null. */
export interface ScopeRule {
  scope: (el: Element) => Element | null;
}

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
export const focusables = (rules: FocusRule[]): HTMLElement[] => {
  for (let r = 0; r < rules.length; r++) rules[r].prepare?.();
  const found = document.querySelectorAll(FOCUSABLE);
  const out: HTMLElement[] = [];
  for (let i = 0; i < found.length; i++) {
    const el = found[i] as HTMLElement;
    if ((el as HTMLButtonElement).disabled) continue;
    if (el.getAttribute('tabindex') === '-1' && !el.matches(INTERACTIVE)) continue;
    let skip = false;
    for (let r = 0; r < rules.length; r++) {
      if (rules[r].skip?.(el)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    if (isVisible(el)) out.push(el);
  }
  return out;
};
