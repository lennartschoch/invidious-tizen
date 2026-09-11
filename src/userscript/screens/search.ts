import type { Screen } from '../registry';
import { firstResult } from './firstResult';

/** Search results: open on the first result, whatever its type. */
export const searchScreen: Screen = {
  route: /^\/search/,
  defaultFocus: firstResult,
};
