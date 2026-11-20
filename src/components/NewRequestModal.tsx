import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  CreateRequestInput,
  FieldValue,
  RecipientRole,
  RequestType,
  UrgencyLevel,
  User,
} from '../types/models';
import { validateRecipients } from '../utils/requestRules';
import { useFormValidationFeedback } from '../utils/formFeedback';
import {
  IOS_EASE,
  IOS_SPRING_CONTENT,
  IOS_SPRING_SHEET,
  IOS_SPRING_SNAPPY,
} from '../utils/motionPresets';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { TypeIcon } from './TypeIcon';
import { UserAvatar } from './UserAvatar';

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: '유형 선택',
  2: '내용 작성',
  3: '전달할 사람',
  4: '최종 확인',
};

export function NewRequestModal({
  open,
  currentUser,
  requestTypes,
  teamMembers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  currentUser: User;
  requestTypes: RequestType[];
  teamMembers: User[];
  onClose: () => void;
  onSubmit: (input: CreateRequestInput) => { ok: true } | { ok: false; error: string };
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('보통');
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [recipients, setRecipients] = useState<
    Array<{ userId: string; role: RecipientRole }>
  >([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const { isInvalid, clearFieldInvalid, clearAllInvalid, triggerInvalid } =
    useFormValidationFeedback();

  useEffect(() => {
    if (open) {
      setStep(1);
      setStepDir(1);
      setSelectedTypeId('');
      setTitle('');
      setContent('');
      setDueDate('');
      setUrgency('보통');
      setFieldValues({});
      setRecipients([]);
      setMemberQuery('');
      setError(null);
      setConfirmExitOpen(false);
      clearAllInvalid();
    }
  }, [open, clearAllInvalid]);

  const selectedType = useMemo(
    () => requestTypes.find((t) => t.id === selectedTypeId) ?? null,
    [requestTypes, selectedTypeId]
  );

  const memberMap = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m])),
    [teamMembers]
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const selectedSet = new Set(recipients.map((r) => r.userId));
    return teamMembers.filter((m) => {
      if (selectedSet.has(m.id)) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.title ?? '').toLowerCase().includes(q)
      );
    });
  }, [teamMembers, recipients, memberQuery]);

  const handleSelectType = (type: RequestType) => {
    setSelectedTypeId(type.id);
    setError(null);
    // 기본값 초기화
    const initialFields: Record<string, FieldValue> = {};
    for (const f of type.fields) {
      if (f.type === 'checkbox') initialFields[f.id] = false;
      else initialFields[f.id] = '';
    }
    setFieldValues(initialFields);

    // 기본 담당자 미리 채우기 (요청자가 자유롭게 추가/삭제 가능)
    const defaults = type.defaultAssigneeIds
      .filter((id) => memberMap.has(id))
      .map((userId) => ({ userId, role: 'assignee' as const }));
    setRecipients(defaults);
    setStepDir(1);
    clearAllInvalid();
    setStep(2);
  };

  const validateStep2 = (): boolean => {
    const missing: Array<{ key: string; elementId: string; message: string; focusId?: string }> = [];

    if (!title.trim()) {
      missing.push({
        key: 'title',
        elementId: 'req-title',
        message: '요청 제목을 입력해 주세요.',
      });
    }
    if (!content.trim()) {
      missing.push({
        key: 'content',
        elementId: 'req-content',
        message: '상세 내용을 입력해 주세요.',
      });
    }
    if (selectedType) {
      for (const field of selectedType.fields) {
        if (!field.required) continue;
        const val = fieldValues[field.id];
        if (field.type === 'checkbox') {
          if (!val) {
            missing.push({
              key: `field_${field.id}`,
              elementId: `custom-field-wrap-${field.id}`,
              focusId: `custom-field-${field.id}`,
              message: `"${field.label}" 항목을 확인해 주세요.`,
            });
          }
        } else if (val === undefined || val === null || String(val).trim() === '') {
          missing.push({
            key: `field_${field.id}`,
            elementId: `custom-field-${field.id}`,
            message: `"${field.label}" 항목을 입력해 주세요.`,
          });
        }
      }
    }

    if (missing.length > 0) {
      setError(missing[0].message);
      triggerInvalid(
        missing.map((m) => ({ key: m.key, elementId: m.elementId })),
        missing[0].focusId ?? missing[0].elementId
      );
      return false;
    }

    clearAllInvalid();
    setError(null);
    return true;
  };

  const validateStep3 = (): boolean => {
    const check = validateRecipients(recipients);
    if (!check.valid) {
      setError(check.error ?? '최소 1명의 담당자를 지정해 주세요.');
      triggerInvalid(
        [{ key: 'recipients', elementId: 'step3-recipient-guard' }],
        'member-search'
      );
      return false;
    }
    clearFieldInvalid('recipients');
    setError(null);
    return true;
  };

  const handleAddRecipient = (userId: string, role: RecipientRole = 'assignee') => {
    setError(null);
    clearFieldInvalid('recipients');
    setRecipients((prev) => {
      if (prev.some((r) => r.userId === userId)) return prev;
      return [...prev, { userId, role }];
    });
  };

  const handleToggleRecipientRole = (userId: string, role: RecipientRole) => {
    setError(null);
    clearFieldInvalid('recipients');
    setRecipients((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, role } : r))
    );
  };

  const handleRemoveRecipient = (userId: string) => {
    setError(null);
    clearFieldInvalid('recipients');
    setRecipients((prev) => prev.filter((r) => r.userId !== userId));
  };

  const handleFinalSubmit = () => {
    if (!selectedType) return;
    const res = onSubmit({
      typeId: selectedType.id,
      requesterId: currentUser.id,
      title: title.trim(),
      content: content.trim(),
      fieldValues,
      dueDate,
      urgency,
      recipients,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  };

  const assigneeCount = recipients.filter((r) => r.role === 'assignee').length;
  const hasDraft = Boolean(step > 1 || title.trim() || content.trim());

  const handleRequestClose = () => {
    if (hasDraft) {
      setConfirmExitOpen(true);
      return;
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-req-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: IOS_EASE }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="새 요청 작성"
          onClick={handleRequestClose}
        >
          <motion.div
            key="new-req-sheet"
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }}
            transition={IOS_SPRING_SHEET}
            className="glass-elevated flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-[28px] sm:rounded-[28px] text-slate-900 dark:text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/30 dark:border-white/15 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">새 요청 올리기</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
              {step}단계 / 4 · {STEP_LABELS[step]}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="새 요청 창 닫기"
            className="focus-glass glass-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 dark:bg-white/10 hover:bg-white/50 dark:hover:bg-white/20"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Step Progress Strip */}
        <div className="grid grid-cols-4 gap-2 px-5 pt-3 sm:px-6">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => (
            <div key={s} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  s <= step
                    ? 'bg-slate-900 dark:bg-white'
                    : 'bg-white/35 dark:bg-white/15'
                }`}
              />
              <span
                className={`hidden sm:block text-[11px] font-semibold ${
                  s === step
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {s}. {STEP_LABELS[s]}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-950 dark:text-rose-100"
            >
              {error}
            </div>
          )}

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`wizard-step-${step}`}
              initial={{ opacity: 0, x: stepDir * 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: stepDir * -14 }}
              transition={IOS_SPRING_CONTENT}
            >

          {/* STEP 1: Type Grid */}
          {step === 1 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                어떤 종류의 요청인가요? 유형을 선택해 주세요.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {requestTypes.map((type) => {
                  const isSelected = type.id === selectedTypeId;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleSelectType(type)}
                      data-active={isSelected}
                      className={`focus-glass glass glass-interactive glass-press flex flex-col items-start gap-3 rounded-[22px] p-4 text-left ${
                        isSelected
                          ? 'ring-2 ring-slate-900 dark:ring-white bg-white/40 dark:bg-white/16'
                          : ''
                      }`}
                    >
                      <TypeIcon icon={type.icon} color={type.color} size="lg" />
                      <div>
                        <div className="text-base font-bold text-slate-950 dark:text-white">
                          {type.name}
                        </div>
                        {type.description && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                            {type.description}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        {type.defaultAssigneeIds.length > 0
                          ? `기본 담당자 ${type.defaultAssigneeIds.length}명 자동 지정`
                          : '담당자 직접 선택'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Content & Dynamic Form */}
          {step === 2 && selectedType && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[18px] bg-white/30 dark:bg-white/10 border border-white/40 dark:border-white/15 px-4 py-3">
                <TypeIcon icon={selectedType.icon} color={selectedType.color} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-bold">{selectedType.name}</div>
                  {selectedType.description && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {selectedType.description}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="req-title"
                  className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                >
                  요청 제목 <span className="text-rose-600">*</span>
                </label>
                <input
                  id="req-title"
                  type="text"
                  value={title}
                  aria-invalid={isInvalid('title')}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearFieldInvalid('title');
                  }}
                  placeholder="한눈에 파악할 수 있는 제목을 입력해 주세요"
                  className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 ${
                    isInvalid('title') ? 'input-invalid' : ''
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="req-content"
                  className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                >
                  상세 내용 <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="req-content"
                  rows={3}
                  value={content}
                  aria-invalid={isInvalid('content')}
                  onChange={(e) => {
                    setContent(e.target.value);
                    clearFieldInvalid('content');
                  }}
                  placeholder="배경과 필요한 내용을 구체적으로 작성해 주세요"
                  className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 resize-y ${
                    isInvalid('content') ? 'input-invalid' : ''
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="req-due-date"
                    className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    희망 마감일
                  </label>
                  <input
                    id="req-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white tabular-nums"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    긴급도
                  </span>
                  <div className="glass grid grid-cols-3 gap-1 rounded-[16px] p-1">
                    {(['낮음', '보통', '높음'] as UrgencyLevel[]).map((level) => {
                      const active = urgency === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setUrgency(level)}
                          className={`focus-glass relative rounded-[12px] py-2 text-xs font-bold transition-colors cursor-pointer ${
                            active
                              ? 'text-white dark:text-slate-950'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-white/10'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="new-req-urgency-pill"
                              transition={IOS_SPRING_SNAPPY}
                              className="pointer-events-none absolute inset-0 rounded-[12px] bg-slate-900 dark:bg-white shadow-sm"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative z-10 pointer-events-none">{level}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic Custom Fields */}
              {selectedType.fields.length > 0 && (
                <div className="pt-3 border-t border-white/30 dark:border-white/15 space-y-4">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {selectedType.name} 추가 항목
                  </div>
                  {selectedType.fields.map((field) => {
                    const inputId = `custom-field-${field.id}`;
                    const fieldKey = `field_${field.id}`;
                    const fieldInvalid = isInvalid(fieldKey);
                    const value = fieldValues[field.id];

                    if (field.type === 'checkbox') {
                      return (
                        <label
                          key={field.id}
                          id={`custom-field-wrap-${field.id}`}
                          htmlFor={inputId}
                          className={`glass flex items-center gap-3 rounded-[16px] px-4 py-3 cursor-pointer ${
                            fieldInvalid ? 'input-invalid' : ''
                          }`}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={Boolean(value)}
                            aria-invalid={fieldInvalid}
                            onChange={(e) => {
                              clearFieldInvalid(fieldKey);
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.checked,
                              }));
                            }}
                            className="h-4 w-4 rounded accent-slate-900 dark:accent-white"
                          />
                          <span className="text-sm font-medium">
                            {field.label}
                            {field.required && <span className="text-rose-600 ml-1">*</span>}
                          </span>
                        </label>
                      );
                    }

                    return (
                      <div key={field.id}>
                        <label
                          htmlFor={inputId}
                          className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                        >
                          {field.label}
                          {field.required && <span className="text-rose-600 ml-1">*</span>}
                        </label>

                        {field.type === 'textarea' ? (
                          <textarea
                            id={inputId}
                            rows={2}
                            value={String(value ?? '')}
                            placeholder={field.placeholder}
                            aria-invalid={fieldInvalid}
                            onChange={(e) => {
                              clearFieldInvalid(fieldKey);
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }));
                            }}
                            className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 ${
                              fieldInvalid ? 'input-invalid' : ''
                            }`}
                          />
                        ) : field.type === 'select' ? (
                          <select
                            id={inputId}
                            value={String(value ?? '')}
                            aria-invalid={fieldInvalid}
                            onChange={(e) => {
                              clearFieldInvalid(fieldKey);
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }));
                            }}
                            className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white ${
                              fieldInvalid ? 'input-invalid' : ''
                            }`}
                          >
                            <option value="">선택해 주세요</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt} className="text-slate-900">
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={inputId}
                            type={field.type}
                            value={String(value ?? '')}
                            placeholder={field.placeholder}
                            aria-invalid={fieldInvalid}
                            onChange={(e) => {
                              clearFieldInvalid(fieldKey);
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.id]:
                                  field.type === 'number' && e.target.value !== ''
                                    ? Number(e.target.value)
                                    : e.target.value,
                              }));
                            }}
                            className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 tabular-nums ${
                              fieldInvalid ? 'input-invalid' : ''
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Recipients */}
          {step === 3 && (
            <div
              id="step3-recipient-guard"
              className={`space-y-4 rounded-[20px] transition-colors ${
                isInvalid('recipients') ? 'input-invalid p-3' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  누구에게 전달할까요? 최소 1명의{' '}
                  <span className="underline decoration-sky-500 decoration-2 underline-offset-2">
                    담당
                  </span>
                  이 필요합니다.
                </p>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  담당 {assigneeCount}명 · 참조 {recipients.length - assigneeCount}명
                </span>
              </div>

              {/* Selected Recipients */}
              {recipients.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    선택된 전달 대상
                  </div>
                  <div className="space-y-2">
                    {recipients.map((rec) => {
                      const member = memberMap.get(rec.userId);
                      if (!member) return null;
                      return (
                        <div
                          key={rec.userId}
                          className="glass flex items-center justify-between gap-3 rounded-[18px] px-3.5 py-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar user={member} size="sm" />
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">
                                {member.name}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                {member.title ?? member.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="glass inline-flex rounded-full p-0.5">
                              <button
                                type="button"
                                aria-label={`${member.name} 담당으로 변경`}
                                onClick={() =>
                                  handleToggleRecipientRole(rec.userId, 'assignee')
                                }
                                className={`focus-glass rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                                  rec.role === 'assignee'
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                담당
                              </button>
                              <button
                                type="button"
                                aria-label={`${member.name} 참조로 변경`}
                                onClick={() =>
                                  handleToggleRecipientRole(rec.userId, 'cc')
                                }
                                className={`focus-glass rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                                  rec.role === 'cc'
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                참조
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(rec.userId)}
                              aria-label={`${member.name} 제거`}
                              className="focus-glass inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-rose-500/20 hover:text-rose-700 dark:text-slate-300"
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search & Add Members */}
              <div className="pt-2 border-t border-white/30 dark:border-white/15 space-y-2.5">
                <label
                  htmlFor="member-search"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  팀원 추가하기
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="member-search"
                    type="text"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="이름 또는 직무로 팀원 검색..."
                    className="focus-glass glass w-full rounded-[16px] pl-10 pr-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                  {filteredMembers.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-600 dark:text-slate-400">
                      추가할 수 있는 팀원이 없습니다.
                    </p>
                  ) : (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-[16px] bg-white/20 dark:bg-white/6 border border-white/25 dark:border-white/10 px-3.5 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar user={member} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {member.name}
                              {member.id === currentUser.id && (
                                <span className="ml-1 text-xs text-slate-500">(나)</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                              {member.title ?? member.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            aria-label={`${member.name} 담당자로 추가`}
                            onClick={() => handleAddRecipient(member.id, 'assignee')}
                            className="focus-glass glass-press inline-flex items-center gap-1 rounded-full bg-white/50 dark:bg-white/15 border border-white/50 dark:border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/75 dark:hover:bg-white/25 min-h-[34px]"
                          >
                            <UserPlus size={13} aria-hidden="true" />
                            담당
                          </button>
                          <button
                            type="button"
                            aria-label={`${member.name} 참조자로 추가`}
                            onClick={() => handleAddRecipient(member.id, 'cc')}
                            className="focus-glass glass-press inline-flex items-center rounded-full bg-white/25 dark:bg-white/8 border border-white/35 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/45 dark:hover:bg-white/18 min-h-[34px]"
                          >
                            참조
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Summary Review */}
          {step === 4 && selectedType && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                작성한 내용을 확인한 뒤 요청을 등록해 주세요.
              </p>

              <div className="glass rounded-[22px] p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <TypeIcon icon={selectedType.icon} color={selectedType.color} size="sm" />
                  <span className="text-sm font-bold">{selectedType.name}</span>
                  <span aria-hidden="true" className="text-slate-500">·</span>
                  <span className="text-xs font-semibold">긴급도 {urgency}</span>
                  {dueDate && (
                    <>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-xs font-semibold tabular-nums">
                        마감 {dueDate}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {content}
                  </p>
                </div>

                {selectedType.fields.length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/30 dark:border-white/15">
                    {selectedType.fields.map((f) => {
                      const raw = fieldValues[f.id];
                      const display =
                        f.type === 'checkbox'
                          ? raw
                            ? '예'
                            : '아니오'
                          : raw === '' || raw === undefined
                            ? '미입력'
                            : String(raw);
                      return (
                        <div key={f.id}>
                          <dt className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {f.label}
                          </dt>
                          <dd className="mt-0.5 text-sm font-semibold">{display}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}

                <div className="pt-3 border-t border-white/30 dark:border-white/15">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    전달 대상 ({recipients.length}명)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((rec) => {
                      const member = memberMap.get(rec.userId);
                      if (!member) return null;
                      return (
                        <div
                          key={rec.userId}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/40 dark:bg-white/12 border border-white/45 dark:border-white/20 px-2.5 py-1 text-xs font-semibold"
                        >
                          <UserAvatar user={member} size="xs" />
                          <span>{member.name}</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            ({rec.role === 'assignee' ? '담당' : '참조'})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-white/30 dark:border-white/15 px-5 py-4 sm:px-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                clearAllInvalid();
                setStepDir(-1);
                setStep((s) => (s - 1) as WizardStep);
              }}
              className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/35 dark:bg-white/10 border border-white/45 dark:border-white/20 px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              이전
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              유형 카드를 누르면 바로 작성으로 이동합니다
            </span>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                if (validateStep2()) {
                  setStepDir(1);
                  setStep(3);
                }
              }}
              className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2.5 text-sm font-bold shadow-md min-h-[44px]"
            >
              다음: 전달할 사람
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => {
                if (validateStep3()) {
                  setStepDir(1);
                  setStep(4);
                }
              }}
              className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2.5 text-sm font-bold shadow-md min-h-[44px]"
            >
              다음: 요약 확인
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-6 py-2.5 text-sm font-bold shadow-lg min-h-[44px]"
            >
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              이대로 요청 올리기
            </button>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <ConfirmDeleteModal
      open={confirmExitOpen}
      variant="neutral"
      title="작성 취소 확인"
      message="작성 중인 요청을 취소하고 나가시겠습니까? 입력한 내용은 저장되지 않습니다."
      confirmLabel="나가기"
      cancelLabel="계속 작성"
      onCancel={() => setConfirmExitOpen(false)}
      onConfirm={() => {
        setConfirmExitOpen(false);
        onClose();
      }}
    />
    </>,
    document.body
  );
}
