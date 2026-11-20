import { generateInviteCode, hashPassword, verifyPassword } from '../utils/auth';
import {
  canAccessChatRoom,
  canDeleteChatRoom,
  canLeaveChatRoom,
  countUnreadMessagesForRoom,
  findExistingDirectRoom,
  getChatRoomDisplayName,
} from '../utils/chatRules';
import {
  canDeleteOrCancelRequest,
  canEditRequestContent,
  canViewRequest,
  filterRequestsForTab,
  isUserAssignee,
  validateRecipients,
  validateStatusChange,
} from '../utils/requestRules';
import { validateRequestTypeInput, type RequestTypeInput } from '../utils/requestTypeRules';
import type {
  ChatMessage,
  ChatRoom,
  ChatRoomWithDetails,
  Comment,
  CreateRequestInput,
  InboxTab,
  Notification,
  Recipient,
  Request,
  RequestStatus,
  RequestType,
  RequestWithDetails,
  StatusLog,
  Team,
  UpdateRequestInput,
  User,
} from '../types/models';
import { createSeedDatabase, SEED_VERSION, type AppDatabase } from './seedData';

const DB_STORAGE_KEY = 'whatreq_db_v1';
const SESSION_USER_KEY = 'whatreq_session_user_v1';
const SYNC_CHANNEL_NAME = 'whatreq_sync_v1';

let syncChannel: BroadcastChannel | null = null;
function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!syncChannel) {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
  return syncChannel;
}

export function subscribeRepositorySync(onSync: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const channel = getSyncChannel();
  const handleChannelMessage = () => onSync();
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === DB_STORAGE_KEY || e.key === SESSION_USER_KEY) {
      onSync();
    }
  };
  channel?.addEventListener('message', handleChannelMessage);
  window.addEventListener('storage', handleStorageEvent);
  return () => {
    channel?.removeEventListener('message', handleChannelMessage);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function mergeMissingById<T extends { id: string }>(existing: T[], seeded: T[]): T[] {
  const existingIds = new Set(existing.map((item) => item.id));
  const additions = seeded.filter((item) => !existingIds.has(item.id));
  return additions.length > 0 ? [...existing, ...additions] : existing;
}

function loadDb(): AppDatabase {
  if (typeof window === 'undefined') {
    return createSeedDatabase();
  }
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedDatabase();
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<AppDatabase>;
    let migrated = false;
    const seeded = createSeedDatabase();

    if (!Array.isArray(parsed.chatRooms)) {
      parsed.chatRooms = seeded.chatRooms;
      migrated = true;
    }
    if (!Array.isArray(parsed.chatMessages)) {
      parsed.chatMessages = seeded.chatMessages;
      migrated = true;
    }

    if ((parsed.seedVersion ?? 1) < SEED_VERSION) {
      parsed.requests = mergeMissingById(parsed.requests ?? [], seeded.requests);
      parsed.recipients = mergeMissingById(parsed.recipients ?? [], seeded.recipients);
      parsed.comments = mergeMissingById(parsed.comments ?? [], seeded.comments);
      parsed.statusLogs = mergeMissingById(parsed.statusLogs ?? [], seeded.statusLogs);
      parsed.notifications = mergeMissingById(parsed.notifications ?? [], seeded.notifications);
      parsed.chatRooms = mergeMissingById(parsed.chatRooms ?? [], seeded.chatRooms);
      parsed.chatMessages = mergeMissingById(parsed.chatMessages ?? [], seeded.chatMessages);
      parsed.seedVersion = SEED_VERSION;
      migrated = true;
    }

    const db = parsed as AppDatabase;
    if (migrated) {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    }
    return db;
  } catch {
    const seeded = createSeedDatabase();
    try {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // Ignore storage quota errors
    }
    return seeded;
  }
}

function saveDb(db: AppDatabase): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    getSyncChannel()?.postMessage({ type: 'db_updated', at: Date.now() });
  } catch (err) {
    console.error('Failed to persist repository state', err);
  }
}

function hydrateChatRoom(db: AppDatabase, room: ChatRoom, userId: string): ChatRoomWithDetails {
  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const members = room.memberIds
    .map((id) => userMap.get(id))
    .filter((u): u is User => Boolean(u));
  const messages = db.chatMessages
    .filter((m) => m.roomId === room.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ ...m, sender: userMap.get(m.senderId) }));
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const unreadCount = countUnreadMessagesForRoom(room, db.chatMessages, userId);

  return {
    ...room,
    members,
    messages,
    lastMessage,
    unreadCount,
  };
}

function hydrateRequest(db: AppDatabase, request: Request): RequestWithDetails {
  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const type = db.requestTypes.find((t) => t.id === request.typeId);
  const requester = userMap.get(request.requesterId);

  const recipients = db.recipients
    .filter((r) => r.requestId === request.id)
    .map((r) => ({ ...r, user: userMap.get(r.userId) }));

  const comments = db.comments
    .filter((c) => c.requestId === request.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({ ...c, author: userMap.get(c.authorId) }));

  const statusLogs = db.statusLogs
    .filter((l) => l.requestId === request.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((l) => ({ ...l, actor: userMap.get(l.actorId) }));

  return {
    ...request,
    type,
    requester,
    recipients,
    comments,
    statusLogs,
  };
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  mode: 'join' | 'create';
  inviteCode?: string;
  newTeamName?: string;
}

export const repository = {
  // === Auth & Session ===
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const db = loadDb();
    const userId = window.localStorage.getItem(SESSION_USER_KEY);
    if (!userId) return null;
    return db.users.find((u) => u.id === userId) ?? null;
  },

  getDemoAccounts(): User[] {
    const db = loadDb();
    return db.users;
  },

  login(email: string, password: string): { ok: true; user: User } | { ok: false; error: string } {
    const db = loadDb();
    const normalized = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) {
      return { ok: false, error: '등록되지 않은 이메일입니다.' };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { ok: false, error: '비밀번호가 일치하지 않습니다.' };
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_USER_KEY, user.id);
    }
    return { ok: true, user };
  },

  loginAsUser(userId: string): { ok: true; user: User } | { ok: false; error: string } {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return { ok: false, error: '사용자를 찾을 수 없습니다.' };
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_USER_KEY, user.id);
    }
    return { ok: true, user };
  },

  register(payload: RegisterPayload): { ok: true; user: User } | { ok: false; error: string } {
    const db = loadDb();
    const name = payload.name.trim();
    const email = payload.email.trim().toLowerCase();

    if (!name) return { ok: false, error: '이름을 입력해 주세요.' };
    if (!email || !email.includes('@')) return { ok: false, error: '올바른 이메일 주소를 입력해 주세요.' };
    if (payload.password.length < 4) {
      return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' };
    }
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: '이미 가입된 이메일 주소입니다.' };
    }

    let teamId = '';
    let role: 'admin' | 'member' = 'member';

    if (payload.mode === 'join') {
      const code = (payload.inviteCode ?? '').trim().toUpperCase();
      const team = db.teams.find((t) => t.inviteCode.toUpperCase() === code);
      if (!team) {
        return { ok: false, error: '팀 초대 코드가 올바르지 않습니다. (예: TEAM2026)' };
      }
      teamId = team.id;
      role = 'member';
    } else {
      const teamName = (payload.newTeamName ?? '').trim();
      if (!teamName) {
        return { ok: false, error: '새 팀 이름을 입력해 주세요.' };
      }
      const newTeam: Team = {
        id: createId('team'),
        name: teamName,
        inviteCode: generateInviteCode('TEAM'),
      };
      db.teams.push(newTeam);
      teamId = newTeam.id;
      role = 'admin';

      // 새 팀을 만든 경우 기본 요청 유형 템플릿도 함께 생성
      const defaultTypes: RequestType[] = [
        {
          id: createId('type'),
          teamId,
          name: '업무 협조',
          description: '팀 내 일반 업무 협업 및 지원 요청',
          icon: 'Handshake',
          color: 'blue',
          defaultAssigneeIds: [],
          fields: [
            { id: 'coop_detail', label: '협조 내용', type: 'textarea', required: true },
          ],
        },
        {
          id: createId('type'),
          teamId,
          name: '비품·간식',
          description: '사무용품 및 간식 구매 신청',
          icon: 'Package',
          color: 'orange',
          defaultAssigneeIds: [],
          fields: [
            { id: 'item_name', label: '품목', type: 'text', required: true },
            { id: 'quantity', label: '수량', type: 'number', required: true },
          ],
        },
        {
          id: createId('type'),
          teamId,
          name: '건의사항',
          description: '팀 운영 및 문화 개선 제안',
          icon: 'MessageSquareHeart',
          color: 'teal',
          defaultAssigneeIds: [],
          fields: [
            { id: 'suggestion_body', label: '제안 내용', type: 'textarea', required: true },
          ],
        },
      ];
      db.requestTypes.push(...defaultTypes);
    }

    const newUser: User = {
      id: createId('user'),
      name,
      email,
      passwordHash: hashPassword(payload.password),
      teamId,
      role,
      title: role === 'admin' ? '팀 관리자' : '팀원',
    };

    db.users.push(newUser);
    saveDb(db);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_USER_KEY, newUser.id);
    }
    return { ok: true, user: newUser };
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_USER_KEY);
    }
  },

  // === Team & Types ===
  getTeam(teamId: string): Team | null {
    const db = loadDb();
    return db.teams.find((t) => t.id === teamId) ?? null;
  },

  getTeamMembers(teamId: string): User[] {
    const db = loadDb();
    return db.users.filter((u) => u.teamId === teamId);
  },

  getRequestTypes(teamId: string): RequestType[] {
    const db = loadDb();
    return db.requestTypes.filter((t) => t.teamId === teamId);
  },

  createRequestType(
    actorId: string,
    input: RequestTypeInput
  ): { ok: true; type: RequestType } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || actor.role !== 'admin') {
      return { ok: false, error: '관리자만 요청 유형을 추가할 수 있습니다.' };
    }
    const check = validateRequestTypeInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error ?? '입력값을 확인해 주세요.' };
    }
    const newType: RequestType = {
      id: createId('type'),
      teamId: actor.teamId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      icon: input.icon,
      color: input.color,
      defaultAssigneeIds: input.defaultAssigneeIds.filter((id) =>
        db.users.some((u) => u.id === id && u.teamId === actor.teamId)
      ),
      fields: input.fields.map((f) => ({
        ...f,
        id: f.id || createId('field'),
        label: f.label.trim(),
        placeholder: f.placeholder?.trim() || undefined,
        options:
          f.type === 'select'
            ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
            : undefined,
      })),
    };
    db.requestTypes.push(newType);
    saveDb(db);
    return { ok: true, type: newType };
  },

  updateRequestType(
    actorId: string,
    typeId: string,
    input: RequestTypeInput
  ): { ok: true; type: RequestType } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || actor.role !== 'admin') {
      return { ok: false, error: '관리자만 요청 유형을 수정할 수 있습니다.' };
    }
    const existing = db.requestTypes.find(
      (t) => t.id === typeId && t.teamId === actor.teamId
    );
    if (!existing) {
      return { ok: false, error: '수정할 요청 유형을 찾을 수 없습니다.' };
    }
    const check = validateRequestTypeInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error ?? '입력값을 확인해 주세요.' };
    }

    existing.name = input.name.trim();
    existing.description = input.description?.trim() || undefined;
    existing.icon = input.icon;
    existing.color = input.color;
    existing.defaultAssigneeIds = input.defaultAssigneeIds.filter((id) =>
      db.users.some((u) => u.id === id && u.teamId === actor.teamId)
    );
    existing.fields = input.fields.map((f) => ({
      ...f,
      id: f.id || createId('field'),
      label: f.label.trim(),
      placeholder: f.placeholder?.trim() || undefined,
      options:
        f.type === 'select'
          ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined,
    }));

    saveDb(db);
    return { ok: true, type: existing };
  },

  deleteRequestType(
    actorId: string,
    typeId: string
  ): { ok: true } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || actor.role !== 'admin') {
      return { ok: false, error: '관리자만 요청 유형을 삭제할 수 있습니다.' };
    }
    const teamTypes = db.requestTypes.filter((t) => t.teamId === actor.teamId);
    if (teamTypes.length <= 1) {
      return { ok: false, error: '최소 1개의 요청 유형은 유지해야 합니다.' };
    }
    const target = teamTypes.find((t) => t.id === typeId);
    if (!target) {
      return { ok: false, error: '삭제할 요청 유형을 찾을 수 없습니다.' };
    }
    db.requestTypes = db.requestTypes.filter((t) => t.id !== typeId);
    saveDb(db);
    return { ok: true };
  },

  regenerateInviteCode(
    actorId: string
  ): { ok: true; inviteCode: string } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || actor.role !== 'admin') {
      return { ok: false, error: '관리자만 초대 코드를 재발급할 수 있습니다.' };
    }
    const team = db.teams.find((t) => t.id === actor.teamId);
    if (!team) {
      return { ok: false, error: '팀 정보를 찾을 수 없습니다.' };
    }
    team.inviteCode = generateInviteCode('TEAM');
    saveDb(db);
    return { ok: true, inviteCode: team.inviteCode };
  },

  // === Requests ===
  getRequests(userId: string, tab: InboxTab): RequestWithDetails[] {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return [];

    const filtered = filterRequestsForTab(user, db.requests, db.recipients, tab);
    return filtered
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((req) => hydrateRequest(db, req));
  },

  getRequestCounts(userId: string): Record<InboxTab, number> {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { sent: 0, received: 0, cc: 0, all: 0 };

    return {
      sent: filterRequestsForTab(user, db.requests, db.recipients, 'sent').length,
      received: filterRequestsForTab(user, db.requests, db.recipients, 'received').length,
      cc: filterRequestsForTab(user, db.requests, db.recipients, 'cc').length,
      all: filterRequestsForTab(user, db.requests, db.recipients, 'all').length,
    };
  },

  getRequestById(requestId: string, actorId: string): RequestWithDetails | null {
    const db = loadDb();
    const user = db.users.find((u) => u.id === actorId);
    const req = db.requests.find((r) => r.id === requestId);
    if (!user || !req) return null;
    if (!canViewRequest(user, req, db.recipients)) return null;
    return hydrateRequest(db, req);
  },

  createRequest(
    input: CreateRequestInput
  ): { ok: true; request: RequestWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const requester = db.users.find((u) => u.id === input.requesterId);
    if (!requester) {
      return { ok: false, error: '요청자 정보를 찾을 수 없습니다.' };
    }
    const reqType = db.requestTypes.find((t) => t.id === input.typeId && t.teamId === requester.teamId);
    if (!reqType) {
      return { ok: false, error: '유효하지 않은 요청 유형입니다.' };
    }
    if (!input.title.trim()) {
      return { ok: false, error: '요청 제목을 입력해 주세요.' };
    }
    if (!input.content.trim()) {
      return { ok: false, error: '상세 내용을 입력해 주세요.' };
    }
    const recCheck = validateRecipients(input.recipients);
    if (!recCheck.valid) {
      return { ok: false, error: recCheck.error ?? '수신자를 확인해 주세요.' };
    }

    const now = new Date().toISOString();
    const requestId = createId('req');
    const newReq: Request = {
      id: requestId,
      teamId: requester.teamId,
      typeId: reqType.id,
      requesterId: requester.id,
      title: input.title.trim(),
      content: input.content.trim(),
      fieldValues: input.fieldValues,
      dueDate: input.dueDate,
      urgency: input.urgency,
      status: '접수',
      rejectReason: null,
      createdAt: now,
      updatedAt: now,
    };

    db.requests.unshift(newReq);

    for (const r of input.recipients) {
      const rec: Recipient = {
        id: createId('rec'),
        requestId,
        userId: r.userId,
        role: r.role,
        seenAt: null,
      };
      db.recipients.push(rec);

      if (r.userId !== requester.id) {
        const noti: Notification = {
          id: createId('noti'),
          userId: r.userId,
          requestId,
          kind: r.role === 'assignee' ? 'assigned' : 'new_request',
          actorId: requester.id,
          message:
            r.role === 'assignee'
              ? `${requester.name}님이 "${newReq.title}"의 담당자로 지정했습니다.`
              : `${requester.name}님이 "${newReq.title}"에 참조자로 추가했습니다.`,
          readAt: null,
          createdAt: now,
        };
        db.notifications.unshift(noti);
      }
    }

    db.statusLogs.push({
      id: createId('log'),
      requestId,
      actorId: requester.id,
      fromStatus: null,
      toStatus: '접수',
      createdAt: now,
    });

    saveDb(db);
    return { ok: true, request: hydrateRequest(db, newReq) };
  },

  updateRequest(
    requestId: string,
    actorId: string,
    input: UpdateRequestInput
  ): { ok: true; request: RequestWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const req = db.requests.find((r) => r.id === requestId);
    if (!actor || !req) {
      return { ok: false, error: '요청을 찾을 수 없습니다.' };
    }
    const editCheck = canEditRequestContent(actor, req);
    if (!editCheck.allowed) {
      return { ok: false, error: editCheck.reason ?? '수정 권한이 없습니다.' };
    }
    if (!input.title.trim() || !input.content.trim()) {
      return { ok: false, error: '제목과 상세 내용을 모두 입력해 주세요.' };
    }

    req.title = input.title.trim();
    req.content = input.content.trim();
    req.fieldValues = input.fieldValues;
    req.dueDate = input.dueDate;
    req.urgency = input.urgency;
    req.updatedAt = new Date().toISOString();

    saveDb(db);
    return { ok: true, request: hydrateRequest(db, req) };
  },

  deleteRequest(
    requestId: string,
    actorId: string
  ): { ok: true } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const req = db.requests.find((r) => r.id === requestId);
    if (!actor || !req) {
      return { ok: false, error: '요청을 찾을 수 없습니다.' };
    }
    if (!canDeleteOrCancelRequest(actor, req)) {
      return { ok: false, error: '요청을 취소하거나 삭제할 수 있는 권한이 없습니다.' };
    }

    db.requests = db.requests.filter((r) => r.id !== requestId);
    db.recipients = db.recipients.filter((r) => r.requestId !== requestId);
    db.comments = db.comments.filter((c) => c.requestId !== requestId);
    db.statusLogs = db.statusLogs.filter((l) => l.requestId !== requestId);
    db.notifications = db.notifications.filter((n) => n.requestId !== requestId);

    saveDb(db);
    return { ok: true };
  },

  updateStatus(
    requestId: string,
    actorId: string,
    toStatus: RequestStatus,
    rejectReason?: string | null
  ): { ok: true; request: RequestWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const req = db.requests.find((r) => r.id === requestId);
    if (!actor || !req) {
      return { ok: false, error: '요청을 찾을 수 없습니다.' };
    }

    const userIsAssignee = isUserAssignee(actorId, requestId, db.recipients);
    const validation = validateStatusChange({
      fromStatus: req.status,
      toStatus,
      rejectReason,
      userIsAssignee,
    });

    if (!validation.valid) {
      return { ok: false, error: validation.error ?? '상태 변경에 실패했습니다.' };
    }

    const now = new Date().toISOString();
    const prevStatus = req.status;
    const trimmedReason = (rejectReason ?? '').trim();
    req.status = toStatus;
    req.rejectReason = toStatus === '반려' ? trimmedReason : null;
    req.holdReason = toStatus === '보류' ? trimmedReason : null;
    req.updatedAt = now;

    // 담당자가 확인 시 seenAt 갱신
    const rec = db.recipients.find(
      (r) => r.requestId === requestId && r.userId === actorId
    );
    if (rec && !rec.seenAt) {
      rec.seenAt = now;
    }

    db.statusLogs.push({
      id: createId('log'),
      requestId,
      actorId,
      fromStatus: prevStatus,
      toStatus,
      note:
        toStatus === '반려' || toStatus === '보류'
          ? trimmedReason || undefined
          : undefined,
      createdAt: now,
    });

    // 요청자 및 다른 수신자에게 상태 변경 알림 생성
    const notifyTargets = new Set<string>([
      req.requesterId,
      ...db.recipients.filter((r) => r.requestId === requestId).map((r) => r.userId),
    ]);
    notifyTargets.delete(actorId);

    if (notifyTargets.size === 0) {
      db.notifications.unshift({
        id: createId('noti'),
        userId: actorId,
        requestId,
        kind: 'status_changed',
        actorId,
        message: `"${req.title}" 상태가 ${toStatus}(으)로 변경되었습니다.`,
        readAt: null,
        createdAt: now,
      });
    } else {
      for (const targetUserId of notifyTargets) {
        db.notifications.unshift({
          id: createId('noti'),
          userId: targetUserId,
          requestId,
          kind: 'status_changed',
          actorId,
          message: `${actor.name}님이 "${req.title}" 상태를 ${toStatus}(으)로 변경했습니다.`,
          readAt: null,
          createdAt: now,
        });
      }
    }

    saveDb(db);
    return { ok: true, request: hydrateRequest(db, req) };
  },

  addComment(
    requestId: string,
    authorId: string,
    body: string
  ): { ok: true; comment: Comment; request: RequestWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const author = db.users.find((u) => u.id === authorId);
    const req = db.requests.find((r) => r.id === requestId);
    if (!author || !req) {
      return { ok: false, error: '요청을 찾을 수 없습니다.' };
    }
    if (!canViewRequest(author, req, db.recipients)) {
      return { ok: false, error: '댓글을 작성할 권한이 없습니다.' };
    }
    const trimmed = body.trim();
    if (!trimmed) {
      return { ok: false, error: '댓글 내용을 입력해 주세요.' };
    }

    const now = new Date().toISOString();
    const newComment: Comment = {
      id: createId('cmt'),
      requestId,
      authorId,
      body: trimmed,
      createdAt: now,
    };
    db.comments.push(newComment);
    req.updatedAt = now;

    const notifyTargets = new Set<string>([
      req.requesterId,
      ...db.recipients.filter((r) => r.requestId === requestId).map((r) => r.userId),
    ]);
    notifyTargets.delete(authorId);

    for (const targetUserId of notifyTargets) {
      db.notifications.unshift({
        id: createId('noti'),
        userId: targetUserId,
        requestId,
        kind: 'comment_added',
        actorId: authorId,
        message: `${author.name}님이 "${req.title}"에 댓글을 남겼습니다.`,
        readAt: null,
        createdAt: now,
      });
    }

    saveDb(db);
    return { ok: true, comment: newComment, request: hydrateRequest(db, req) };
  },

  // === Notifications ===
  getNotifications(userId: string): Notification[] {
    const db = loadDb();
    return db.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  markNotificationRead(notificationId: string): void {
    const db = loadDb();
    const noti = db.notifications.find((n) => n.id === notificationId);
    if (noti && !noti.readAt) {
      noti.readAt = new Date().toISOString();
      saveDb(db);
    }
  },

  markAllNotificationsRead(userId: string): void {
    const db = loadDb();
    const now = new Date().toISOString();
    let changed = false;
    for (const n of db.notifications) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
        changed = true;
      }
    }
    if (changed) saveDb(db);
  },

  deleteNotification(notificationId: string): void {
    const db = loadDb();
    const next = db.notifications.filter((n) => n.id !== notificationId);
    if (next.length !== db.notifications.length) {
      db.notifications = next;
      saveDb(db);
    }
  },

  deleteAllNotifications(userId: string): void {
    const db = loadDb();
    const next = db.notifications.filter((n) => n.userId !== userId);
    if (next.length !== db.notifications.length) {
      db.notifications = next;
      saveDb(db);
    }
  },

  // === Chat ===
  getChatRooms(userId: string): ChatRoomWithDetails[] {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return [];

    return db.chatRooms
      .filter((room) => room.teamId === user.teamId && canAccessChatRoom(userId, room))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((room) => hydrateChatRoom(db, room, userId));
  },

  getChatRoomById(roomId: string, userId: string): ChatRoomWithDetails | null {
    const db = loadDb();
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!room || !canAccessChatRoom(userId, room)) return null;
    return hydrateChatRoom(db, room, userId);
  },

  getUnreadChatCount(userId: string): number {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return 0;
    return db.chatRooms
      .filter((room) => room.teamId === user.teamId && canAccessChatRoom(userId, room))
      .reduce((acc, room) => acc + countUnreadMessagesForRoom(room, db.chatMessages, userId), 0);
  },

  createOrGetDirectChat(
    actorId: string,
    targetUserId: string
  ): { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const target = db.users.find((u) => u.id === targetUserId);
    if (!actor || !target || actor.teamId !== target.teamId) {
      return { ok: false, error: '대화할 팀원을 찾을 수 없습니다.' };
    }
    if (actorId === targetUserId) {
      return { ok: false, error: '다른 팀원을 선택해 주세요.' };
    }

    const existing = findExistingDirectRoom(db.chatRooms, actor.teamId, actorId, targetUserId);
    if (existing) {
      existing.lastReadAtByUser[actorId] = new Date().toISOString();
      saveDb(db);
      return { ok: true, room: hydrateChatRoom(db, existing, actorId) };
    }

    const now = new Date().toISOString();
    const newRoom: ChatRoom = {
      id: createId('chat'),
      teamId: actor.teamId,
      kind: 'direct',
      memberIds: [actorId, targetUserId],
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
      lastReadAtByUser: {
        [actorId]: now,
      },
    };
    db.chatRooms.unshift(newRoom);
    db.notifications.unshift({
      id: createId('noti'),
      userId: targetUserId,
      chatRoomId: newRoom.id,
      kind: 'chat_invited',
      actorId,
      message: `${actor.name}님이 1:1 대화를 시작했습니다.`,
      readAt: null,
      createdAt: now,
    });
    saveDb(db);
    return { ok: true, room: hydrateChatRoom(db, newRoom, actorId) };
  },

  createGroupChat(
    actorId: string,
    memberIds: string[],
    title?: string
  ): { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor) {
      return { ok: false, error: '사용자 정보를 찾을 수 없습니다.' };
    }
    const validTargets = Array.from(new Set(memberIds))
      .filter((id) => id !== actorId)
      .filter((id) => db.users.some((u) => u.id === id && u.teamId === actor.teamId));

    if (validTargets.length === 0) {
      return { ok: false, error: '대화할 팀원을 최소 1명 이상 선택해 주세요.' };
    }
    if (validTargets.length === 1 && !title?.trim()) {
      return this.createOrGetDirectChat(actorId, validTargets[0]);
    }

    const now = new Date().toISOString();
    const allMembers = [actorId, ...validTargets];
    const userMap = new Map(db.users.map((u) => [u.id, u]));
    const trimmedTitle = title?.trim();
    const newRoom: ChatRoom = {
      id: createId('chat'),
      teamId: actor.teamId,
      kind: 'group',
      title: trimmedTitle || undefined,
      memberIds: allMembers,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
      lastReadAtByUser: {
        [actorId]: now,
      },
    };
    db.chatRooms.unshift(newRoom);

    const invitedNames = validTargets
      .map((id) => userMap.get(id)?.name ?? '팀원')
      .join(', ');

    db.chatMessages.push({
      id: createId('cmsg'),
      roomId: newRoom.id,
      senderId: actorId,
      body: `${actor.name}님이 ${invitedNames}님을 채팅방에 초대했습니다.`,
      system: true,
      createdAt: now,
    });

    const roomLabel = getChatRoomDisplayName(newRoom, actorId, userMap);
    for (const targetId of validTargets) {
      db.notifications.unshift({
        id: createId('noti'),
        userId: targetId,
        chatRoomId: newRoom.id,
        kind: 'chat_invited',
        actorId,
        message: `${actor.name}님이 "${roomLabel}" 채팅방에 초대했습니다.`,
        readAt: null,
        createdAt: now,
      });
    }

    saveDb(db);
    return { ok: true, room: hydrateChatRoom(db, newRoom, actorId) };
  },

  inviteToChatRoom(
    roomId: string,
    actorId: string,
    inviteeIds: string[]
  ): { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!actor || !room || !canAccessChatRoom(actorId, room)) {
      return { ok: false, error: '채팅방에 초대할 권한이 없습니다.' };
    }

    const validInvitees = Array.from(new Set(inviteeIds))
      .filter((id) => !room.memberIds.includes(id))
      .filter((id) => db.users.some((u) => u.id === id && u.teamId === actor.teamId));

    if (validInvitees.length === 0) {
      return { ok: false, error: '초대할 새 팀원을 선택해 주세요.' };
    }

    const now = new Date().toISOString();
    room.memberIds = [...room.memberIds, ...validInvitees];
    if (room.memberIds.length > 2) {
      room.kind = 'group';
    }
    room.updatedAt = now;
    room.lastReadAtByUser[actorId] = now;

    const userMap = new Map(db.users.map((u) => [u.id, u]));
    const inviteeNames = validInvitees
      .map((id) => userMap.get(id)?.name ?? '팀원')
      .join(', ');

    db.chatMessages.push({
      id: createId('cmsg'),
      roomId: room.id,
      senderId: actorId,
      body: `${actor.name}님이 ${inviteeNames}님을 대화에 초대했습니다.`,
      system: true,
      createdAt: now,
    });

    const roomLabel = getChatRoomDisplayName(room, actorId, userMap);
    for (const targetId of validInvitees) {
      db.notifications.unshift({
        id: createId('noti'),
        userId: targetId,
        chatRoomId: room.id,
        kind: 'chat_invited',
        actorId,
        message: `${actor.name}님이 "${roomLabel}" 채팅방에 초대했습니다.`,
        readAt: null,
        createdAt: now,
      });
    }

    saveDb(db);
    return { ok: true, room: hydrateChatRoom(db, room, actorId) };
  },

  sendChatMessage(
    roomId: string,
    senderId: string,
    body: string
  ): { ok: true; message: ChatMessage; room: ChatRoomWithDetails } | { ok: false; error: string } {
    const db = loadDb();
    const sender = db.users.find((u) => u.id === senderId);
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!sender || !room || !canAccessChatRoom(senderId, room)) {
      return { ok: false, error: '채팅방에 메시지를 보낼 수 없습니다.' };
    }
    const trimmed = body.trim();
    if (!trimmed) {
      return { ok: false, error: '메시지 내용을 입력해 주세요.' };
    }

    const now = new Date().toISOString();
    const newMsg: ChatMessage = {
      id: createId('cmsg'),
      roomId,
      senderId,
      body: trimmed,
      createdAt: now,
    };
    db.chatMessages.push(newMsg);
    room.updatedAt = now;
    room.lastReadAtByUser[senderId] = now;

    const userMap = new Map(db.users.map((u) => [u.id, u]));
    const preview = trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed;
    for (const memberId of room.memberIds) {
      if (memberId === senderId) continue;
      const roomLabel = getChatRoomDisplayName(room, memberId, userMap);
      db.notifications.unshift({
        id: createId('noti'),
        userId: memberId,
        chatRoomId: room.id,
        kind: 'chat_message',
        actorId: senderId,
        message: `${sender.name} (${roomLabel}): ${preview}`,
        readAt: null,
        createdAt: now,
      });
    }

    saveDb(db);
    return { ok: true, message: newMsg, room: hydrateChatRoom(db, room, senderId) };
  },

  markChatRoomRead(roomId: string, userId: string): void {
    const db = loadDb();
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!room || !canAccessChatRoom(userId, room)) return;
    room.lastReadAtByUser[userId] = new Date().toISOString();
    saveDb(db);
  },

  leaveChatRoom(
    roomId: string,
    userId: string
  ): { ok: true } | { ok: false; error: string } {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!user || !room || !canLeaveChatRoom(userId, room)) {
      return { ok: false, error: '채팅방을 나갈 수 없습니다.' };
    }
    const now = new Date().toISOString();
    room.memberIds = room.memberIds.filter((id) => id !== userId);
    delete room.lastReadAtByUser[userId];

    if (room.memberIds.length === 0) {
      db.chatRooms = db.chatRooms.filter((r) => r.id !== roomId);
      db.chatMessages = db.chatMessages.filter((m) => m.roomId !== roomId);
      db.notifications = db.notifications.filter((n) => n.chatRoomId !== roomId);
    } else {
      room.updatedAt = now;
      db.chatMessages.push({
        id: createId('cmsg'),
        roomId: room.id,
        senderId: userId,
        body: `${user.name}님이 채팅방을 나갔습니다.`,
        system: true,
        createdAt: now,
      });
    }

    saveDb(db);
    return { ok: true };
  },

  deleteChatRoom(
    roomId: string,
    actorId: string
  ): { ok: true } | { ok: false; error: string } {
    const db = loadDb();
    const actor = db.users.find((u) => u.id === actorId);
    const room = db.chatRooms.find((r) => r.id === roomId);
    if (!actor || !room) {
      return { ok: false, error: '채팅방을 찾을 수 없습니다.' };
    }
    if (!canDeleteChatRoom(actor, room)) {
      return { ok: false, error: '채팅방을 삭제할 권한이 없습니다.' };
    }

    db.chatRooms = db.chatRooms.filter((r) => r.id !== roomId);
    db.chatMessages = db.chatMessages.filter((m) => m.roomId !== roomId);
    db.notifications = db.notifications.filter((n) => n.chatRoomId !== roomId);

    saveDb(db);
    return { ok: true };
  },
};
