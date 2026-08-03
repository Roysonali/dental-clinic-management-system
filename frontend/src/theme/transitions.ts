/**
 * DensCare Transition Tokens
 * ===========================
 *
 * Consistent timing and easing for all animations and transitions.
 *
 * Usage:
 *   className="transition-all duration-150 ease-in-out"  // Tailwind (preferred)
 *   style={{ transition: `color ${transitions.duration.fast} ${transitions.easing.default}` }}
 */

export const transitions = {
  /** Duration presets */
  duration: {
    /** 100ms — micro-interactions (hover, active) */
    instant: '100ms',
    /** 150ms — default for most transitions (color, bg, border) */
    fast: '150ms',
    /** 200ms — slightly slower (opacity, transform) */
    normal: '200ms',
    /** 300ms — moderate (expand/collapse, height) */
    slow: '300ms',
    /** 500ms — deliberate (entrance animations) */
    deliberate: '500ms',
  },

  /** Easing presets */
  easing: {
    /** ease-out — deceleration (elements entering) */
    default: 'ease-out',
    /** ease-in-out — reversible (accordion, drawer) */
    smooth: 'ease-in-out',
    /** ease-in-out with bounce — playful */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  /** Pre-built CSS transition values for common cases */
  preset: {
    color: 'color 150ms ease-out',
    backgroundColor: 'background-color 150ms ease-out',
    borderColor: 'border-color 150ms ease-out',
    shadow: 'box-shadow 200ms ease-out',
    transform: 'transform 200ms ease-out',
    opacity: 'opacity 200ms ease-out',
    all: 'all 150ms ease-out',
    slowAll: 'all 300ms ease-out',
    spring: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export type TransitionDuration = keyof typeof transitions.duration;
export type TransitionEasing = keyof typeof transitions.easing;
