import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { User } from '../types/models';
import type { RegisterPayload } from '../repository';
import { useFormValidationFeedback, validateAuthFormInput } from '../utils/formFeedback';
import { IOS_SPRING_CONTENT, IOS_SPRING_SNAPPY } from '../utils/motionPresets';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import { UserAvatar } from '../components/UserAvatar';

export function LoginPage({
  demoAccounts,
  onLogin,
  onRegister,
  onDemoLogin,
}: {
  demoAccounts: User[];
  onLogin: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  onRegister: (payload: RegisterPayload) => { ok: true } | { ok: false; error: string };
  onDemoLogin: (userId: string) => void;
}) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [teamMode, setTeamMode] = useState<'join' | 'create'>('join');
  const [inviteCode, setInviteCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { isInvalid, clearFieldInvalid, clearAllInvalid, triggerInvalid } =
    useFormValidationFeedback();

  const passwordStrength = evaluatePasswordStrength(password);

  // 시드 데모 계정 전체 노출 (관리자 및 팀원)
  const quickDemoUsers = demoAccounts;

  const switchAuthTab = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setError(null);
    clearAllInvalid();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const issues = validateAuthFormInput({
      mode: authTab,
      name,
      email,
      password,
      teamMode,
      inviteCode,
      newTeamName,
    });

    if (issues.length > 0) {
      setError(issues[0].message);
      triggerInvalid(
        issues.map((i) => ({ key: i.fieldKey, elementId: i.elementId })),
        issues[0].elementId
      );
      return;
    }

    clearAllInvalid();

    if (authTab === 'login') {
      const res = onLogin(email, password);
      if (!res.ok) {
        setError(res.error);
        if (res.error.includes('비밀번호')) {
          triggerInvalid([{ key: 'password', elementId: 'auth-password' }], 'auth-password');
        } else {
          triggerInvalid([{ key: 'email', elementId: 'auth-email' }], 'auth-email');
        }
      }
    } else {
      const res = onRegister({
        name,
        email,
        password,
        mode: teamMode,
        inviteCode,
        newTeamName,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.error.includes('초대 코드')) {
          triggerInvalid([{ key: 'inviteCode', elementId: 'invite-code' }], 'invite-code');
        } else if (res.error.includes('팀 이름')) {
          triggerInvalid([{ key: 'newTeamName', elementId: 'new-team-name' }], 'new-team-name');
        } else if (res.error.includes('비밀번호')) {
          triggerInvalid([{ key: 'password', elementId: 'auth-password' }], 'auth-password');
        } else if (res.error.includes('이름')) {
          triggerInvalid([{ key: 'name', elementId: 'auth-name' }], 'auth-name');
        } else {
          triggerInvalid([{ key: 'email', elementId: 'auth-email' }], 'auth-email');
        }
      }
    }
  };

  const strengthBarColor =
    passwordStrength.level === 'very-weak'
      ? 'bg-rose-600 dark:bg-rose-500'
      : passwordStrength.level === 'weak'
        ? 'bg-orange-500 dark:bg-orange-400'
        : passwordStrength.level === 'medium'
          ? 'bg-amber-500 dark:bg-amber-400'
          : passwordStrength.level === 'strong'
            ? 'bg-emerald-600 dark:bg-emerald-400'
            : 'bg-slate-400/40';

  const strengthTextColor =
    passwordStrength.level === 'very-weak'
      ? 'text-rose-700 dark:text-rose-300'
      : passwordStrength.level === 'weak'
        ? 'text-orange-700 dark:text-orange-300'
        : passwordStrength.level === 'medium'
          ? 'text-amber-800 dark:text-amber-300'
          : passwordStrength.level === 'strong'
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-slate-600 dark:text-slate-400';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Brand & Demo Showcase */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING_CONTENT}
          className="lg:col-span-5 glass rounded-[28px] p-6 sm:p-8 flex flex-col justify-between gap-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/40 dark:bg-white/12 border border-white/50 dark:border-white/20 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Sparkles size={14} aria-hidden="true" />
              팀 요청 접수 워크스페이스
            </div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white glass-text-shadow leading-tight">
              뭐든 요청함
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200">
              비품 신청부터 IT 문의, 업무 협조까지. 요청 유형을 고르고 담당자를 직접 지정해 진행 상황을 한곳에서 투명하게 확인하세요.
            </p>
          </div>

          {/* Demo Account Quick Login */}
          <div className="rounded-[22px] bg-white/30 dark:bg-white/8 border border-white/40 dark:border-white/15 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                데모 계정으로 바로 체험
              </span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                마케팅 1팀 ({quickDemoUsers.length}명)
              </span>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-0.5">
              {quickDemoUsers.map((user) => (
                <motion.button
                  key={user.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={IOS_SPRING_SNAPPY}
                  onClick={() => onDemoLogin(user.id)}
                  className="focus-glass w-full flex items-center justify-between gap-3 rounded-[16px] bg-white/50 dark:bg-white/12 border border-white/55 dark:border-white/20 px-3.5 py-2.5 text-left hover:bg-white/75 dark:hover:bg-white/20 transition-colors min-h-[48px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar user={user} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-950 dark:text-white truncate">
                        {user.name}
                        <span className="ml-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          ({user.role === 'admin' ? '관리자' : '팀원'})
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {user.title ?? user.email}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-slate-700 dark:text-slate-200" aria-hidden="true" />
                </motion.button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Right Auth Form */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING_CONTENT}
          className="lg:col-span-7 glass-elevated rounded-[28px] p-6 sm:p-8 flex flex-col justify-center"
        >
          {/* Mode Tabs with sliding iOS Liquid Glass pill */}
          <div
            role="tablist"
            aria-label="인증 방식 선택"
            className="glass grid grid-cols-2 gap-1 rounded-full p-1"
          >
            {(
              [
                { id: 'login', label: '로그인' },
                { id: 'register', label: '회원가입' },
              ] as const
            ).map((t) => {
              const active = authTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchAuthTab(t.id)}
                  className={`focus-glass glass-press relative rounded-full py-2.5 text-sm font-bold transition-colors min-h-[44px] cursor-pointer ${
                    active
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-mode-pill"
                      transition={IOS_SPRING_SNAPPY}
                      className="pointer-events-none absolute inset-0 rounded-full bg-slate-900 dark:bg-white shadow-sm"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 pointer-events-none">{t.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div
                  key="auth-error-alert"
                  role="alert"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={IOS_SPRING_SNAPPY}
                  className="rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-950 dark:text-rose-100"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {authTab === 'register' && (
                <motion.div
                  key="register-name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={IOS_SPRING_CONTENT}
                  className="overflow-hidden"
                >
                  <div className="pb-0.5">
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                    >
                      이름 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      aria-invalid={isInvalid('name')}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldInvalid('name');
                      }}
                      placeholder="홍길동"
                      className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 ${
                        isInvalid('name') ? 'input-invalid' : ''
                      }`}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                이메일 <span className="text-rose-600">*</span>
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                aria-invalid={isInvalid('email')}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldInvalid('email');
                }}
                placeholder="name@marketing.kr"
                className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 ${
                  isInvalid('email') ? 'input-invalid' : ''
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                비밀번호 <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  aria-invalid={isInvalid('password')}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldInvalid('password');
                  }}
                  placeholder={authTab === 'login' ? '비밀번호 (데모: demo1234)' : '4자 이상 입력'}
                  className={`focus-glass glass w-full rounded-[16px] pl-4 pr-12 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 ${
                    isInvalid('password') ? 'input-invalid' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  className="focus-glass absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/15 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>

              {/* Password Strength Meter (Register mode only) */}
              <AnimatePresence initial={false}>
                {authTab === 'register' && (
                  <motion.div
                    key="password-strength-meter"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={IOS_SPRING_SNAPPY}
                    data-testid="password-strength-indicator"
                    className="mt-2.5 rounded-[16px] bg-white/30 dark:bg-white/8 border border-white/40 dark:border-white/15 px-3.5 py-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        {passwordStrength.level === 'strong' ? (
                          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <ShieldAlert size={14} className={strengthTextColor} aria-hidden="true" />
                        )}
                        비밀번호 보안 수준
                      </span>
                      <span
                        data-testid="password-strength-label"
                        className={`font-extrabold ${strengthTextColor}`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>

                    <div
                      className="grid grid-cols-4 gap-1.5"
                      aria-label={`비밀번호 강도 ${passwordStrength.score}단계 중 4단계`}
                    >
                      {[1, 2, 3, 4].map((stepIdx) => {
                        const filled = passwordStrength.score >= stepIdx;
                        return (
                          <div
                            key={stepIdx}
                            data-filled={filled ? 'true' : 'false'}
                            className={`h-2 rounded-full ${
                              filled
                                ? strengthBarColor
                                : 'bg-slate-900/15 dark:bg-white/20'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      {passwordStrength.hint}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {authTab === 'register' && (
                <motion.div
                  key="register-team-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={IOS_SPRING_CONTENT}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-3 border-t border-white/30 dark:border-white/15">
                    <div className="glass grid grid-cols-2 gap-1.5 rounded-[18px] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTeamMode('join');
                          clearFieldInvalid('newTeamName');
                        }}
                        className={`focus-glass relative flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-xs font-bold transition-colors min-h-[42px] cursor-pointer ${
                          teamMode === 'join'
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {teamMode === 'join' && (
                          <motion.span
                            layoutId="team-mode-pill"
                            transition={IOS_SPRING_SNAPPY}
                            className="pointer-events-none absolute inset-0 rounded-[14px] bg-white/70 dark:bg-white/20 border border-white/65 dark:border-white/30 shadow-sm"
                            aria-hidden="true"
                          />
                        )}
                        <KeyRound size={14} className="relative z-10 pointer-events-none" aria-hidden="true" />
                        <span className="relative z-10 pointer-events-none">팀 초대 코드로 합류</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTeamMode('create');
                          clearFieldInvalid('inviteCode');
                        }}
                        className={`focus-glass relative flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-xs font-bold transition-colors min-h-[42px] cursor-pointer ${
                          teamMode === 'create'
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {teamMode === 'create' && (
                          <motion.span
                            layoutId="team-mode-pill"
                            transition={IOS_SPRING_SNAPPY}
                            className="pointer-events-none absolute inset-0 rounded-[14px] bg-white/70 dark:bg-white/20 border border-white/65 dark:border-white/30 shadow-sm"
                            aria-hidden="true"
                          />
                        )}
                        <Users size={14} className="relative z-10 pointer-events-none" aria-hidden="true" />
                        <span className="relative z-10 pointer-events-none">새 팀 만들기</span>
                      </button>
                    </div>

                    {teamMode === 'join' ? (
                      <div>
                        <label
                          htmlFor="invite-code"
                          className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                        >
                          팀 초대 코드 (시드 팀 코드: TEAM2026) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="invite-code"
                          type="text"
                          value={inviteCode}
                          aria-invalid={isInvalid('inviteCode')}
                          onChange={(e) => {
                            setInviteCode(e.target.value);
                            clearFieldInvalid('inviteCode');
                          }}
                          placeholder="TEAM2026"
                          className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-mono uppercase tracking-wider text-slate-950 dark:text-white placeholder:text-slate-500 ${
                            isInvalid('inviteCode') ? 'input-invalid' : ''
                          }`}
                        />
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="new-team-name"
                          className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
                        >
                          새 팀 이름 (만든 사람은 관리자, 초대 코드 자동 생성){' '}
                          <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="new-team-name"
                          type="text"
                          value={newTeamName}
                          aria-invalid={isInvalid('newTeamName')}
                          onChange={(e) => {
                            setNewTeamName(e.target.value);
                            clearFieldInvalid('newTeamName');
                          }}
                          placeholder="예: 프로덕트 디자인팀"
                          className={`focus-glass glass w-full rounded-[16px] px-4 py-3 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 ${
                            isInvalid('newTeamName') ? 'input-invalid' : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              transition={IOS_SPRING_SNAPPY}
              className="focus-glass w-full rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 py-3.5 text-sm font-bold shadow-lg hover:opacity-95 min-h-[48px] cursor-pointer"
            >
              {authTab === 'login' ? '이메일로 로그인' : '가입하고 시작하기'}
            </motion.button>
          </form>
        </motion.section>
      </div>
    </div>
  );
}
