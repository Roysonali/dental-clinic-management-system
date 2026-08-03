import { forwardRef } from 'react';
import type { IconButtonProps } from './button.types';
import { Button } from './Button';

/**
 * Icon-only button — circular/square button with just an icon.
 *
 * Automatically sets `iconOnly` on the underlying Button.
 * Requires an `aria-label` for accessibility.
 *
 * @example
 * ```tsx
 * <IconButton icon={<X />} aria-label="Close" variant="ghost" />
 * ```
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = 'ghost', size = 'md', ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        iconOnly
        {...rest}
      >
        {icon}
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
