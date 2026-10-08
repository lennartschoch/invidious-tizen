/*
 * Invidious Tizen - TizenBrew userscript
 *
 * Gives a Samsung TV remote usable control of an Invidious instance:
 *   - visible focus + geometric D-pad navigation over links/buttons/inputs
 *   - media keys and number keys drive the video.js player, matching YouTube TV
 *   - Back leaves fullscreen / goes back through history / exits
 *
 * Bundled to a single IIFE for TizenBrew (esbuild, target chrome69) so it runs
 * on Tizen 5.5 (2020 TVs).
 */
import { prepareComponents } from './components';
import { installInputDeferral } from './components/input';
import { PICKER_URL, VERSION } from './constants';
import { installKeyHandler } from './keys';
import { log } from './log';
import { ensurePlayerFocusable } from './media';
import { installFocusScrolling, installFullscreenExitFocus } from './navigation';
import { schedulePreferencesSection } from './preferences';
import { installScreenDefaultFocus } from './screens';
import { injectStyles } from './styles';
import { forceLightTheme } from './theme';

/** The instance picker (src/picker) is standalone: its own keys, styles and URL
 *  field. The marker is set by its first inline script; the path check covers
 *  evaluation before that script has run. Injecting here anyway would leave the
 *  picker's URL box read-only for good — installInputDeferral waits for a key
 *  handler that deliberately ignores the picker.
 */
const PICKER_PATH = PICKER_URL.replace(/^https?:\/\/[^/]+/, '').replace(/index\.html$/, '');
const isPickerPage = (): boolean => {
  if (window.__invidiousPicker) return true;
  try {
    const path = location.pathname;
    return path === PICKER_PATH || path === `${PICKER_PATH}index.html`;
  } catch {
    return false;
  }
};

const init = (): void => {
  if (document.getElementById('itv-style')) return;
  injectStyles();
  forceLightTheme();
  document.addEventListener('DOMContentLoaded', forceLightTheme, false);
  prepareComponents();
  installInputDeferral();
  installKeyHandler();
  installFocusScrolling();
  installFullscreenExitFocus();
  ensurePlayerFocusable();
  document.addEventListener('DOMContentLoaded', ensurePlayerFocusable, false);
  installScreenDefaultFocus();
  schedulePreferencesSection();
  log(`v${VERSION} active on ${location.pathname}`);
};

if (
  !window.__invidiousTizen &&
  !isPickerPage() &&
  !location.pathname.startsWith('/tizenbrew-ui/')
) {
  // TizenBrew re-evaluates `main` in every new execution context, including its
  // own UI after Back and the picker. Leave those pages alone: our ring, input
  // deferral and key handler would fight their own navigation.
  window.__invidiousTizen = true;
  if (document.documentElement) init();
  else document.addEventListener('DOMContentLoaded', init, false);
}
