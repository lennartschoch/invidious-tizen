import type { Screen } from '../registry';
import { routeMatches } from '../registry';
import { channelScreen } from './channel';
import { feedScreen } from './feed';
import { searchScreen } from './search';
import { watchScreen } from './watch';

/** Every screen, in match order. */
export const screens: Screen[] = [watchScreen, searchScreen, channelScreen, feedScreen];

const resolveScreen = (): Screen | null => {
  const path = location.pathname;
  for (let i = 0; i < screens.length; i++) {
    if (routeMatches(screens[i].route, path)) return screens[i];
  }
  return null;
};

/** Focus the screen's default element on load — but only if the user has not
 *  already focused something. Waits for DOMContentLoaded/load so async content
 *  (e.g. video.js) is in place. */
export const installScreenDefaultFocus = (): void => {
  const focusDefault = (): void => {
    if (window.__invidiousPicker) return;
    const screen = resolveScreen();
    const target = screen && screen.defaultFocus ? screen.defaultFocus() : null;
    if (!target) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    target.focus();
  };
  if (document.readyState !== 'loading') focusDefault();
  else document.addEventListener('DOMContentLoaded', focusDefault, false);
  window.addEventListener('load', focusDefault, false);
};
