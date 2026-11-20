import type { ChatMessage, ChatRoom, User } from '../types/models';

export function findExistingDirectRoom(
  rooms: ChatRoom[],
  teamId: string,
  userA: string,
  userB: string
): ChatRoom | null {
  if (userA === userB) return null;
  return (
    rooms.find(
      (r) =>
        r.teamId === teamId &&
        r.kind === 'direct' &&
        r.memberIds.length === 2 &&
        r.memberIds.includes(userA) &&
        r.memberIds.includes(userB)
    ) ?? null
  );
}

export function canAccessChatRoom(userId: string, room: ChatRoom): boolean {
  return room.memberIds.includes(userId);
}

export function canLeaveChatRoom(userId: string, room: ChatRoom): boolean {
  return room.memberIds.includes(userId);
}

export function canDeleteChatRoom(user: Pick<User, 'id' | 'role'>, room: ChatRoom): boolean {
  if (!room.memberIds.includes(user.id)) return false;
  if (user.role === 'admin') return true;
  if (room.createdBy === user.id) return true;
  if (room.kind === 'direct') return true;
  return false;
}

export function getChatRoomDisplayName(
  room: ChatRoom,
  currentUserId: string,
  userMap: Map<string, User>
): string {
  if (room.title && room.title.trim()) {
    return room.title.trim();
  }
  const others = room.memberIds
    .filter((id) => id !== currentUserId)
    .map((id) => userMap.get(id)?.name ?? '알 수 없음');

  if (others.length === 0) {
    const selfName = userMap.get(currentUserId)?.name ?? '나';
    return `${selfName} (나와의 대화)`;
  }
  if (room.kind === 'direct' || others.length === 1) {
    return others[0];
  }
  if (others.length <= 3) {
    return others.join(', ');
  }
  return `${others.slice(0, 2).join(', ')} 외 ${others.length - 2}명`;
}

export function getInvitableMembers(room: ChatRoom, teamMembers: User[]): User[] {
  const currentSet = new Set(room.memberIds);
  return teamMembers.filter((m) => !currentSet.has(m.id));
}

export function countUnreadMessagesForRoom(
  room: ChatRoom,
  messages: ChatMessage[],
  userId: string
): number {
  if (!room.memberIds.includes(userId)) return 0;
  const lastReadAt = room.lastReadAtByUser?.[userId] ?? '';
  return messages.filter(
    (m) =>
      m.roomId === room.id &&
      m.senderId !== userId &&
      (!lastReadAt || m.createdAt > lastReadAt)
  ).length;
}

export function validateNewChatMembers(selectedUserIds: string[]): {
  valid: boolean;
  error?: string;
} {
  const unique = Array.from(new Set(selectedUserIds.filter(Boolean)));
  if (unique.length === 0) {
    return {
      valid: false,
      error: '대화할 팀원을 최소 1명 이상 선택해 주세요.',
    };
  }
  return { valid: true };
}
