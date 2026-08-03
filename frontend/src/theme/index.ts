/**
 * DensCare Design Tokens — Barrel Export
 * ========================================
 *
 * Import tokens from a single entry point:
 *   import { colors, typography, spacing } from '@/theme';
 *
 * Each token module also exports granular constants for tree-shaking:
 *   import { primary, neutral } from '@/theme/colors';
 *   import { typeScale } from '@/theme/typography';
 */

export { colors, primary, neutral, semantic, status, colorByRole } from './colors';
export type { ColorRole, PrimaryScale, NeutralScale } from './colors';

export { typography, fontFamily, fontMono, fontWeight, typeScale } from './typography';
export type { TypeLevel } from './typography';

export { spacing, spacingScale, elementSpacing, componentSpacing, layoutSpacing } from './spacing';
export type { SpacingToken } from './spacing';

export { radius } from './radius';
export type { RadiusToken } from './radius';

export { shadows } from './shadows';
export type { ShadowToken } from './shadows';

export { transitions } from './transitions';
export type { TransitionDuration, TransitionEasing } from './transitions';

export { zIndex } from './z-index';
export type { ZIndexLayer } from './z-index';

export { breakpoints } from './breakpoints';
export type { BreakpointKey } from './breakpoints';
