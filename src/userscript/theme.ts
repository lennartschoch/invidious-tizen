/** The TV's Chromium 69 force-darkens pages: Invidious' light theme comes out as
 *  a usable dark, while its dark theme goes near-black. Pin the light theme. */
export const forceLightTheme = (): void => {
  const body = document.body;
  if (!body) return;
  body.classList.remove('dark-theme', 'no-theme');
  body.classList.add('light-theme');
};
