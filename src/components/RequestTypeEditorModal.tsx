import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react';
import type {
  CustomFieldDefinition,
  CustomFieldType,
  RequestType,
  RequestTypeColor,
  RequestTypeIconName,
  User,
} from '../types/models';
import { moveFieldItem, type RequestTypeInput } from '../utils/requestTypeRules';
import { useFormValidationFeedback } from '../utils/formFeedback';
import { IOS_EASE, IOS_SPRING_CONTENT, IOS_SPRING_SHEET } from '../utils/motionPresets';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { TypeIcon } from './TypeIcon';
import { UserAvatar } from './UserAvatar';

const ICON_OPTIONS: Array<{ value: RequestTypeIconName; label: string }> = [
  { value: 'Package', label: '비품·상자' },
  { value: 'Laptop', label: 'IT·장비' },
  { value: 'Handshake', label: '협업' },
  { value: 'FileCheck', label: '문서·검토' },
  { value: 'CalendarDays', label: '일정·행사' },
  { value: 'MessageSquareHeart', label: '건의·소통' },
  { value: 'Sparkles', label: '아이디어' },
  { value: 'ClipboardList', label: '체크리스트' },
];

const COLOR_OPTIONS: Array<{ value: RequestTypeColor; label: string; dot: string }> = [
  { value: 'blue', label: '파랑', dot: 'bg-sky-500' },
  { value: 'purple', label: '보라', dot: 'bg-violet-500' },
  { value: 'orange', label: '주황', dot: 'bg-amber-500' },
  { value: 'emerald', label: '초록', dot: 'bg-emerald-500' },
  { value: 'pink', label: '분홍', dot: 'bg-rose-500' },
  { value: 'teal', label: '민트', dot: 'bg-teal-500' },
];

const FIELD_TYPE_LABELS: Array<{ value: CustomFieldType; label: string }> = [
  { value: 'text', label: '한 줄 텍스트' },
  { value: 'textarea', label: '여러 줄 텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'date', label: '날짜' },
  { value: 'select', label: '단일 선택' },
  { value: 'checkbox', label: '체크박스' },
];

function createEmptyField(index: number): CustomFieldDefinition {
  return {
    id: `field_${Date.now().toString(36)}_${index}`,
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
  };
}

export function RequestTypeEditorModal({
  open,
  editingType,
  teamMembers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editingType: RequestType | null;
  teamMembers: User[];
  onClose: () => void;
  onSubmit: (
    input: RequestTypeInput,
    editingId: string | null
  ) => { ok: true } | { ok: false; error: string };
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<RequestTypeIconName>('ClipboardList');
  const [color, setColor] = useState<RequestTypeColor>('blue');
  const [defaultAssigneeIds, setDefaultAssigneeIds] = useState<string[]>([]);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [optionsTextMap, setOptionsTextMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [confirmDeleteFieldIdx, setConfirmDeleteFieldIdx] = useState<number | null>(null);

  const { isInvalid, clearFieldInvalid, clearAllInvalid, triggerInvalid } =
    useFormValidationFeedback();

  useEffect(() => {
    if (!open) return;
    setError(null);
    clearAllInvalid();
    if (editingType) {
      setName(editingType.name);
      setDescription(editingType.description ?? '');
      setIcon(editingType.icon);
      setColor(editingType.color);
      setDefaultAssigneeIds([...editingType.defaultAssigneeIds]);
      const cloned = editingType.fields.map((f) => ({
        ...f,
        options: f.options ? [...f.options] : [],
      }));
      setFields(cloned);
      const map: Record<string, string> = {};
      for (const f of cloned) {
        if (f.options && f.options.length > 0) {
          map[f.id] = f.options.join(', ');
        }
      }
      setOptionsTextMap(map);
    } else {
      setName('');
      setDescription('');
      setIcon('ClipboardList');
      setColor('blue');
      setDefaultAssigneeIds([]);
      setFields([createEmptyField(0)]);
      setOptionsTextMap({});
    }
    setConfirmExitOpen(false);
    setConfirmDeleteFieldIdx(null);
  }, [open, editingType]);

  const isDirty = editingType
    ? name !== editingType.name ||
      description !== (editingType.description ?? '') ||
      icon !== editingType.icon ||
      color !== editingType.color ||
      fields.length !== editingType.fields.length ||
      fields.some(
        (f, i) =>
          f.label !== editingType.fields[i]?.label ||
          f.type !== editingType.fields[i]?.type ||
          Boolean(f.required) !== Boolean(editingType.fields[i]?.required)
      )
    : Boolean(
        name.trim() ||
          description.trim() ||
          defaultAssigneeIds.length > 0 ||
          fields.some((f) => f.label.trim())
      );

  const handleRequestClose = () => {
    if (isDirty) {
      setConfirmExitOpen(true);
      return;
    }
    onClose();
  };

  const toggleDefaultAssignee = (userId: string) => {
    setDefaultAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const updateField = (idx: number, patch: Partial<CustomFieldDefinition>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const preparedFields = fields.map((f) => {
      if (f.type === 'select') {
        const raw = optionsTextMap[f.id] ?? (f.options ?? []).join(', ');
        const parsedOptions = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        return { ...f, options: parsedOptions };
      }
      return { ...f, options: undefined };
    });

    const missing: Array<{ key: string; elementId: string; message: string }> = [];
    if (!name.trim()) {
      missing.push({
        key: 'typeName',
        elementId: 'type-name-input',
        message: '요청 유형 이름을 입력해 주세요.',
      });
    }

    for (let i = 0; i < preparedFields.length; i++) {
      const f = preparedFields[i];
      if (!f.label.trim()) {
        missing.push({
          key: `fieldLabel_${f.id}`,
          elementId: `field-label-${f.id}`,
          message: `${i + 1}번째 양식 항목의 이름을 입력해 주세요.`,
        });
      }
      if (f.type === 'select' && (!f.options || f.options.length === 0)) {
        missing.push({
          key: `fieldOpts_${f.id}`,
          elementId: `field-opts-${f.id}`,
          message: `"${f.label.trim() || `${i + 1}번째`}" 단일 선택 항목에는 최소 1개의 선택지를 입력해 주세요.`,
        });
      }
    }

    if (missing.length > 0) {
      setError(missing[0].message);
      triggerInvalid(
        missing.map((m) => ({ key: m.key, elementId: m.elementId })),
        missing[0].elementId
      );
      return;
    }

    const res = onSubmit(
      {
        name,
        description,
        icon,
        color,
        defaultAssigneeIds,
        fields: preparedFields,
      },
      editingType?.id ?? null
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    clearAllInvalid();
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="type-editor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: IOS_EASE }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingType ? '요청 유형 수정' : '새 요청 유형 추가'}
          onClick={handleRequestClose}
        >
          <motion.div
            key="type-editor-sheet"
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }}
            transition={IOS_SPRING_SHEET}
            className="glass-elevated flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-[28px] sm:rounded-[28px] text-slate-900 dark:text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/30 dark:border-white/15 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <TypeIcon icon={icon} color={color} size="md" />
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold tracking-tight truncate">
                    {editingType ? '요청 유형 수정' : '새 요청 유형 추가'}
                  </h2>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    유형 정보, 기본 담당자 및 동적 입력 양식을 설정합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestClose}
                aria-label="유형 편집 창 닫기"
                className="focus-glass glass-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 dark:bg-white/10 hover:bg-white/50 dark:hover:bg-white/20"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
                {error && (
                  <div
                    role="alert"
                    className="rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-950 dark:text-rose-100"
                  >
                    {error}
                  </div>
                )}

                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="type-name-input"
                      className="block text-xs font-bold mb-1.5"
                    >
                      유형 이름 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="type-name-input"
                      type="text"
                      value={name}
                      aria-invalid={isInvalid('typeName')}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldInvalid('typeName');
                      }}
                      placeholder="예: 법무 계약 검토, 장비 대여"
                      className={`focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm font-semibold ${
                        isInvalid('typeName') ? 'input-invalid' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="type-desc-input"
                      className="block text-xs font-bold mb-1.5"
                    >
                      간단한 설명
                    </label>
                    <input
                      id="type-desc-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="어떤 요청일 때 선택하는지 안내 문구"
                      className="focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Icon & Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold mb-2">아이콘</span>
                    <div className="grid grid-cols-4 gap-2">
                      {ICON_OPTIONS.map((opt) => {
                        const selected = icon === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setIcon(opt.value)}
                            aria-label={`아이콘 ${opt.label}`}
                            aria-pressed={selected}
                            className={`focus-glass glass-press flex flex-col items-center gap-1 rounded-[16px] p-2 text-[11px] font-semibold border ${
                              selected
                                ? 'bg-white/65 dark:bg-white/20 border-slate-900/45 dark:border-white/50 shadow-sm'
                                : 'bg-white/20 dark:bg-white/5 border-white/30 dark:border-white/10'
                            }`}
                          >
                            <TypeIcon icon={opt.value} color={color} size="sm" />
                            <span className="truncate max-w-full">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-bold mb-2">유형 색상</span>
                    <div className="grid grid-cols-3 gap-2">
                      {COLOR_OPTIONS.map((c) => {
                        const selected = color === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setColor(c.value)}
                            aria-pressed={selected}
                            className={`focus-glass glass-press flex items-center gap-2 rounded-[16px] px-3 py-2.5 text-xs font-bold border ${
                              selected
                                ? 'bg-white/65 dark:bg-white/20 border-slate-900/45 dark:border-white/50 shadow-sm'
                                : 'bg-white/20 dark:bg-white/5 border-white/30 dark:border-white/10'
                            }`}
                          >
                            <span
                              className={`h-3.5 w-3.5 rounded-full ${c.dot} shrink-0`}
                              aria-hidden="true"
                            />
                            <span>{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Default Assignees */}
                <div>
                  <span className="block text-xs font-bold mb-2">
                    기본 담당자 (선택 · 요청 시 자동 채움)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map((member) => {
                      const selected = defaultAssigneeIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleDefaultAssignee(member.id)}
                          aria-pressed={selected}
                          className={`focus-glass glass-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[36px] ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'
                              : 'bg-white/35 dark:bg-white/10 border-white/40 dark:border-white/15'
                          }`}
                        >
                          <UserAvatar user={member} size="xs" />
                          <span>{member.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Form Fields Editor */}
                <div className="pt-3 border-t border-white/30 dark:border-white/15 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold">
                        양식 항목 편집 ({fields.length}개)
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        제목·상세내용·마감일·긴급도는 공통으로 포함됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFields((prev) => [...prev, createEmptyField(prev.length)])
                      }
                      className="focus-glass glass-press inline-flex items-center gap-1 rounded-full bg-white/55 dark:bg-white/15 border border-white/55 dark:border-white/25 px-3.5 py-2 text-xs font-bold min-h-[38px]"
                    >
                      <Plus size={14} aria-hidden="true" />
                      항목 추가
                    </button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="glass rounded-[18px] p-4 text-center text-xs text-slate-600 dark:text-slate-400">
                      추가 양식 항목이 없습니다. 공통 항목(제목, 내용, 마감일, 긴급도)만 사용합니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {fields.map((field, index) => {
                          const labelKey = `fieldLabel_${field.id}`;
                          const optsKey = `fieldOpts_${field.id}`;
                          return (
                            <motion.div
                              key={field.id}
                              layout
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.97 }}
                              transition={IOS_SPRING_CONTENT}
                              className="glass rounded-[20px] p-3.5 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">
                                  항목 {index + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() =>
                                      setFields((prev) => moveFieldItem(prev, index, 'up'))
                                    }
                                    aria-label={`항목 ${index + 1} 위로 이동`}
                                    className="focus-glass inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/35 dark:bg-white/10 disabled:opacity-35"
                                  >
                                    <ArrowUp size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === fields.length - 1}
                                    onClick={() =>
                                      setFields((prev) => moveFieldItem(prev, index, 'down'))
                                    }
                                    aria-label={`항목 ${index + 1} 아래로 이동`}
                                    className="focus-glass inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/35 dark:bg-white/10 disabled:opacity-35"
                                  >
                                    <ArrowDown size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteFieldIdx(index)}
                                    aria-label={`항목 ${index + 1} 삭제`}
                                    className="focus-glass inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25"
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                <div className="sm:col-span-5">
                                  <label
                                    htmlFor={`field-label-${field.id}`}
                                    className="sr-only"
                                  >
                                    항목 이름
                                  </label>
                                  <input
                                    id={`field-label-${field.id}`}
                                    type="text"
                                    value={field.label}
                                    aria-invalid={isInvalid(labelKey)}
                                    onChange={(e) => {
                                      clearFieldInvalid(labelKey);
                                      updateField(index, { label: e.target.value });
                                    }}
                                    placeholder="항목 이름 * (예: 품목, 수량)"
                                    className={`focus-glass w-full rounded-[14px] bg-white/40 dark:bg-white/10 border border-white/45 dark:border-white/15 px-3 py-2 text-xs font-semibold ${
                                      isInvalid(labelKey) ? 'input-invalid' : ''
                                    }`}
                                  />
                                </div>

                                <div className="sm:col-span-4">
                                  <label
                                    htmlFor={`field-type-${field.id}`}
                                    className="sr-only"
                                  >
                                    항목 종류
                                  </label>
                                  <select
                                    id={`field-type-${field.id}`}
                                    value={field.type}
                                    onChange={(e) =>
                                      updateField(index, {
                                        type: e.target.value as CustomFieldType,
                                      })
                                    }
                                    className="focus-glass w-full rounded-[14px] bg-white/40 dark:bg-white/10 border border-white/45 dark:border-white/15 px-3 py-2 text-xs font-semibold"
                                  >
                                    {FIELD_TYPE_LABELS.map((opt) => (
                                      <option
                                        key={opt.value}
                                        value={opt.value}
                                        className="text-slate-900"
                                      >
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <label className="sm:col-span-3 inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(field.required)}
                                    onChange={(e) =>
                                      updateField(index, { required: e.target.checked })
                                    }
                                    className="h-4 w-4 accent-slate-900 dark:accent-white"
                                  />
                                  필수 입력
                                </label>
                              </div>

                              {field.type === 'select' ? (
                                <div>
                                  <label
                                    htmlFor={`field-opts-${field.id}`}
                                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                                  >
                                    선택지 (쉼표로 구분) <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                    id={`field-opts-${field.id}`}
                                    type="text"
                                    aria-invalid={isInvalid(optsKey)}
                                    value={
                                      optionsTextMap[field.id] ??
                                      (field.options ?? []).join(', ')
                                    }
                                    onChange={(e) => {
                                      clearFieldInvalid(optsKey);
                                      setOptionsTextMap((prev) => ({
                                        ...prev,
                                        [field.id]: e.target.value,
                                      }));
                                    }}
                                    placeholder="예: 높음, 보통, 낮음"
                                    className={`focus-glass w-full rounded-[14px] bg-white/40 dark:bg-white/10 border border-white/45 dark:border-white/15 px-3 py-2 text-xs ${
                                      isInvalid(optsKey) ? 'input-invalid' : ''
                                    }`}
                                  />
                                </div>
                              ) : (
                                field.type !== 'checkbox' &&
                                field.type !== 'date' && (
                                  <div>
                                    <label
                                      htmlFor={`field-ph-${field.id}`}
                                      className="sr-only"
                                    >
                                      안내 문구
                                    </label>
                                    <input
                                      id={`field-ph-${field.id}`}
                                      type="text"
                                      value={field.placeholder ?? ''}
                                      onChange={(e) =>
                                        updateField(index, {
                                          placeholder: e.target.value,
                                        })
                                      }
                                      placeholder="입력 안내 문구 (선택)"
                                      className="focus-glass w-full rounded-[14px] bg-white/30 dark:bg-white/8 border border-white/35 dark:border-white/12 px-3 py-2 text-xs"
                                    />
                                  </div>
                                )
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-white/30 dark:border-white/15 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="focus-glass glass-press rounded-full bg-white/35 dark:bg-white/10 border border-white/45 dark:border-white/20 px-4 py-2.5 text-sm font-semibold min-h-[44px]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2.5 text-sm font-bold shadow-md min-h-[44px]"
                >
                  <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                  {editingType ? '수정 완료' : '유형 추가하기'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <ConfirmDeleteModal
      open={confirmDeleteFieldIdx !== null}
      title="양식 항목 삭제 확인"
      message={(() => {
        const target =
          confirmDeleteFieldIdx !== null ? fields[confirmDeleteFieldIdx] : undefined;
        const label = target?.label.trim()
          ? `"${target.label}"`
          : `${(confirmDeleteFieldIdx ?? 0) + 1}번째 양식`;
        return `${label} 항목을 삭제하시겠습니까?`;
      })()}
      confirmLabel="삭제"
      cancelLabel="취소"
      onCancel={() => setConfirmDeleteFieldIdx(null)}
      onConfirm={() => {
        if (confirmDeleteFieldIdx !== null) {
          setFields((prev) => prev.filter((_, i) => i !== confirmDeleteFieldIdx));
        }
        setConfirmDeleteFieldIdx(null);
      }}
    />

    <ConfirmDeleteModal
      open={confirmExitOpen}
      variant="neutral"
      title="편집 취소 확인"
      message="변경한 내용을 저장하지 않고 나가시겠습니까?"
      confirmLabel="나가기"
      cancelLabel="계속 편집"
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
