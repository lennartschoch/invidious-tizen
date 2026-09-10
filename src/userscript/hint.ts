/** Transient bottom banner used to confirm seek/volume-style actions. */
let hintEl: HTMLDivElement | null = null;
let hintTimer: number | undefined;

export const showHint = (text: string): void => {
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.className = 'itv-hint';
    (document.body || document.documentElement).appendChild(hintEl);
  }

  hintEl.textContent = text;
  hintEl.classList.add('itv-show');

  if (hintTimer !== undefined) clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    if (hintEl) hintEl.classList.remove('itv-show');
  }, 1500);
};
