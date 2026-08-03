import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest does not expose a global afterEach unless `globals: true` is set,
// so React Testing Library's automatic cleanup does not self-register.
afterEach(() => {
  cleanup();
});
