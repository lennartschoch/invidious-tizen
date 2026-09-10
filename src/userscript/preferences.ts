import { PICKER_URL } from './constants';

const SECTION_ID = 'itv-prefs';

/** Adds an "Invidious Tizen" section to the preferences page with a button that
 *  opens the instance picker. */
export const injectPreferencesSection = (): void => {
  if (window.__invidiousPicker) return;
  if (location.pathname !== '/preferences') return;
  if (document.getElementById(SECTION_ID)) return;

  const form = document.querySelector('form[action^="/preferences"]');
  const box = form ? form.closest('.h-box') || form.parentElement : null;
  if (!box || !box.parentElement) return;

  const section = document.createElement('div');
  section.className = 'h-box';
  section.id = SECTION_ID;
  section.innerHTML =
    '<div class="pure-form pure-form-aligned"><fieldset>' +
    '<legend>Invidious Tizen</legend>' +
    '<div class="pure-controls">' +
    '<button id="itv-picker-open" type="button" class="pure-button pure-button-primary">Open instance picker</button>' +
    '</div>' +
    '</fieldset></div>';
  box.parentElement.insertBefore(section, box.nextSibling);

  const button = section.querySelector('#itv-picker-open') as HTMLButtonElement;
  button.addEventListener('click', (): void => {
    window.location.href = PICKER_URL + '?pick=1';
  });
};

export const schedulePreferencesSection = (): void => {
  if (document.body) injectPreferencesSection();
  else document.addEventListener('DOMContentLoaded', injectPreferencesSection, false);
};
