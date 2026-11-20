import {
  CalendarDays,
  ClipboardList,
  FileCheck,
  Handshake,
  Laptop,
  MessageSquareHeart,
  Package,
  Sparkles,
} from 'lucide-react';
import type { RequestTypeColor, RequestTypeIconName } from '../types/models';

const COLOR_STYLES: Record<
  RequestTypeColor,
  { bg: string; text: string; border: string }
> = {
  blue: {
    bg: 'bg-sky-500/20 dark:bg-sky-400/20',
    text: 'text-sky-700 dark:text-sky-200',
    border: 'border-sky-400/40 dark:border-sky-300/30',
  },
  purple: {
    bg: 'bg-violet-500/20 dark:bg-violet-400/20',
    text: 'text-violet-700 dark:text-violet-200',
    border: 'border-violet-400/40 dark:border-violet-300/30',
  },
  orange: {
    bg: 'bg-amber-500/20 dark:bg-amber-400/20',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-400/40 dark:border-amber-300/30',
  },
  emerald: {
    bg: 'bg-emerald-500/20 dark:bg-emerald-400/20',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-400/40 dark:border-emerald-300/30',
  },
  pink: {
    bg: 'bg-rose-500/20 dark:bg-rose-400/20',
    text: 'text-rose-700 dark:text-rose-200',
    border: 'border-rose-400/40 dark:border-rose-300/30',
  },
  teal: {
    bg: 'bg-teal-500/20 dark:bg-teal-400/20',
    text: 'text-teal-800 dark:text-teal-200',
    border: 'border-teal-400/40 dark:border-teal-300/30',
  },
};

export function TypeIcon({
  icon,
  color = 'blue',
  size = 'md',
}: {
  icon?: RequestTypeIconName;
  color?: RequestTypeColor;
  size?: 'sm' | 'md' | 'lg';
}) {
  const palette = COLOR_STYLES[color] ?? COLOR_STYLES.blue;
  const boxSize =
    size === 'sm'
      ? 'h-8 w-8 rounded-[12px]'
      : size === 'lg'
        ? 'h-12 w-12 rounded-[18px]'
        : 'h-10 w-10 rounded-[14px]';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 19;

  const IconComp =
    icon === 'Package'
      ? Package
      : icon === 'Laptop'
        ? Laptop
        : icon === 'Handshake'
          ? Handshake
          : icon === 'FileCheck'
            ? FileCheck
            : icon === 'CalendarDays'
              ? CalendarDays
              : icon === 'MessageSquareHeart'
                ? MessageSquareHeart
                : icon === 'Sparkles'
                  ? Sparkles
                  : ClipboardList;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${boxSize} ${palette.bg} ${palette.text} ${palette.border}`}
    >
      <IconComp size={iconSize} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
