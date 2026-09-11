import type { Component } from '../registry';
import { comment } from './comment';
import { input } from './input';
import { player } from './player';
import { rail } from './rail';
import { tile } from './tile';

/** Every component, in key-dispatch order: the first selector that matches the
 *  focused element and handles the key wins. Specific contexts (a text field, a
 *  player) come before broad ones (tiles/rails, which handle no keys). */
export const components: Component[] = [input, player, comment, tile, rail];

/** Run each component's DOM prep once (idempotent). */
export const prepareComponents = (): void => {
  for (let i = 0; i < components.length; i++) components[i].prepare?.();
};
