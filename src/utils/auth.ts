/**
 * 데모 환경에서도 평문 비밀번호를 저장하지 않기 위한 결정적 해시 유틸리티입니다.
 * (프로덕션 백엔드 전환 시 서버측 Argon2/bcrypt 등으로 대체됩니다.)
 */
export function hashPassword(password: string, salt = 'whatreq_salt_v1'): string {
  const input = `${salt}:${password}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined =
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0');
  return `h1$${combined}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

export function generateInviteCode(prefix = 'REQ'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${suffix}`;
}
