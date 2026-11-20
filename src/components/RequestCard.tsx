import { MessageCircle } from 'lucide-react';
import type { RequestWithDetails } from '../types/models';
import { formatDDay, formatRelativeKoreanTime } from '../utils/dateUtils';
import { StatusBadge, UrgencyLabel } from './StatusBadge';
import { TypeIcon } from './TypeIcon';
import { AvatarStack } from './UserAvatar';

export function RequestCard({
  request,
  onClick,
}: {
  request: RequestWithDetails;
  onClick: () => void;
}) {
  const dday = formatDDay(request.dueDate);

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-glass glass glass-interactive glass-press group w-full text-left rounded-[28px] p-5 flex flex-col justify-between gap-4"
    >
      <div className="space-y-3">
        {/* Top metadata row: type icon + name · urgency on left, status glass badge on right */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <TypeIcon
              icon={request.type?.icon}
              color={request.type?.color}
              size="sm"
            />
            <div className="flex items-center gap-1.5 min-w-0 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold truncate">
                {request.type?.name ?? '일반 요청'}
              </span>
              <span aria-hidden="true">·</span>
              <UrgencyLabel urgency={request.urgency} />
            </div>
          </div>

          <StatusBadge status={request.status} size="sm" />
        </div>

        {/* Title & content snippet */}
        <div>
          <h3 className="text-base font-bold leading-snug text-slate-950 dark:text-white group-hover:text-sky-900 dark:group-hover:text-sky-200 transition-colors line-clamp-2">
            {request.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-2">
            {request.content}
          </p>
        </div>
      </div>

      {/* Bottom meta row: requester, D-day, recipients avatar stack, comment count */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/30 dark:border-white/12">
        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-w-0">
          <span className="font-semibold truncate">
            {request.requester?.name ?? '알 수 없음'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums whitespace-nowrap">
            {formatRelativeKoreanTime(request.createdAt)}
          </span>
          {request.dueDate && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={`font-bold tabular-nums whitespace-nowrap ${
                  dday.isOverdue && request.status !== '완료' && request.status !== '반려'
                    ? 'text-rose-700 dark:text-rose-300'
                    : dday.isSoon && request.status !== '완료' && request.status !== '반려'
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {dday.label}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AvatarStack recipients={request.recipients} maxVisible={3} />
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums"
            aria-label={`댓글 ${request.comments.length}개`}
          >
            <MessageCircle size={14} strokeWidth={2} aria-hidden="true" />
            {request.comments.length}
          </span>
        </div>
      </div>
    </button>
  );
}
