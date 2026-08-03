import type { FC, SVGAttributes } from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
}

/**
 * DensCare Logo component.
 * Renders the tooth/dental icon optionally with the product name.
 */
export const Logo: FC<LogoProps> = ({
  className = '',
  showText = true,
  variant = 'dark',
}) => {
  const textColor = variant === 'light' ? 'text-white' : 'text-neutral-900';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Tooth Icon */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M16 4C11 4 7 7 6 12L5 17C4.5 20 6 23 8 24.5C10 26 12 25.5 14 23.5C15 22.5 15.5 22 16 22C16.5 22 17 22.5 18 23.5C20 25.5 22 26 24 24.5C26 23 27.5 20 27 17L26 12C25 7 21 4 16 4Z"
          fill={variant === 'light' ? '#60A5FA' : '#3B82F6'}
        />
        <path
          d="M12 8.5C12 8.5 13 12 16 12C19 12 20 8.5 20 8.5"
          stroke={variant === 'light' ? '#DBEAFE' : '#EFF6FF'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle
          cx="12.5"
          cy="14.5"
          r="1"
          fill={variant === 'light' ? '#DBEAFE' : '#BFDBFE'}
        />
        <circle
          cx="19.5"
          cy="14.5"
          r="1"
          fill={variant === 'light' ? '#DBEAFE' : '#BFDBFE'}
        />
      </svg>

      {/* Product Name */}
      {showText && (
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-bold tracking-tight ${textColor}`}>
            Dens
          </span>
          <span
            className={`text-lg font-semibold tracking-tight ${textColor}`}
          >
            Care
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Just the DensCare tooth icon (no text).
 * Useful for favicon or compact display.
 */
export const LogoIcon: FC<SVGAttributes<SVGSVGElement>> = (props) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M16 4C11 4 7 7 6 12L5 17C4.5 20 6 23 8 24.5C10 26 12 25.5 14 23.5C15 22.5 15.5 22 16 22C16.5 22 17 22.5 18 23.5C20 25.5 22 26 24 24.5C26 23 27.5 20 27 17L26 12C25 7 21 4 16 4Z"
      fill="#3B82F6"
    />
    <path
      d="M12 8.5C12 8.5 13 12 16 12C19 12 20 8.5 20 8.5"
      stroke="#EFF6FF"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
