/** Injects the stylesheet: a visible focus ring and the transient hint banner. */
const STYLES = [
  // Two-tone ring: the dark backing keeps it visible on light backgrounds, the
  // white line on dark ones. Needed because forced light + a force-darkening
  // engine can disagree about which theme is actually painted.
  ':focus{outline:3px solid #fff !important;outline-offset:3px;box-shadow:0 0 0 3px #111 !important;}',
  // Invidious video thumbnails (and channel-card avatars) are inline links whose
  // only content is a block <img>/<center>. An inline box with no line box paints
  // no outline, so the ring above silently disappears; make the link a block
  // while focused. Keep `.h-box > a` narrow so text links are unaffected.
  '.thumbnail a:focus{display:block;}',
  '.h-box > a:focus{display:block;}',
  '.video-js:focus{outline:3px solid #fff !important;outline-offset:0;box-shadow:0 0 0 3px #111 !important;}',
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
