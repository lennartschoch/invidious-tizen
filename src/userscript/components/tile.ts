import type { Component } from '../registry';

/** The primary (media) link of a card: the thumbnail for a video tile, or a
 *  direct-child avatar link for a channel card. */
const primaryLinks = (box: Element): Element[] => {
  const thumbs = box.querySelectorAll('.thumbnail a[href]');
  if (thumbs.length) return Array.from(thumbs);
  const out: Element[] = [];
  for (let i = 0; i < box.children.length; i++) {
    const child = box.children[i];
    if (child.tagName === 'A' && child.querySelector('img')) out.push(child);
  }
  return out;
};

/** On a listing a card holds several links to the same thing: the thumbnail (or
 *  avatar), the title/channel name and the little icon actions. The D-pad wants
 *  one stop per card, so keep the media link and drop the rest. A card is the
 *  nearest ancestor holding exactly one media link (the related-videos rail is a
 *  single `.h-box` with many tiles). Coupled to Invidious markup. */
const isSecondaryLink = (el: Element): boolean => {
  if (el.tagName !== 'A') return false;
  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    const primaries = primaryLinks(node);
    if (primaries.length === 1) return primaries[0] !== el;
    if (primaries.length > 1) return false; // several cards share this ancestor
    node = node.parentElement;
  }
  return false;
};

export const tile: Component = {
  selector: '.thumbnail a',
  skip: isSecondaryLink,
};
