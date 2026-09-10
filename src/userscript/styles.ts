/** Injects the stylesheet: a visible focus ring and the transient hint banner. */
const STYLES = [
  ':focus{outline:3px solid #fff !important;outline-offset:2px;}',
  // Invidious puts the theme class on <body>; ring white on dark, near-black on
  // light so it stays visible either way. The picker is dark and unclassed.
  '.light-theme :focus{outline-color:#111 !important;}',
  // Invidious video thumbnails are inline links whose only content is a block
  // <img>. An inline box with no line box paints no outline, so the ring above
  // silently disappears; make the link a block while focused.
  '.thumbnail a:focus{display:block;}',
  '.video-js:focus{outline:3px solid #fff !important;outline-offset:0;}',
  '.light-theme .video-js:focus{outline-color:#111 !important;}',
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
