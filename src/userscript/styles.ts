/** Injects the stylesheet: a visible focus ring and the transient hint banner. */
const STYLES = [
  ':focus{outline:3px solid #ff3b30 !important;outline-offset:2px;}',
  '.video-js:focus{outline:3px solid #ff3b30 !important;outline-offset:0;}',
  '.itv-hint{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;',
  'background:rgba(0,0,0,.82);color:#fff;font:600 18px/1.4 sans-serif;',
  'padding:10px 16px;text-align:center;pointer-events:none;opacity:0;',
  'transition:opacity .15s ease;}',
  '.itv-hint.itv-show{opacity:1;}',
].join('');

export const injectStyles = (): void => {
  const style = document.createElement('style');
  style.id = 'itv-style';
  style.appendChild(document.createTextNode(STYLES));
  (document.head || document.documentElement).appendChild(style);
};
