/** Query key prefix for all auth queries (used for cache invalidation). */
export const authQueryKeys = {
  me: ['auth', 'me'] as const,
};
