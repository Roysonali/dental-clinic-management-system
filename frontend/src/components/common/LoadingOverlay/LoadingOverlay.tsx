import type { FC, ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';

interface LoadingOverlayProps {
  /** Content to render under the overlay */
  children: ReactNode;
  /** Show the overlay */
  loading?: boolean;
  /** Full-screen mode (covers viewport) vs container mode */
  fullscreen?: boolean;
  /** Optional message displayed below spinner */
  message?: string;
  /** Apply backdrop blur to the overlay background */
  blur?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * LoadingOverlay — wraps content and covers it with a semi-transparent
 * overlay and centered spinner when `loading` is true.
 *
 * @example
 * ```tsx
 * <LoadingOverlay loading={isLoading} message="Saving..." blur>
 *   <YourContent />
 * </LoadingOverlay>
 * ```
 */
export const LoadingOverlay: FC<LoadingOverlayProps> = ({
  children,
  loading = false,
  fullscreen = false,
  message,
  blur = false,
  className = '',
}) => {
  if (fullscreen) {
    return (
      <>
        {children}
        {loading && (
          <div
            className={`
              fixed inset-0 z-overlay
              flex flex-col items-center justify-center gap-3
              bg-white/80
              ${blur ? 'backdrop-blur-sm' : ''}
              transition-opacity duration-200
              ${className}
            `}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Spinner size="lg" variant="primary" />
            {message && (
              <p className="text-body-sm font-medium text-neutral-600">
                {message}
              </p>
            )}
            <span className="sr-only">Loading</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      {loading && (
        <div
          className={`
            absolute inset-0 z-elevated
            flex flex-col items-center justify-center gap-3
            bg-white/80
            ${blur ? 'backdrop-blur-sm' : ''}
            transition-opacity duration-200
            rounded-lg
          `}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner size="lg" variant="primary" />
          {message && (
            <p className="text-body-sm font-medium text-neutral-600">
              {message}
            </p>
          )}
          <span className="sr-only">Loading</span>
        </div>
      )}
    </div>
  );
};
