export type PasswordStrengthLevel = 'empty' | 'very-weak' | 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      level: 'empty',
      score: 0,
      label: '비밀번호 입력 전',
      hint: '4자 이상 입력해 주세요 (8자 이상 영문·숫자·특수문자 조합 권장)',
    };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const charClasses = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  const allSameChar = /^([a-zA-Z0-9\W_])\1+$/.test(password);

  if (password.length < 4 || allSameChar) {
    return {
      level: 'very-weak',
      score: 1,
      label: '매우 취약',
      hint:
        password.length < 4
          ? '최소 4자 이상 입력해야 가입할 수 있습니다.'
          : '같은 문자만 반복하면 보안에 매우 취약합니다.',
    };
  }

  if (
    (password.length >= 8 && charClasses >= 3) ||
    (password.length >= 12 && charClasses >= 2)
  ) {
    return {
      level: 'strong',
      score: 4,
      label: '강함',
      hint: '추측하기 어려운 안전한 비밀번호입니다.',
    };
  }

  if (
    (password.length >= 6 && charClasses >= 2) ||
    (password.length >= 8 && charClasses >= 1)
  ) {
    return {
      level: 'medium',
      score: 3,
      label: '보통',
      hint: '영문 대소문자·숫자·특수문자 중 한 가지를 더 섞으면 강해집니다.',
    };
  }

  return {
    level: 'weak',
    score: 2,
    label: '취약',
    hint: '8자 이상으로 늘리고 숫자나 특수문자를 함께 사용해 주세요.',
  };
}
