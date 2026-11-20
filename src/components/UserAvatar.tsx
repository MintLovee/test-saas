import type { RecipientRole, User } from '../types/models';

const AVATAR_GRADIENTS = [
  'from-sky-500 to-indigo-500',
  'from-violet-500 to-fuchsia-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
];

function getGradientForUser(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}

export function UserAvatar({
  user,
  size = 'md',
  className = '',
}: {
  user?: User;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const name = user?.name ?? '?';
  const initial = name.slice(0, 1);
  const gradient = getGradientForUser(user?.id ?? name);

  const dims =
    size === 'xs'
      ? 'h-6 w-6 text-[11px]'
      : size === 'sm'
        ? 'h-7 w-7 text-xs'
        : size === 'lg'
          ? 'h-11 w-11 text-base'
          : 'h-9 w-9 text-sm';

  return (
    <span
      title={user ? `${user.name}${user.title ? ` (${user.title})` : ''}` : undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_8px_rgba(15,23,42,0.18)] ring-2 ring-white/70 dark:ring-slate-900/70 ${dims} ${className}`}
    >
      {initial}
    </span>
  );
}

export function AvatarStack({
  recipients,
  maxVisible = 3,
}: {
  recipients: Array<{ id: string; role: RecipientRole; user?: User }>;
  maxVisible?: number;
}) {
  const sorted = [...recipients].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'assignee' ? -1 : 1
  );
  const visible = sorted.slice(0, maxVisible);
  const extra = sorted.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((rec) => (
          <div
            key={rec.id}
            className="relative"
            title={`${rec.user?.name ?? '알 수 없음'} · ${rec.role === 'assignee' ? '담당' : '참조'}`}
          >
            <UserAvatar user={rec.user} size="sm" />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
          +{extra}
        </span>
      )}
    </div>
  );
}
