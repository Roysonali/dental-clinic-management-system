import type { FC } from 'react';

/**
 * Header section of the login panel.
 * Displays the "Sign in" heading and supporting subtitle.
 */
export const LoginHeader: FC = () => {
  return (
    <div className="text-center sm:text-left">
      <h1 className="text-h2 font-semibold text-neutral-900">Sign in</h1>
      <p className="mt-2 text-body text-neutral-500">
        Use your clinic account to access the workspace.
      </p>
    </div>
  );
};
