import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { IOS_EASE, IOS_SPRING_POPOVER } from '../utils/motionPresets';

export function ConfirmDeleteModal({
  open,
  title = '요청 삭제 확인',
  message = '정말 이 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  confirmLabel = '삭제',
  cancelLabel = '돌아가기',
  variant = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'neutral';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === 'undefined') return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-delete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: IOS_EASE }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
          onClick={onCancel}
        >
          <motion.div
            key="confirm-delete-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={IOS_SPRING_POPOVER}
            className="glass-elevated w-full max-w-sm rounded-[28px] p-6 text-slate-900 dark:text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                  isDanger
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400/40'
                    : 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-400/40'
                }`}
              >
                {isDanger ? (
                  <AlertTriangle size={20} aria-hidden="true" />
                ) : (
                  <LogOut size={19} aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="confirm-delete-title"
                  className="text-base font-extrabold tracking-tight"
                >
                  {title}
                </h3>
                <p
                  id="confirm-delete-desc"
                  className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                >
                  {message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="focus-glass glass-press rounded-full bg-white/45 dark:bg-white/12 border border-white/50 dark:border-white/20 px-4 py-2 text-xs font-bold min-h-[40px]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`focus-glass glass-press rounded-full px-5 py-2 text-xs font-bold shadow-md min-h-[40px] ${
                  isDanger
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
