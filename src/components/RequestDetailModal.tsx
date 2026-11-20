import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  Clock,
  Edit3,
  MessageCircle,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type {
  FieldValue,
  RequestStatus,
  RequestWithDetails,
  UpdateRequestInput,
  UrgencyLevel,
  User,
} from '../types/models';
import { formatDDay, formatKoreanDateTime } from '../utils/dateUtils';
import {
  canDeleteOrCancelRequest,
  canEditRequestContent,
  getAvailableStatusTransitions,
  isUserAssignee,
} from '../utils/requestRules';
import { shakeAndFocusElement, useFormValidationFeedback } from '../utils/formFeedback';
import {
  IOS_EASE,
  IOS_SPRING_CONTENT,
  IOS_SPRING_IMESSAGE,
  IOS_SPRING_SHEET,
  IOS_SPRING_SNAPPY,
} from '../utils/motionPresets';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { StatusBadge, UrgencyLabel } from './StatusBadge';
import { TypeIcon } from './TypeIcon';
import { UserAvatar } from './UserAvatar';

export function RequestDetailModal({
  request,
  currentUser,
  onClose,
  onUpdateStatus,
  onUpdateRequest,
  onDeleteRequest,
  onAddComment,
  onStartParticipantChat,
}: {
  request: RequestWithDetails | null;
  currentUser: User;
  onClose: () => void;
  onUpdateStatus: (
    requestId: string,
    toStatus: RequestStatus,
    rejectReason?: string
  ) => { ok: true } | { ok: false; error: string };
  onUpdateRequest: (
    requestId: string,
    input: UpdateRequestInput
  ) => { ok: true } | { ok: false; error: string };
  onDeleteRequest: (requestId: string) => { ok: true } | { ok: false; error: string };
  onAddComment: (
    requestId: string,
    body: string
  ) => { ok: true } | { ok: false; error: string };
  onStartParticipantChat?: (memberIds: string[], roomTitle?: string) => void;
}) {
  const [commentBody, setCommentBody] = useState('');
  const [reasonTargetStatus, setReasonTargetStatus] = useState<'반려' | '보류' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [pendingStatusConfirm, setPendingStatusConfirm] = useState<{
    toStatus: RequestStatus;
    label: string;
    reason?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    'deleteRequest' | 'cancelEdit' | 'cancelReason' | 'closeWhileEditing' | null
  >(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editUrgency, setEditUrgency] = useState<UrgencyLevel>('보통');
  const [editFields, setEditFields] = useState<Record<string, FieldValue>>({});

  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const prevReqIdRef = useRef<string | null>(null);
  const prevCommentCountRef = useRef<number>(0);

  const { isInvalid, clearFieldInvalid, clearAllInvalid, triggerInvalid } =
    useFormValidationFeedback();

  useEffect(() => {
    setReasonTargetStatus(null);
    setReasonText('');
    setPendingStatusConfirm(null);
    setActionError(null);
    setConfirmModal(null);
    setEditing(false);
    clearAllInvalid();
    if (request) {
      setEditTitle(request.title);
      setEditContent(request.content);
      setEditDueDate(request.dueDate);
      setEditUrgency(request.urgency);
      setEditFields({ ...request.fieldValues });
    }
  }, [request?.id, request?.status, clearAllInvalid]);

  useEffect(() => {
    const reqId = request?.id ?? null;
    const count = request?.comments.length ?? 0;
    const isSameRequest = prevReqIdRef.current === reqId;
    if (isSameRequest && count > prevCommentCountRef.current) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevReqIdRef.current = reqId;
    prevCommentCountRef.current = count;
  }, [request?.id, request?.comments.length]);

  const dday = request ? formatDDay(request.dueDate) : null;
  const userIsAssignee = request
    ? isUserAssignee(currentUser.id, request.id, request.recipients)
    : false;
  const transitions = request
    ? getAvailableStatusTransitions(request.status, userIsAssignee)
    : [];
  const editPermission = request
    ? canEditRequestContent(currentUser, request)
    : { allowed: false };
  const isRequester = request ? request.requesterId === currentUser.id : false;
  const canDelete = request ? canDeleteOrCancelRequest(currentUser, request) : false;

  const assignees = request
    ? request.recipients.filter((r) => r.role === 'assignee')
    : [];
  const ccList = request
    ? request.recipients.filter((r) => r.role === 'cc')
    : [];

  const handleStatusClick = (
    toStatus: RequestStatus,
    label: string,
    requiresReason?: boolean
  ) => {
    if (!request) return;
    setActionError(null);
    if (requiresReason && (toStatus === '반려' || toStatus === '보류')) {
      setReasonTargetStatus(toStatus);
      clearFieldInvalid('statusReason');
      window.requestAnimationFrame(() => {
        const el = document.getElementById('status-reason-input');
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus({ preventScroll: true });
        }
      });
      window.setTimeout(() => {
        const el = document.getElementById('status-reason-input');
        if (el instanceof HTMLElement && document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
      }, 90);
      return;
    }
    setPendingStatusConfirm({ toStatus, label });
  };

  const handleSubmitReason = (e: FormEvent) => {
    e.preventDefault();
    if (!request || !reasonTargetStatus) return;
    setActionError(null);
    if (!reasonText.trim()) {
      setActionError(
        reasonTargetStatus === '보류'
          ? '보류(일정 지연) 처리할 때는 사유를 반드시 입력해야 합니다.'
          : '반려할 때는 반려 사유를 반드시 입력해야 합니다.'
      );
      triggerInvalid(
        [{ key: 'statusReason', elementId: 'status-reason-input' }],
        'status-reason-input'
      );
      return;
    }
    clearFieldInvalid('statusReason');
    setPendingStatusConfirm({
      toStatus: reasonTargetStatus,
      label: reasonTargetStatus === '보류' ? '보류 확정' : '반려 확정',
      reason: reasonText.trim(),
    });
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setActionError(null);

    const missing: Array<{ key: string; elementId: string; message: string; focusId?: string }> = [];
    if (!editTitle.trim()) {
      missing.push({
        key: 'editTitle',
        elementId: 'edit-title',
        message: '요청 제목을 입력해 주세요.',
      });
    }
    if (!editContent.trim()) {
      missing.push({
        key: 'editContent',
        elementId: 'edit-content',
        message: '상세 내용을 입력해 주세요.',
      });
    }
    if (request.type) {
      for (const field of request.type.fields) {
        if (!field.required) continue;
        const val = editFields[field.id];
        if (field.type === 'checkbox') {
          if (!val) {
            missing.push({
              key: `editField_${field.id}`,
              elementId: `edit-custom-field-wrap-${field.id}`,
              focusId: `edit-custom-field-${field.id}`,
              message: `"${field.label}" 항목을 확인해 주세요.`,
            });
          }
        } else if (val === undefined || val === null || String(val).trim() === '') {
          missing.push({
            key: `editField_${field.id}`,
            elementId: `edit-custom-field-${field.id}`,
            message: `"${field.label}" 항목을 입력해 주세요.`,
          });
        }
      }
    }

    if (missing.length > 0) {
      setActionError(missing[0].message);
      triggerInvalid(
        missing.map((m) => ({ key: m.key, elementId: m.elementId })),
        missing[0].focusId ?? missing[0].elementId
      );
      return;
    }

    const res = onUpdateRequest(request.id, {
      title: editTitle,
      content: editContent,
      dueDate: editDueDate,
      urgency: editUrgency,
      fieldValues: editFields,
    });
    if (!res.ok) {
      setActionError(res.error);
      shakeAndFocusElement(['edit-title'], 'edit-title');
      return;
    }
    clearAllInvalid();
    setEditing(false);
  };

  const handlePostComment = (e: FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setActionError(null);
    if (!commentBody.trim()) {
      setActionError('댓글 내용을 입력해 주세요.');
      triggerInvalid(
        [{ key: 'commentBody', elementId: 'comment-input' }],
        'comment-input'
      );
      return;
    }
    const res = onAddComment(request.id, commentBody);
    if (!res.ok) {
      setActionError(res.error);
      triggerInvalid(
        [{ key: 'commentBody', elementId: 'comment-input' }],
        'comment-input'
      );
      return;
    }
    clearFieldInvalid('commentBody');
    setCommentBody('');
  };

  const participantIds = request
    ? Array.from(
        new Set([
          request.requesterId,
          ...request.recipients.map((r) => r.userId),
        ])
      ).filter((id) => id !== currentUser.id)
    : [];

  const isEditDirty = Boolean(
    request &&
      editing &&
      (editTitle !== request.title ||
        editContent !== request.content ||
        editDueDate !== request.dueDate ||
        editUrgency !== request.urgency ||
        JSON.stringify(editFields) !== JSON.stringify(request.fieldValues))
  );

  const handleRequestClose = () => {
    if (isEditDirty || (reasonTargetStatus && reasonText.trim())) {
      setConfirmModal('closeWhileEditing');
      return;
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AnimatePresence>
        {request && (
          <motion.div
            key="req-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: IOS_EASE }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`요청 상세: ${request.title}`}
            onClick={handleRequestClose}
          >
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }}
            transition={IOS_SPRING_SHEET}
            className="glass-elevated flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-[28px] sm:rounded-[28px] text-slate-900 dark:text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/30 dark:border-white/15 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <TypeIcon
              icon={request.type?.icon}
              color={request.type?.color}
              size="sm"
            />
            <span className="text-sm font-bold truncate">
              {request.type?.name ?? '일반 요청'}
            </span>
            <StatusBadge status={request.status} size="sm" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onStartParticipantChat && participantIds.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onStartParticipantChat(
                    participantIds,
                    participantIds.length > 1 ? request.title : undefined
                  )
                }
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/35 dark:bg-white/10 border border-white/40 dark:border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/55 dark:hover:bg-white/20 min-h-[36px]"
              >
                <MessageCircle size={14} aria-hidden="true" />
                <span className="hidden sm:inline">참여자 채팅</span>
              </button>
            )}
            {isRequester && editPermission.allowed && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/35 dark:bg-white/10 border border-white/40 dark:border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/55 dark:hover:bg-white/20 min-h-[36px]"
              >
                <Edit3 size={14} aria-hidden="true" />
                수정
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmModal('deleteRequest')}
                className="focus-glass glass-press inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-500/25 min-h-[36px]"
              >
                <Trash2 size={14} aria-hidden="true" />
                {isRequester && currentUser.role !== 'admin' ? '요청 취소' : '삭제'}
              </button>
            )}
            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="요청 상세 닫기"
              className="focus-glass glass-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 dark:bg-white/10 hover:bg-white/50 dark:hover:bg-white/20"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6">
          {actionError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-950 dark:text-rose-100"
            >
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Main Body or Edit Form */}
          {editing ? (
            <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="edit-title"
                  className="block text-xs font-bold mb-1"
                >
                  제목 <span className="text-rose-600">*</span>
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  aria-invalid={isInvalid('editTitle')}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    clearFieldInvalid('editTitle');
                  }}
                  className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-semibold ${
                    isInvalid('editTitle') ? 'input-invalid' : ''
                  }`}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-content"
                  className="block text-xs font-bold mb-1"
                >
                  상세 내용 <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="edit-content"
                  rows={3}
                  value={editContent}
                  aria-invalid={isInvalid('editContent')}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    clearFieldInvalid('editContent');
                  }}
                  className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm ${
                    isInvalid('editContent') ? 'input-invalid' : ''
                  }`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-due" className="block text-xs font-bold mb-1">
                    희망 마감일
                  </label>
                  <input
                    id="edit-due"
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="focus-glass glass w-full rounded-[16px] px-4 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-xs font-bold mb-1">긴급도</span>
                  <div className="glass grid grid-cols-3 gap-1 rounded-[16px] p-1">
                    {(['낮음', '보통', '높음'] as UrgencyLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditUrgency(lvl)}
                        className={`rounded-[12px] py-1.5 text-xs font-bold ${
                          editUrgency === lvl
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                            : ''
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {request.type && request.type.fields.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/25">
                  {request.type.fields.map((field) => {
                    const editFieldKey = `editField_${field.id}`;
                    const editFieldId = `edit-custom-field-${field.id}`;
                    const fieldInvalid = isInvalid(editFieldKey);
                    return (
                      <div key={field.id}>
                        <label
                          htmlFor={editFieldId}
                          className="block text-xs font-bold mb-1"
                        >
                          {field.label}
                          {field.required && <span className="text-rose-600 ml-1">*</span>}
                        </label>
                        {field.type === 'checkbox' ? (
                          <label
                            id={`edit-custom-field-wrap-${field.id}`}
                            htmlFor={editFieldId}
                            className={`glass inline-flex items-center gap-2 rounded-[14px] px-3.5 py-2 cursor-pointer ${
                              fieldInvalid ? 'input-invalid' : ''
                            }`}
                          >
                            <input
                              id={editFieldId}
                              type="checkbox"
                              checked={Boolean(editFields[field.id])}
                              aria-invalid={fieldInvalid}
                              onChange={(e) => {
                                clearFieldInvalid(editFieldKey);
                                setEditFields((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.checked,
                                }));
                              }}
                            />
                            <span className="text-xs font-semibold">확인</span>
                          </label>
                        ) : (
                          <input
                            id={editFieldId}
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={String(editFields[field.id] ?? '')}
                            aria-invalid={fieldInvalid}
                            onChange={(e) => {
                              clearFieldInvalid(editFieldKey);
                              setEditFields((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }));
                            }}
                            className={`focus-glass glass w-full rounded-[16px] px-4 py-2 text-sm ${
                              fieldInvalid ? 'input-invalid' : ''
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isEditDirty) {
                      setConfirmModal('cancelEdit');
                      return;
                    }
                    clearAllInvalid();
                    setActionError(null);
                    setEditing(false);
                  }}
                  className="focus-glass rounded-full bg-white/30 dark:bg-white/10 px-4 py-2 text-xs font-semibold min-h-[40px]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="focus-glass rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2 text-xs font-bold min-h-[40px]"
                >
                  저장하기
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight leading-snug">
                  {request.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <UserAvatar user={request.requester} size="xs" />
                    {request.requester?.name ?? '알 수 없음'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatKoreanDateTime(request.createdAt)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <UrgencyLabel urgency={request.urgency} />
                  {request.dueDate && dday && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold tabular-nums">
                        마감 {request.dueDate} ({dday.label})
                      </span>
                    </>
                  )}
                </div>
              </div>

              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
                {request.content}
              </p>

              {/* Dynamic Field Values */}
              {request.type && request.type.fields.length > 0 && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-[20px] bg-white/28 dark:bg-white/8 border border-white/35 dark:border-white/15 p-4">
                  {request.type.fields.map((f) => {
                    const val = request.fieldValues[f.id];
                    const formatted =
                      f.type === 'checkbox'
                        ? val
                          ? '예'
                          : '아니오'
                        : val === undefined || val === ''
                          ? '—'
                          : String(val);
                    return (
                      <div key={f.id}>
                        <dt className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {f.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold break-words">
                          {formatted}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}

              {/* Reject Reason Callout */}
              {request.status === '반려' && request.rejectReason && (
                <div className="rounded-[20px] border border-rose-400/50 bg-rose-500/18 p-4">
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    반려 사유
                  </div>
                  <p className="mt-1 text-sm font-medium text-rose-950 dark:text-rose-100">
                    {request.rejectReason}
                  </p>
                </div>
              )}

              {/* Hold / Delay Reason Callout */}
              {request.status === '보류' && request.holdReason && (
                <div className="rounded-[20px] border border-indigo-400/50 bg-indigo-500/18 p-4">
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    보류 사유
                  </div>
                  <p className="mt-1 text-sm font-medium text-indigo-950 dark:text-indigo-100">
                    {request.holdReason}
                  </p>
                </div>
              )}

              {/* Requester edit lock notice after 진행 중 */}
              {isRequester && !editPermission.allowed && (
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {editPermission.reason}
                </p>
              )}
            </div>
          )}

          {/* Recipients */}
          <div className="pt-4 border-t border-white/30 dark:border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                담당자 ({assignees.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {assignees.map((rec) => (
                  <div
                    key={rec.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/40 dark:bg-white/12 border border-white/45 dark:border-white/20 px-2.5 py-1 text-xs font-semibold"
                  >
                    <UserAvatar user={rec.user} size="xs" />
                    <span>{rec.user?.name ?? '알 수 없음'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                참조자 ({ccList.length})
              </div>
              {ccList.length === 0 ? (
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  지정된 참조자 없음
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ccList.map((rec) => (
                    <div
                      key={rec.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/25 dark:bg-white/8 border border-white/30 dark:border-white/15 px-2.5 py-1 text-xs font-medium"
                    >
                      <UserAvatar user={rec.user} size="xs" />
                      <span>{rec.user?.name ?? '알 수 없음'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignee Status Actions */}
          {transitions.length > 0 && (
            <div className="rounded-[22px] bg-white/32 dark:bg-white/10 border border-white/45 dark:border-white/20 p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                담당자 상태 처리
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {transitions.map((opt) => (
                  <button
                    key={opt.toStatus}
                    type="button"
                    onClick={() => handleStatusClick(opt.toStatus, opt.label, opt.requiresReason)}
                    className={`focus-glass glass-press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold min-h-[40px] ${
                      opt.primary
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md'
                        : opt.toStatus === '반려'
                          ? 'bg-rose-500/20 text-rose-900 dark:text-rose-100 border border-rose-400/50 hover:bg-rose-500/30'
                          : opt.toStatus === '보류'
                            ? 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 border border-indigo-400/50 hover:bg-indigo-500/30'
                            : 'bg-white/45 dark:bg-white/15 border border-white/50 dark:border-white/20 hover:bg-white/65'
                    }`}
                  >
                    {opt.primary && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                    {opt.label}
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {reasonTargetStatus && (
                  <motion.form
                    key={`status-reason-form-${reasonTargetStatus}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={IOS_SPRING_CONTENT}
                    onSubmit={handleSubmitReason}
                    noValidate
                    className="overflow-hidden mt-2 pt-3 border-t border-white/30 dark:border-white/15 space-y-2.5"
                  >
                    <label
                      htmlFor="status-reason-input"
                      className={`block text-xs font-bold ${
                        reasonTargetStatus === '보류'
                          ? 'text-indigo-900 dark:text-indigo-200'
                          : 'text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      {reasonTargetStatus === '보류' ? '보류 사유' : '반려 사유'}{' '}
                      <span className="text-rose-600">*</span> (필수)
                    </label>
                    <textarea
                      id="status-reason-input"
                      rows={2}
                      value={reasonText}
                      aria-invalid={isInvalid('statusReason')}
                      onChange={(e) => {
                        setReasonText(e.target.value);
                        clearFieldInvalid('statusReason');
                      }}
                      placeholder={
                        reasonTargetStatus === '보류'
                          ? '일정이 미뤄진 이유와 예상 재개 시점을 입력해 주세요'
                          : '요청자가 이해할 수 있도록 반려 사유를 입력해 주세요'
                      }
                      className={`focus-glass glass w-full rounded-[16px] px-3.5 py-2.5 text-sm ${
                        isInvalid('statusReason') ? 'input-invalid' : ''
                      }`}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (reasonText.trim()) {
                            setConfirmModal('cancelReason');
                            return;
                          }
                          setReasonTargetStatus(null);
                          setReasonText('');
                          clearFieldInvalid('statusReason');
                        }}
                        className="focus-glass rounded-full bg-white/35 dark:bg-white/10 px-3.5 py-1.5 text-xs font-semibold min-h-[36px]"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className={`focus-glass rounded-full text-white px-4 py-1.5 text-xs font-bold min-h-[36px] ${
                          reasonTargetStatus === '보류' ? 'bg-indigo-600' : 'bg-rose-600'
                        }`}
                      >
                        {reasonTargetStatus === '보류' ? '보류 확정' : '반려 확정'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Status Timeline */}
          <div className="pt-4 border-t border-white/30 dark:border-white/15 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Clock size={14} aria-hidden="true" />
              상태 변경 이력
            </div>
            <ol className="space-y-2.5">
              {request.statusLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar user={log.actor} size="xs" />
                    <div className="min-w-0">
                      <span className="font-bold">{log.actor?.name ?? '알 수 없음'}</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {log.fromStatus
                          ? `님이 ${log.fromStatus} → ${log.toStatus}(으)로 변경`
                          : `님이 요청을 ${log.toStatus} 상태로 등록`}
                      </span>
                      {log.note && (
                        <p
                          className={`mt-0.5 ${
                            log.toStatus === '보류'
                              ? 'text-indigo-800 dark:text-indigo-200'
                              : 'text-rose-800 dark:text-rose-200'
                          }`}
                        >
                          사유: {log.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                    {formatKoreanDateTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Comments Thread */}
          <div className="pt-4 border-t border-white/30 dark:border-white/15 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              소통 댓글 ({request.comments.length})
            </div>

            {request.comments.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400 py-2">
                아직 댓글이 없습니다. 진행 상황이나 궁금한 점을 남겨보세요.
              </p>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {request.comments.map((cmt) => {
                    const isMine = cmt.authorId === currentUser.id;
                    return (
                      <motion.div
                        key={cmt.id}
                        layout="position"
                        initial={{ opacity: 0, y: 16, scale: 0.9, x: isMine ? 8 : -8 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={IOS_SPRING_IMESSAGE}
                        style={{ transformOrigin: isMine ? 'bottom right' : 'bottom left' }}
                        className={`rounded-[18px] p-3.5 border ${
                          isMine
                            ? 'bg-white/48 dark:bg-white/14 border-white/55 dark:border-white/22 shadow-sm'
                            : 'bg-white/28 dark:bg-white/8 border-white/35 dark:border-white/12'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={cmt.author} size="xs" />
                            <span className="text-xs font-bold">
                              {cmt.author?.name ?? '알 수 없음'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                            {formatKoreanDateTime(cmt.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                          {cmt.body}
                        </p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={commentsEndRef} />
              </div>
            )}

            <form onSubmit={handlePostComment} noValidate className="flex gap-2 pt-1">
              <label htmlFor="comment-input" className="sr-only">
                댓글 입력
              </label>
              <input
                id="comment-input"
                type="text"
                value={commentBody}
                aria-invalid={isInvalid('commentBody')}
                onChange={(e) => {
                  setCommentBody(e.target.value);
                  clearFieldInvalid('commentBody');
                }}
                placeholder="댓글로 진행 상황을 공유하거나 질문해 보세요..."
                className={`focus-glass glass min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400 min-h-[44px] ${
                  isInvalid('commentBody') ? 'input-invalid' : ''
                }`}
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.92 }}
                transition={IOS_SPRING_SNAPPY}
                aria-label="댓글 등록"
                className="focus-glass glass-press inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-bold shrink-0 min-h-[44px]"
              >
                <Send size={15} aria-hidden="true" />
                등록
              </motion.button>
            </form>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      <ConfirmDeleteModal
        open={Boolean(request && pendingStatusConfirm !== null)}
        variant={pendingStatusConfirm?.toStatus === '반려' ? 'danger' : 'neutral'}
        icon={pendingStatusConfirm?.toStatus === '반려' ? 'danger' : 'confirm'}
        title={
          pendingStatusConfirm
            ? `"${pendingStatusConfirm.toStatus}" 상태로 변경`
            : '상태 변경 확인'
        }
        message={
          pendingStatusConfirm && request
            ? pendingStatusConfirm.reason
              ? `"${request.title}" 요청을 "${pendingStatusConfirm.toStatus}" 상태로 변경하시겠습니까? (사유: ${pendingStatusConfirm.reason})`
              : `"${request.title}" 요청을 "${pendingStatusConfirm.toStatus}" 상태로 변경하시겠습니까?`
            : ''
        }
        confirmLabel={
          pendingStatusConfirm?.toStatus === '반려'
            ? '반려하기'
            : pendingStatusConfirm?.toStatus === '보류'
              ? '보류하기'
              : '변경하기'
        }
        cancelLabel="취소"
        onCancel={() => setPendingStatusConfirm(null)}
        onConfirm={() => {
          const target = pendingStatusConfirm;
          setPendingStatusConfirm(null);
          if (!request || !target) return;
          const res = onUpdateStatus(request.id, target.toStatus, target.reason);
          if (!res.ok) {
            setActionError(res.error);
            if (target.toStatus === '반려' || target.toStatus === '보류') {
              triggerInvalid(
                [{ key: 'statusReason', elementId: 'status-reason-input' }],
                'status-reason-input'
              );
            }
            return;
          }
          clearFieldInvalid('statusReason');
          setReasonTargetStatus(null);
          setReasonText('');
        }}
      />

      <ConfirmDeleteModal
        open={Boolean(request && confirmModal !== null)}
        variant={confirmModal === 'deleteRequest' ? 'danger' : 'neutral'}
        title={
          confirmModal === 'deleteRequest'
            ? isRequester && currentUser.role !== 'admin'
              ? '요청 취소 확인'
              : '요청 삭제 확인'
            : confirmModal === 'cancelEdit'
              ? '수정 취소 확인'
              : confirmModal === 'cancelReason'
                ? reasonTargetStatus === '보류'
                  ? '보류 작성 취소'
                  : '반려 작성 취소'
                : '편집 내용 나가기'
        }
        message={
          confirmModal === 'deleteRequest'
            ? isRequester && currentUser.role !== 'admin'
              ? '정말 이 요청을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
              : '정말 이 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
            : confirmModal === 'cancelEdit'
              ? '수정한 내용을 저장하지 않고 취소하시겠습니까?'
              : confirmModal === 'cancelReason'
                ? reasonTargetStatus === '보류'
                  ? '작성 중인 보류 사유를 취소하시겠습니까?'
                  : '작성 중인 반려 사유를 취소하시겠습니까?'
                : '작성 중인 내용을 저장하지 않고 나가시겠습니까?'
        }
        confirmLabel={
          confirmModal === 'deleteRequest'
            ? isRequester && currentUser.role !== 'admin'
              ? '요청 취소'
              : '삭제'
            : '나가기'
        }
        cancelLabel="돌아가기"
        onCancel={() => setConfirmModal(null)}
        onConfirm={() => {
          const action = confirmModal;
          setConfirmModal(null);
          if (action === 'deleteRequest' && request) {
            const res = onDeleteRequest(request.id);
            if (res.ok) {
              onClose();
            } else {
              setActionError(res.error);
            }
            return;
          }
          if (action === 'cancelEdit') {
            clearAllInvalid();
            setActionError(null);
            setEditing(false);
            return;
          }
          if (action === 'cancelReason') {
            setReasonTargetStatus(null);
            setReasonText('');
            clearFieldInvalid('statusReason');
            return;
          }
          if (action === 'closeWhileEditing') {
            clearAllInvalid();
            setActionError(null);
            setEditing(false);
            setReasonTargetStatus(null);
            setReasonText('');
            onClose();
          }
        }}
      />
    </>,
    document.body
  );
}
