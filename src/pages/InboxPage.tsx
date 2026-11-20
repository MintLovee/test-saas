import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Filter, Inbox, Plus, RotateCcw, Search } from 'lucide-react';
import type {
  InboxTab,
  RequestStatus,
  RequestType,
  RequestWithDetails,
  User,
} from '../types/models';
import { ALL_STATUSES } from '../utils/requestRules';
import { IOS_SPRING_SNAPPY } from '../utils/motionPresets';
import { RequestCard } from '../components/RequestCard';

export function InboxPage({
  currentUser,
  activeTab,
  counts,
  requests,
  requestTypes,
  resetKey = 0,
  isLoading,
  error,
  onChangeTab,
  onSelectRequest,
  onOpenNewRequest,
}: {
  currentUser: User;
  activeTab: InboxTab;
  counts: Record<InboxTab, number>;
  requests: RequestWithDetails[];
  requestTypes: RequestType[];
  resetKey?: number;
  isLoading?: boolean;
  error?: string | null;
  onChangeTab: (tab: InboxTab) => void;
  onSelectRequest: (requestId: string) => void;
  onOpenNewRequest: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<RequestStatus | '전체'>('전체');
  const [typeFilter, setTypeFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setStatusFilter('전체');
    setTypeFilter('전체');
    setSearchQuery('');
  }, [resetKey, currentUser.id]);

  const tabs: Array<{ id: InboxTab; label: string; count: number }> = [
    { id: 'sent', label: '내가 보낸 것', count: counts.sent },
    { id: 'received', label: '나에게 온 것', count: counts.received },
    { id: 'cc', label: '참조된 것', count: counts.cc },
    ...(currentUser.role === 'admin'
      ? [{ id: 'all' as const, label: '팀 전체', count: counts.all }]
      : []),
  ];

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      if (statusFilter !== '전체' && req.status !== statusFilter) return false;
      if (typeFilter !== '전체' && req.typeId !== typeFilter) return false;
      if (q) {
        const hay = `${req.title} ${req.content} ${req.requester?.name ?? ''} ${req.type?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, searchQuery]);

  const hasActiveFilter =
    statusFilter !== '전체' || typeFilter !== '전체' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setStatusFilter('전체');
    setTypeFilter('전체');
    setSearchQuery('');
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header & Primary Segmented Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white glass-text-shadow">
              내 요청함
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              {currentUser.name}님의 요청과 전달받은 업무를 한눈에 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="focus-glass glass-press hidden sm:inline-flex lg:hidden items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-bold shadow-md"
          >
            <Plus size={15} aria-hidden="true" />
            새 요청
          </button>
        </div>

        {/* Floating Glass Segmented Control */}
        <div
          role="tablist"
          aria-label="요청함 분류 탭"
          className="glass flex flex-wrap sm:inline-flex sm:self-start items-center gap-1 rounded-[24px] sm:rounded-full p-1.5 w-full sm:w-auto"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeTab(tab.id)}
                className={`focus-glass glass-press relative flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap min-h-[40px] cursor-pointer touch-manipulation ${
                  active
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="inbox-tab-pill"
                    transition={IOS_SPRING_SNAPPY}
                    className="pointer-events-none absolute inset-0 rounded-full bg-white/65 dark:bg-white/20 border border-white/60 dark:border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_12px_rgba(31,38,135,0.12)]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 pointer-events-none">{tab.label}</span>
                <span className="relative z-10 pointer-events-none text-xs font-extrabold opacity-75 tabular-nums">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass rounded-[24px] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300"
              aria-hidden="true"
            />
            <label htmlFor="inbox-search" className="sr-only">
              요청 검색
            </label>
            <input
              id="inbox-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 내용, 요청자 이름으로 검색..."
              className="focus-glass w-full rounded-[16px] bg-white/35 dark:bg-white/8 border border-white/40 dark:border-white/15 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 min-h-[42px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="hidden sm:block text-slate-600 dark:text-slate-300 shrink-0" aria-hidden="true" />
            <label htmlFor="type-filter" className="sr-only">
              요청 유형 필터
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="focus-glass w-full sm:w-44 rounded-[16px] bg-white/35 dark:bg-white/8 border border-white/40 dark:border-white/15 px-3.5 py-2.5 text-sm font-semibold text-slate-950 dark:text-white min-h-[42px]"
            >
              <option value="전체" className="text-slate-900">
                모든 유형
              </option>
              {requestTypes.map((t) => (
                <option key={t.id} value={t.id} className="text-slate-900">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="상태 필터"
        >
          {(['전체', ...ALL_STATUSES] as const).map((status) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={active}
                className={`focus-glass glass-press rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                    : 'bg-white/30 dark:bg-white/8 text-slate-800 dark:text-slate-200 border border-white/35 dark:border-white/15 hover:bg-white/50 dark:hover:bg-white/15'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="glass rounded-[24px] border-rose-400/50 bg-rose-500/18 p-5 text-sm font-semibold text-rose-950 dark:text-rose-100"
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="요청 목록 불러오는 중">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="glass rounded-[28px] p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        /* Empty State: Glass Card + Guidance */
        <div className="glass rounded-[28px] p-10 text-center flex flex-col items-center justify-center gap-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/40 dark:bg-white/10 border border-white/50 dark:border-white/20 text-slate-700 dark:text-slate-200">
            <Inbox size={26} aria-hidden="true" />
          </div>
          <h2 className="text-base font-extrabold text-slate-950 dark:text-white">
            {hasActiveFilter ? '조건에 맞는 요청이 없습니다' : '표시할 요청이 아직 없습니다'}
          </h2>
          <p className="max-w-sm text-sm text-slate-700 dark:text-slate-300">
            {hasActiveFilter
              ? '검색어나 상태·유형 필터를 초기화하면 다른 요청을 확인할 수 있어요.'
              : activeTab === 'sent'
                ? '팀원에게 필요한 비품이나 업무 협조 요청을 첫 번째로 올려보세요.'
                : '새로운 요청이 도착하면 이곳에 바로 표시됩니다.'}
          </p>
          <div className="mt-2">
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/55 dark:bg-white/15 border border-white/60 dark:border-white/25 px-5 py-2.5 text-xs font-bold min-h-[42px]"
              >
                <RotateCcw size={14} aria-hidden="true" />
                필터 초기화
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenNewRequest}
                className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2.5 text-xs font-bold shadow-md min-h-[42px]"
              >
                <Plus size={15} aria-hidden="true" />
                새 요청 올리기
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Request Card Grid */
        <div
          data-testid="request-card-list"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {filteredRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onClick={() => onSelectRequest(req.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
