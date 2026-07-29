import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Divider } from '../../common/Divider';

/**
 * Footer section of the login panel.
 * Contains "New to the clinic?" registration link and
 * a prototype viewer link.
 */
export const LoginFooter: FC = () => {
  return (
    <div className="space-y-4">
      {/* Registration prompt */}
      <p className="text-center text-body text-neutral-600">
        New to the clinic?{' '}
        <Link
          to="/auth/register"
          className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
        >
          Request an account
        </Link>
      </p>

      <p className="text-center text-caption text-neutral-400">
        Access is granted after administrator approval.
      </p>

      {/* Divider */}
      <Divider />

      {/* Prototype link */}
      <p className="text-center">
        <a
          href="#"
          className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
        >
          View the application shell prototype
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </p>
    </div>
  );
};
