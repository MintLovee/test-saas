import { useCallback, useState } from 'react';

export interface ValidationIssue {
  fieldKey: string;
  elementId: string;
  message: string;
}

/**
 * Pure validation helper for Login & Registration forms so it can be unit-tested
 * and keeps field IDs synchronized with DOM focus targets.
 */
export function validateAuthFormInput(params: {
  mode: 'login' | 'register';
  name: string;
  email: string;
  password: string;
  teamMode: 'join' | 'create';
  inviteCode: string;
  newTeamName: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (params.mode === 'register' && !params.name.trim()) {
    issues.push({
      fieldKey: 'name',
      elementId: 'auth-name',
      message: '이름을 입력해 주세요.',
    });
  }

  const emailTrimmed = params.email.trim();
  if (!emailTrimmed || !emailTrimmed.includes('@')) {
    issues.push({
      fieldKey: 'email',
      elementId: 'auth-email',
      message: !emailTrimmed
        ? '이메일을 입력해 주세요.'
        : '올바른 이메일 주소를 입력해 주세요.',
    });
  }

  if (!params.password) {
    issues.push({
      fieldKey: 'password',
      elementId: 'auth-password',
      message: '비밀번호를 입력해 주세요.',
    });
  } else if (params.mode === 'register' && params.password.length < 4) {
    issues.push({
      fieldKey: 'password',
      elementId: 'auth-password',
      message: '비밀번호는 4자 이상이어야 합니다.',
    });
  }

  if (params.mode === 'register') {
    if (params.teamMode === 'join' && !params.inviteCode.trim()) {
      issues.push({
        fieldKey: 'inviteCode',
        elementId: 'invite-code',
        message: '팀 초대 코드를 입력해 주세요. (시드 팀 코드: TEAM2026)',
      });
    }
    if (params.teamMode === 'create' && !params.newTeamName.trim()) {
      issues.push({
        fieldKey: 'newTeamName',
        elementId: 'new-team-name',
        message: '새 팀 이름을 입력해 주세요.',
      });
    }
  }

  return issues;
}

export function shakeAndFocusElement(elementIds: string[], focusId?: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const targetFocusId = focusId ?? elementIds[0];

  if (targetFocusId) {
    const immediateFocusEl = document.getElementById(targetFocusId);
    if (immediateFocusEl instanceof HTMLElement) {
      immediateFocusEl.focus({ preventScroll: true });
    }
  }

  window.requestAnimationFrame(() => {
    for (const id of elementIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!prefersReducedMotion && typeof el.animate === 'function') {
        el.animate(
          [
            { transform: 'translate3d(0, 0, 0)' },
            { transform: 'translate3d(-8px, 0, 0)' },
            { transform: 'translate3d(8px, 0, 0)' },
            { transform: 'translate3d(-6px, 0, 0)' },
            { transform: 'translate3d(6px, 0, 0)' },
            { transform: 'translate3d(-3px, 0, 0)' },
            { transform: 'translate3d(3px, 0, 0)' },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration: 420,
            easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
          }
        );
      }
    }

    if (targetFocusId) {
      const focusEl = document.getElementById(targetFocusId);
      if (focusEl instanceof HTMLElement) {
        if (typeof focusEl.scrollIntoView === 'function') {
          focusEl.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }
        if (document.activeElement !== focusEl) {
          focusEl.focus({ preventScroll: true });
        }
      }
    }
  });
}

export function useFormValidationFeedback() {
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(() => new Set());

  const clearFieldInvalid = useCallback((key: string) => {
    setInvalidKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearAllInvalid = useCallback(() => {
    setInvalidKeys((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const triggerInvalid = useCallback(
    (entries: Array<{ key: string; elementId: string }>, focusElementId?: string) => {
      setInvalidKeys(new Set(entries.map((e) => e.key)));
      shakeAndFocusElement(
        entries.map((e) => e.elementId),
        focusElementId ?? entries[0]?.elementId
      );
    },
    []
  );

  const isInvalid = useCallback(
    (key: string) => invalidKeys.has(key),
    [invalidKeys]
  );

  return {
    invalidKeys,
    isInvalid,
    clearFieldInvalid,
    clearAllInvalid,
    triggerInvalid,
  };
}
