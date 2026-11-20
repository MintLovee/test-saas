import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Copy,
  Edit3,
  Layers,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import type { RequestType, Team, User } from '../types/models';
import type { RequestTypeInput } from '../utils/requestTypeRules';
import { IOS_SPRING_SNAPPY } from '../utils/motionPresets';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { RequestTypeEditorModal } from '../components/RequestTypeEditorModal';
import { TypeIcon } from '../components/TypeIcon';
import { UserAvatar } from '../components/UserAvatar';

export function AdminSettingsPage({
  team,
  requestTypes,
  teamMembers,
  onCreateRequestType,
  onUpdateRequestType,
  onDeleteRequestType,
  onRegenerateInviteCode,
}: {
  team: Team | null;
  requestTypes: RequestType[];
  teamMembers: User[];
  onCreateRequestType: (
    input: RequestTypeInput
  ) => { ok: true } | { ok: false; error: string };
  onUpdateRequestType: (
    typeId: string,
    input: RequestTypeInput
  ) => { ok: true } | { ok: false; error: string };
  onDeleteRequestType: (typeId: string) => { ok: true } | { ok: false; error: string };
  onRegenerateInviteCode: () => { ok: true; inviteCode: string } | { ok: false; error: string };
}) {
  const [tab, setTab] = useState<'types' | 'members'>('types');
  const [copied, setCopied] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState<RequestType | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

  const handleCopyInvite = async () => {
    if (!team?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenCreate = () => {
    setError(null);
    setEditingType(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (type: RequestType) => {
    setError(null);
    setEditingType(type);
    setEditorOpen(true);
  };

  const handleSubmitType = (input: RequestTypeInput, editingId: string | null) => {
    if (editingId) {
      return onUpdateRequestType(editingId, input);
    }
    return onCreateRequestType(input);
  };

  const handleDeleteType = (typeId: string) => {
    setError(null);
    const res = onDeleteRequestType(typeId);
    if (!res.ok) {
      setError(res.error);
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white glass-text-shadow">
            관리자 설정
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            요청 유형과 입력 양식을 자유롭게 구성하고 팀 초대 코드를 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="glass inline-flex rounded-full p-1">
            <button
              type="button"
              onClick={() => setTab('types')}
              className={`focus-glass glass-press relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold min-h-[38px] cursor-pointer touch-manipulation ${
                tab === 'types'
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab === 'types' && (
                <motion.span
                  layoutId="admin-tab-pill"
                  transition={IOS_SPRING_SNAPPY}
                  className="pointer-events-none absolute inset-0 rounded-full bg-white/75 dark:bg-white/20 border border-white/60 dark:border-white/30 shadow-sm"
                  aria-hidden="true"
                />
              )}
              <Layers size={14} className="relative z-10 pointer-events-none" aria-hidden="true" />
              <span className="relative z-10 pointer-events-none">요청 유형 ({requestTypes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('members')}
              className={`focus-glass glass-press relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold min-h-[38px] cursor-pointer touch-manipulation ${
                tab === 'members'
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab === 'members' && (
                <motion.span
                  layoutId="admin-tab-pill"
                  transition={IOS_SPRING_SNAPPY}
                  className="pointer-events-none absolute inset-0 rounded-full bg-white/75 dark:bg-white/20 border border-white/60 dark:border-white/30 shadow-sm"
                  aria-hidden="true"
                />
              )}
              <Users size={14} className="relative z-10 pointer-events-none" aria-hidden="true" />
              <span className="relative z-10 pointer-events-none">멤버 관리 ({teamMembers.length})</span>
            </button>
          </div>

          {tab === 'types' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-bold shadow-md min-h-[40px]"
            >
              <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
              새 요청 유형 추가
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[18px] border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-950 dark:text-rose-100"
        >
          {error}
        </div>
      )}

      {tab === 'types' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requestTypes.map((type) => (
              <div
                key={type.id}
                className="glass rounded-[28px] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TypeIcon icon={type.icon} color={type.color} size="md" />
                      <div className="min-w-0">
                        <h2 className="text-base font-extrabold truncate">
                          {type.name}
                        </h2>
                        {type.description && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                            {type.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(type)}
                        aria-label={`${type.name} 유형 수정`}
                        className="focus-glass glass-press inline-flex items-center gap-1 rounded-full bg-white/40 dark:bg-white/10 border border-white/45 dark:border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/65 min-h-[34px]"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(type.id)}
                        aria-label={`${type.name} 유형 삭제`}
                        className="focus-glass glass-press inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-400/35 hover:bg-rose-500/25"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/30 dark:border-white/15 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      기본 담당자
                    </span>
                    <span className="font-bold text-right truncate">
                      {type.defaultAssigneeIds.length > 0
                        ? type.defaultAssigneeIds
                            .map((id) => memberMap.get(id)?.name ?? id)
                            .join(', ')
                        : '요청자 직접 선택'}
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      양식 항목 ({type.fields.length}개):{' '}
                    </span>
                    <span className="font-medium">
                      {type.fields.length > 0
                        ? type.fields.map((f) => f.label).join(', ')
                        : '공통 항목만 사용'}
                    </span>
                  </div>
                </div>
              </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass rounded-[24px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                팀 초대 코드
              </div>
              <div className="mt-1 font-mono text-xl font-extrabold tracking-widest tabular-nums">
                {team?.inviteCode ?? '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const res = onRegenerateInviteCode();
                  if (!res.ok) setError(res.error);
                }}
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/35 dark:bg-white/10 border border-white/45 dark:border-white/18 px-4 py-2 text-xs font-bold min-h-[40px]"
              >
                <RefreshCw size={14} aria-hidden="true" />
                코드 재발급
              </button>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/55 dark:bg-white/15 border border-white/55 dark:border-white/25 px-4 py-2 text-xs font-bold min-h-[40px]"
              >
                {copied ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                {copied ? '복사됨' : '초대 코드 복사'}
              </button>
            </div>
          </div>

          <div className="glass rounded-[28px] divide-y divide-white/25 dark:divide-white/10 overflow-hidden">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar user={member} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{member.name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {member.email} · {member.title ?? '팀원'}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                  {member.role === 'admin' && <Shield size={13} aria-hidden="true" />}
                  {member.role === 'admin' ? '관리자' : '일반'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RequestTypeEditorModal
        open={editorOpen}
        editingType={editingType}
        teamMembers={teamMembers}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmitType}
      />

      <ConfirmDeleteModal
        open={confirmDeleteId !== null}
        title="요청 유형 삭제 확인"
        message={(() => {
          const target = requestTypes.find((t) => t.id === confirmDeleteId);
          return `"${target?.name ?? '선택한'}" 요청 유형을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`;
        })()}
        confirmLabel="삭제"
        cancelLabel="취소"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) {
            handleDeleteType(confirmDeleteId);
          }
        }}
      />
    </div>
  );
}
