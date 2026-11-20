import {
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { RequestStatus, UrgencyLevel } from '../types/models';

const STATUS_META: Record<
  RequestStatus,
  {
    bg: string;
    text: string;
    border: string;
    Icon: typeof Inbox;
  }
> = {
  접수: {
    bg: 'bg-sky-500/20 dark:bg-sky-400/22',
    text: 'text-sky-900 dark:text-sky-100',
    border: 'border-sky-400/50 dark:border-sky-300/35',
    Icon: Inbox,
  },
  확인: {
    bg: 'bg-violet-500/22 dark:bg-violet-400/22',
    text: 'text-violet-900 dark:text-violet-100',
    border: 'border-violet-400/50 dark:border-violet-300/35',
    Icon: Eye,
  },
  '진행 중': {
    bg: 'bg-amber-500/22 dark:bg-amber-400/22',
    text: 'text-amber-950 dark:text-amber-100',
    border: 'border-amber-400/55 dark:border-amber-300/35',
    Icon: Clock3,
  },
  완료: {
    bg: 'bg-emerald-500/22 dark:bg-emerald-400/22',
    text: 'text-emerald-950 dark:text-emerald-100',
    border: 'border-emerald-400/50 dark:border-emerald-300/35',
    Icon: CheckCircle2,
  },
  반려: {
    bg: 'bg-rose-500/22 dark:bg-rose-400/22',
    text: 'text-rose-950 dark:text-rose-100',
    border: 'border-rose-400/55 dark:border-rose-300/35',
    Icon: XCircle,
  },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: RequestStatus;
  size?: 'sm' | 'md';
}) {
  const meta = STATUS_META[status];
  const { Icon } = meta;
  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap shrink-0 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ${padding} ${meta.bg} ${meta.text} ${meta.border}`}
    >
      <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

export function UrgencyLabel({ urgency }: { urgency: UrgencyLevel }) {
  if (urgency === '높음') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap shrink-0">
        <AlertTriangle size={12} strokeWidth={2.2} aria-hidden="true" />
        긴급
      </span>
    );
  }
  if (urgency === '보통') {
    return (
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
        보통
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
      여유
    </span>
  );
}
