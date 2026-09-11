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
import { VERSION } from './constants';
import { installKeyHandler } from './keys';
import { log } from './log';
import { ensurePlayerFocusable } from './media';
import { installFocusScrolling, installFullscreenExitFocus } from './navigation';
import { schedulePreferencesSection } from './preferences';
import { installScreenDefaultFocus } from './screens';
import { injectStyles } from './styles';

const init = (): void => {
  if (document.getElementById('itv-style')) return;
  injectStyles();
  prepareComponents();
  installKeyHandler();
  installFocusScrolling();
  installFullscreenExitFocus();
  ensurePlayerFocusable();
  document.addEventListener('DOMContentLoaded', ensurePlayerFocusable, false);
  installScreenDefaultFocus();
  schedulePreferencesSection();
  log(`v${VERSION} active on ${location.pathname}`);
};

if (!window.__invidiousTizen) {
  window.__invidiousTizen = true;
  if (document.documentElement) init();
  else document.addEventListener('DOMContentLoaded', init, false);
}
