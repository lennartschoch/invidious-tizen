import type { FocusRule, ScopeRule } from '../navigation/focus';
import { commentRule } from './comment';
import { playerRule } from './player';
import { railScope } from './rail';
import { tileRule } from './tile';

/** The component rules active on every page. Components self-gate on their own
 *  markup, so a screen layer only needs to add exclusions or defaults. */
export const focusRules: FocusRule[] = [playerRule, commentRule, tileRule];
export const scopeRules: ScopeRule[] = [railScope];
