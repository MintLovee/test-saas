import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import type { Notification, NotificationKind } from '../types/models';
import { formatRelativeKoreanTime } from '../utils/dateUtils';
import { IOS_EASE, IOS_SPRING_POPOVER } from '../utils/motionPresets';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const KIND_LABELS: Record<NotificationKind, string> = {
  new_request: '새 요청',
  assigned: '담당 지정',
  status_changed: '상태 변경',
  comment_added: '댓글',
  chat_invited: '채팅 초대',
  chat_message: '새 메시지',
};

export function NotificationsSheet({
  open,
  notifications,
  onClose,
  onSelectNotification,
  onMarkAllRead,
  onDeleteNotification,
  onDeleteAllNotifications,
}: {
  open: boolean;
  notifications: Notification[];
  onClose: () => void;
  onSelectNotification: (noti: Notification) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onDeleteAllNotifications: () => void;
}) {
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="notifications-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: IOS_EASE }}
          className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="알림 목록"
          onClick={onClose}
        >
          <motion.div
            key="notifications-panel"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={IOS_SPRING_POPOVER}
            className="glass-elevated mt-14 w-full max-w-md rounded-[28px] p-4 sm:p-5 text-slate-900 dark:text-slate-100 max-h-[78vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/30 dark:border-white/15">
              <div className="flex items-center gap-2 min-w-0">
                <Bell size={18} aria-hidden="true" className="shrink-0" />
                <h2 className="text-base font-bold whitespace-nowrap">알림</h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 tabular-nums whitespace-nowrap">
                    읽지 않음 {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="focus-glass glass-press inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/30 dark:hover:bg-white/10 min-h-[34px] whitespace-nowrap shrink-0"
                  >
                    <CheckCheck size={14} aria-hidden="true" />
                    모두 읽음
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="focus-glass glass-press inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 min-h-[34px] whitespace-nowrap shrink-0"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    전체 삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="알림 닫기"
                  className="focus-glass glass-press inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/30 dark:hover:bg-white/10"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-0.5">
              {notifications.length === 0 ? (
                <div className="glass rounded-[20px] p-8 text-center">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    새로운 알림이 없습니다
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    요청 도착, 상태 변경, 댓글, 채팅 초대 소식이 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                notifications.map((noti) => {
                  const unread = !noti.readAt;
                  const kindLabel = KIND_LABELS[noti.kind] ?? '알림';
                  return (
                    <div
                      key={noti.id}
                      className={`group flex items-start gap-2 rounded-[20px] p-3 transition-colors border ${
                        unread
                          ? 'bg-white/48 dark:bg-white/14 border-white/55 dark:border-white/25'
                          : 'bg-white/18 dark:bg-white/5 border-white/25 dark:border-white/10 opacity-85'
                      } hover:bg-white/60 dark:hover:bg-white/20`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectNotification(noti)}
                        className="focus-glass flex-1 min-w-0 text-left rounded-[14px] p-0.5"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {kindLabel}
                          </span>
                          {unread && (
                            <span
                              className="text-[11px] font-bold text-sky-700 dark:text-sky-300"
                              aria-label="읽지 않음"
                            >
                              · 새 알림
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-snug font-medium text-slate-900 dark:text-slate-100 break-words">
                          {noti.message ?? '요청 업데이트가 있습니다.'}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {formatRelativeKoreanTime(noti.createdAt)}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteNotification(noti.id)}
                        aria-label={`알림 삭제: ${noti.message ?? kindLabel}`}
                        className="focus-glass glass-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-200"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <ConfirmDeleteModal
      open={confirmClearAll}
      title="알림 전체 삭제"
      message="모든 알림을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      confirmLabel="전체 삭제"
      cancelLabel="취소"
      onCancel={() => setConfirmClearAll(false)}
      onConfirm={() => {
        setConfirmClearAll(false);
        onDeleteAllNotifications();
      }}
    />
    </>,
    document.body
  );
}
