import type { Direction } from './constants';

/** Helpers the key dispatcher lends to component handlers. */
export interface KeyContext {
  moveFocus(dir: Direction): boolean;
  moveFocusOutside(container: Element, dir: Direction): boolean;
}

/** A component is declared by a `selector`: the runtime uses
 *  `document.querySelector(selector)` to know it is on the screen and
 *  `activeElement.closest(selector)` to know focus is inside it. */
export interface Component {
  /** Root selector. */
  selector: string;
  /** Idempotent DOM prep before each scan (e.g. tag comment rows). */
  prepare?(): void;
  /** Drop a candidate from the D-pad stop set. */
  skip?(el: Element): boolean;
  /** Container vertical movement should stay within for `el`, or null. */
  scope?(el: Element): Element | null;
  /** Handle a key while focus is inside the component; true consumes it. */
  key?(root: Element, code: number, dir: Direction | undefined, ctx: KeyContext): boolean;
}

/** A screen is enabled by route and may set what gets focused on load. */
export interface Screen {
  route: RegExp | ((pathname: string) => boolean);
  defaultFocus?(): HTMLElement | null;
}

export const routeMatches = (route: Screen['route'], pathname: string): boolean =>
  route instanceof RegExp ? route.test(pathname) : route(pathname);
