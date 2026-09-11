import type { Screen } from '../registry';
import { firstResult } from './firstResult';

/** Channel pages: open on the first result. */
export const channelScreen: Screen = {
  route: /^\/(channel|c|user)\//,
  defaultFocus: firstResult,
};
