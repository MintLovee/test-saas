import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  ChevronDown,
  Inbox,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import type { Team, User } from '../types/models';
import { IOS_EASE, IOS_SPRING_POPOVER, IOS_SPRING_SNAPPY } from '../utils/motionPresets';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { UserAvatar } from './UserAvatar';

export type NavSection = 'inbox' | 'chat' | 'admin';

export function AppShell({
  currentUser,
  team,
  teamMembers,
  activeSection,
  unreadNotificationCount,
  unreadChatCount,
  onSelectSection,
  onOpenNewRequest,
  onOpenNotifications,
  onSwitchUser,
  onLogout,
  children,
}: {
  currentUser: User;
  team: Team | null;
  teamMembers: User[];
  activeSection: NavSection;
  unreadNotificationCount: number;
  unreadChatCount: number;
  onSelectSection: (section: NavSection) => void;
  onOpenNewRequest: () => void;
  onOpenNotifications: () => void;
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({
    top: 84,
    right: 20,
  });

  useEffect(() => {
    if (!profileMenuOpen) return;
    const updatePosition = () => {
      const rect = profileButtonRef.current?.getBoundingClientRect();
      const headerRect = headerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchorBottom = headerRect ? headerRect.bottom : rect.bottom;
      setMenuPos({
        top: Math.max(Math.round(anchorBottom + 10), 72),
        right: Math.max(Math.round(window.innerWidth - rect.right), 12),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [profileMenuOpen]);

  const navItems: Array<{
    id: NavSection;
    label: string;
    mobileLabel: string;
    Icon: typeof Inbox;
    badge?: number;
    adminOnly?: boolean;
  }> = [
    { id: 'inbox', label: '내 요청함', mobileLabel: '요청함', Icon: Inbox },
    { id: 'chat', label: '팀 채팅', mobileLabel: '채팅', Icon: MessageCircle, badge: unreadChatCount },
    ...(currentUser.role === 'admin'
      ? [{ id: 'admin' as const, label: '관리자 설정', mobileLabel: '관리자', Icon: Settings, adminOnly: true }]
      : []),
  ];

  const profileMenuPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {profileMenuOpen && (
              <>
                <motion.div
                  key="profile-menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: IOS_EASE }}
                  className="fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[2px]"
                  onClick={() => setProfileMenuOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  key="profile-menu-popover"
                  role="menu"
                  aria-label="프로필 및 사용자 전환 메뉴"
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={IOS_SPRING_POPOVER}
                  style={{
                    top: `${menuPos.top}px`,
                    right: `${menuPos.right}px`,
                    transformOrigin: 'top right',
                  }}
                  className="glass-elevated fixed z-50 w-64 max-h-[calc(100vh-96px)] overflow-y-auto rounded-[24px] p-2.5 text-slate-900 dark:text-slate-100"
                >
                  <div className="px-3 py-2 border-b border-white/30 dark:border-white/15">
                    <p className="text-sm font-bold">{currentUser.name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {currentUser.email} · {currentUser.role === 'admin' ? '관리자' : '팀원'}
                    </p>
                  </div>

                  <div className="mt-2 px-2 py-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <Users size={12} aria-hidden="true" />
                    다른 사용자로 전환 (데모)
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5 py-1">
                    {teamMembers.map((member) => {
                      const isSelf = member.id === currentUser.id;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          role="menuitem"
                          disabled={isSelf}
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onSwitchUser(member.id);
                          }}
                          className={`focus-glass flex w-full items-center justify-between gap-2 rounded-[14px] px-2.5 py-2 text-left text-xs transition-colors ${
                            isSelf
                              ? 'bg-white/45 dark:bg-white/15 font-bold cursor-default'
                              : 'hover:bg-white/35 dark:hover:bg-white/10 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <UserAvatar user={member} size="xs" />
                            <span className="truncate">{member.name}</span>
                          </span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
                            {isSelf ? '현재' : member.role === 'admin' ? '관리자' : '팀원'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-1 pt-1 border-t border-white/30 dark:border-white/15">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setConfirmLogoutOpen(true);
                      }}
                      className="focus-glass flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15"
                    >
                      <LogOut size={14} aria-hidden="true" />
                      로그아웃
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] gap-6 px-3 pt-3 pb-24 sm:px-5 lg:px-7 lg:py-6">
      {/* Desktop Floating Glass Capsule Sidebar */}
      <aside
        aria-label="주 메뉴"
        className="hidden lg:flex lg:w-[264px] lg:shrink-0 lg:flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]"
      >
        <div className="glass flex h-full flex-col justify-between rounded-[28px] p-4">
          <div>
            {/* Brand Wordmark */}
            <div className="px-2 pt-1 pb-4">
              <div className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white glass-text-shadow">
                뭐든 요청함
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                {team?.name ?? '팀 워크스페이스'}
              </p>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="focus-glass glass-press w-full inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-3 text-sm font-semibold shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:opacity-95 whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              새 요청 올리기
            </button>

            {/* Navigation with sliding glass pill */}
            <nav className="mt-6 space-y-1.5" aria-label="사이드바 탐색">
              {navItems.map((item) => {
                const active = activeSection === item.id;
                const { Icon } = item;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSelectSection(item.id);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`focus-glass glass-press relative flex w-full items-center gap-3 rounded-[20px] px-3.5 py-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer touch-manipulation ${
                      active
                        ? 'text-slate-950 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="desktop-nav-pill"
                        transition={IOS_SPRING_SNAPPY}
                        className="pointer-events-none absolute inset-0 rounded-[20px] bg-white/55 dark:bg-white/16 border border-white/60 dark:border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(31,38,135,0.1)]"
                        aria-hidden="true"
                      />
                    )}
                    <Icon size={18} strokeWidth={2.1} className="relative z-10 shrink-0 pointer-events-none" aria-hidden="true" />
                    <span className="relative z-10 pointer-events-none flex-1 text-left">{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="relative z-10 pointer-events-none inline-flex min-w-[20px] h-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white tabular-nums">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Team Info Card inside sidebar */}
          <div className="rounded-[20px] bg-white/25 dark:bg-white/6 border border-white/30 dark:border-white/15 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold">팀 초대 코드</span>
              <span className="font-mono font-bold tracking-wider text-slate-900 dark:text-white tabular-nums">
                {team?.inviteCode ?? '—'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>참여 멤버</span>
              <span className="font-semibold tabular-nums">{teamMembers.length}명</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Top Bar */}
        <header
          ref={headerRef}
          className="glass sticky top-3 z-30 flex h-12 lg:h-14 items-center justify-between gap-4 rounded-full px-4 sm:px-5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="lg:hidden text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              뭐든 요청함
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
              {activeSection === 'inbox'
                ? '내 요청함'
                : activeSection === 'chat'
                  ? '팀 채팅'
                  : '관리자 설정'}
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
              {team?.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label={`알림${unreadNotificationCount > 0 ? ` (${unreadNotificationCount}개 읽지 않음)` : ''}`}
              className="focus-glass glass-press relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 dark:bg-white/10 border border-white/40 dark:border-white/20 text-slate-800 dark:text-slate-100 hover:bg-white/50 dark:hover:bg-white/20"
            >
              <Bell size={18} strokeWidth={2} aria-hidden="true" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm tabular-nums">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profile & Demo User Switcher Button */}
            <button
              ref={profileButtonRef}
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="프로필 및 사용자 전환 메뉴"
              className="focus-glass glass-press inline-flex items-center gap-2 rounded-full bg-white/30 dark:bg-white/10 border border-white/40 dark:border-white/20 pl-1.5 pr-3 py-1 text-left hover:bg-white/50 dark:hover:bg-white/20 min-h-[40px]"
            >
              <UserAvatar user={currentUser} size="sm" />
              <span className="hidden sm:inline text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                {currentUser.name}
              </span>
              <ChevronDown
                size={14}
                className={`text-slate-600 dark:text-slate-300 transition-transform duration-300 ${
                  profileMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {profileMenuPortal}

      {/* Mobile Floating Glass Capsule Bottom Tab Bar */}
      <nav
        aria-label="모바일 하단 탭바"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-30 mx-auto max-w-lg"
      >
        <div className="glass-elevated flex h-14 items-center justify-between gap-1 rounded-full p-1.5">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            const { Icon } = item;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onSelectSection(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={`focus-glass glass-press relative flex flex-1 h-full items-center justify-center gap-1 rounded-full px-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer touch-manipulation ${
                  active
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={IOS_SPRING_SNAPPY}
                    className="pointer-events-none absolute inset-0 rounded-full bg-white/65 dark:bg-white/20 border border-white/60 dark:border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    aria-hidden="true"
                  />
                )}
                <Icon size={15} className="relative z-10 pointer-events-none shrink-0" aria-hidden="true" />
                <span className="relative z-10 pointer-events-none">{item.mobileLabel}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="relative z-10 pointer-events-none inline-flex min-w-[16px] h-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white tabular-nums">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen(false);
              onOpenNewRequest();
            }}
            className="focus-glass glass-press inline-flex h-full items-center justify-center gap-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-3.5 text-xs font-bold shadow-md whitespace-nowrap shrink-0 cursor-pointer touch-manipulation"
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
            새 요청
          </button>
        </div>
      </nav>

      <ConfirmDeleteModal
        open={confirmLogoutOpen}
        variant="neutral"
        title="로그아웃 확인"
        message="현재 계정에서 로그아웃하시겠습니까?"
        confirmLabel="로그아웃"
        cancelLabel="취소"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}
