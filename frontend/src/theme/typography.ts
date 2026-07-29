/**
 * DensCare Typography Tokens
 *
 * Font size values match the `@theme` declarations in `index.css`.
 * Use Tailwind utility classes (e.g. `text-display`, `text-body`) in components.
 */

export const typography = {
  fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',

  fontSize: {
    display: '1.875rem',
    h1: '1.5rem',
    h2: '1.25rem',
    h3: '1.125rem',
    h4: '1rem',
    body: '0.875rem',
    'body-sm': '0.8125rem',
    caption: '0.75rem',
    label: '0.8125rem',
    button: '0.875rem',
    'button-sm': '0.8125rem',
    monospace: '0.8125rem',
    small: '0.6875rem',
  } as const,

  lineHeight: {
    display: '1.3',
    h1: '1.3',
    h2: '1.4',
    h3: '1.4',
    h4: '1.5',
    body: '1.5',
    'body-sm': '1.5',
    caption: '1.5',
    label: '1.5',
    button: '1',
    'button-sm': '1',
    monospace: '1.5',
    small: '1.4',
  } as const,
} as const;
