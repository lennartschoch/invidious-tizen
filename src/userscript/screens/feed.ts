import type { Screen } from '../registry';
import { firstResult } from './firstResult';

/** Home / feed listings: open on the first result. */
export const feedScreen: Screen = {
  route: (path) => path === '/' || path.startsWith('/feed/'),
  defaultFocus: firstResult,
};
