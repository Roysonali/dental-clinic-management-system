import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Create a fresh QueryClient for tests. Retries are disabled so failing
 * queries surface immediately, and the garbage-collection timeout is
 * disabled so cached data cannot leak across tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

interface RenderWithProvidersOptions {
  /** Initial route for MemoryRouter */
  route?: string;
  /** Optional shared QueryClient (created fresh when omitted) */
  queryClient?: QueryClient;
}

/**
 * Render a component wrapped in the providers it needs (React Query +
 * React Router). Mirrors the app bootstrap (QueryClientProvider + router).
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient }: RenderWithProvidersOptions = {},
) {
  const client = queryClient ?? createTestQueryClient();

  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient: client,
  };
}
