import type { FC } from 'react';

interface StatisticItemProps {
  /** The numeric value to display */
  value: string;
  /** Label text below the value */
  label: string;
}

/**
 * A single statistic display card — used in the hero section
 * to show module counts, endpoint counts, etc.
 */
export const StatisticItem: FC<StatisticItemProps> = ({ value, label }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-caption text-neutral-400">{label}</span>
    </div>
  );
};
