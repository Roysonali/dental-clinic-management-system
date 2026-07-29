import type { FC } from 'react';

/**
 * Bottom security notice shown in the authentication hero panel.
 * Communicates encryption and audit compliance information.
 */
export const SecurityNotice: FC = () => {
  return (
    <div className="flex items-start gap-2 px-8">
      {/* Lock icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mt-0.5 shrink-0 text-neutral-500"
        aria-hidden="true"
      >
        <path
          d="M11 5.5H10.5V4C10.5 2.07 8.93 0.5 7 0.5C5.07 0.5 3.5 2.07 3.5 4V5.5H3C2.17 5.5 1.5 6.17 1.5 7V12C1.5 12.83 2.17 13.5 3 13.5H11C11.83 13.5 12.5 12.83 12.5 12V7C12.5 6.17 11.83 5.5 11 5.5ZM7 10.5C6.17 10.5 5.5 9.83 5.5 9C5.5 8.17 6.17 7.5 7 7.5C7.83 7.5 8.5 8.17 8.5 9C8.5 9.83 7.83 10.5 7 10.5ZM8.83 5.5H5.17V4C5.17 2.99 5.99 2.17 7 2.17C8.01 2.17 8.83 2.99 8.83 4V5.5Z"
          fill="currentColor"
        />
      </svg>
      <p className="text-caption text-neutral-500 leading-relaxed">
        Patient data is encrypted in transit
        <br />
        and at rest. All access is audited.
      </p>
    </div>
  );
};
