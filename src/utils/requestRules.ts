import type {
  InboxTab,
  Recipient,
  RecipientRole,
  Request,
  RequestStatus,
  User,
} from '../types/models';

export const ALL_STATUSES: RequestStatus[] = ['접수', '확인', '진행 중', '완료', '반려'];

export function isTerminalStatus(status: RequestStatus): boolean {
  return status === '완료' || status === '반려';
}

export function canViewRequest(
  user: User,
  request: Request,
  recipients: Recipient[]
): boolean {
  if (user.teamId !== request.teamId) return false;
  if (user.role === 'admin') return true;
  if (request.requesterId === user.id) return true;
  return recipients.some(
    (r) => r.requestId === request.id && r.userId === user.id
  );
}

export function filterRequestsForTab(
  user: User,
  requests: Request[],
  recipients: Recipient[],
  tab: InboxTab
): Request[] {
  const visible = requests.filter((req) => canViewRequest(user, req, recipients));

  return visible.filter((req) => {
    if (tab === 'sent') {
      return req.requesterId === user.id;
    }
    if (tab === 'received') {
      return recipients.some(
        (r) =>
          r.requestId === req.id &&
          r.userId === user.id &&
          r.role === 'assignee'
      );
    }
    if (tab === 'cc') {
      return recipients.some(
        (r) =>
          r.requestId === req.id && r.userId === user.id && r.role === 'cc'
      );
    }
    if (tab === 'all') {
      return user.role === 'admin';
    }
    return false;
  });
}

export function isUserAssignee(
  userId: string,
  requestId: string,
  recipients: Recipient[]
): boolean {
  return recipients.some(
    (r) =>
      r.requestId === requestId &&
      r.userId === userId &&
      r.role === 'assignee'
  );
}

export function canEditRequestContent(user: User, request: Request): {
  allowed: boolean;
  reason?: string;
} {
  if (request.requesterId !== user.id) {
    return { allowed: false, reason: '요청자만 요청 내용을 수정할 수 있습니다.' };
  }
  if (request.status === '접수' || request.status === '확인') {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: '진행 중 이후 상태에서는 내용을 수정할 수 없습니다. 댓글로 보완해 주세요.',
  };
}

export function canDeleteOrCancelRequest(user: User, request: Request): boolean {
  if (user.teamId !== request.teamId) return false;
  if (user.role === 'admin') return true;
  if (request.requesterId === user.id && !isTerminalStatus(request.status)) {
    return true;
  }
  return false;
}

export interface StatusTransitionOption {
  toStatus: RequestStatus;
  label: string;
  primary?: boolean;
  requiresReason?: boolean;
}

export function getAvailableStatusTransitions(
  currentStatus: RequestStatus,
  userIsAssignee: boolean
): StatusTransitionOption[] {
  if (!userIsAssignee || isTerminalStatus(currentStatus)) {
    return [];
  }

  switch (currentStatus) {
    case '접수':
      return [
        { toStatus: '확인', label: '확인했어요', primary: true },
        { toStatus: '진행 중', label: '진행 중으로' },
        { toStatus: '완료', label: '바로 완료' },
        { toStatus: '반려', label: '반려하기', requiresReason: true },
      ];
    case '확인':
      return [
        { toStatus: '진행 중', label: '진행 중으로 변경', primary: true },
        { toStatus: '완료', label: '완료 처리' },
        { toStatus: '반려', label: '반려하기', requiresReason: true },
      ];
    case '진행 중':
      return [
        { toStatus: '완료', label: '완료 처리', primary: true },
        { toStatus: '반려', label: '반려하기', requiresReason: true },
      ];
    default:
      return [];
  }
}

export function validateStatusChange(params: {
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  rejectReason?: string | null;
  userIsAssignee: boolean;
}): { valid: boolean; error?: string } {
  const { fromStatus, toStatus, rejectReason, userIsAssignee } = params;

  if (!userIsAssignee) {
    return { valid: false, error: '담당자로 지정된 팀원만 상태를 변경할 수 있습니다.' };
  }
  if (isTerminalStatus(fromStatus)) {
    return { valid: false, error: `${fromStatus} 상태의 요청은 더 이상 변경할 수 없습니다.` };
  }
  if (fromStatus === toStatus) {
    return { valid: false, error: '현재 상태와 동일한 상태로 변경할 수 없습니다.' };
  }
  if (toStatus === '반려' && (!rejectReason || rejectReason.trim().length === 0)) {
    return { valid: false, error: '반려할 때는 반려 사유를 반드시 입력해야 합니다.' };
  }
  return { valid: true };
}

export function validateRecipients(
  recipients: Array<{ userId: string; role: RecipientRole }>
): { valid: boolean; error?: string } {
  const seen = new Set<string>();
  for (const r of recipients) {
    if (seen.has(r.userId)) {
      return { valid: false, error: '중복된 수신자가 포함되어 있습니다.' };
    }
    seen.add(r.userId);
  }
  const hasAssignee = recipients.some((r) => r.role === 'assignee');
  if (!hasAssignee) {
    return { valid: false, error: '최소 1명의 "담당" 팀원을 지정해야 요청을 등록할 수 있습니다.' };
  }
  return { valid: true };
}
