import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './auth';
import { formatDDay } from './dateUtils';
import {
  canDeleteOrCancelRequest,
  canEditRequestContent,
  canViewRequest,
  filterRequestsForTab,
  getAvailableStatusTransitions,
  validateRecipients,
  validateStatusChange,
} from './requestRules';
import type { Recipient, Request, User } from '../types/models';

const adminUser: User = {
  id: 'u_admin',
  name: '김서연',
  email: 'admin@team.kr',
  passwordHash: hashPassword('pass1234'),
  teamId: 'team_1',
  role: 'admin',
};

const requesterUser: User = {
  id: 'u_req',
  name: '이준호',
  email: 'junho@team.kr',
  passwordHash: hashPassword('pass1234'),
  teamId: 'team_1',
  role: 'member',
};

const assigneeUser: User = {
  id: 'u_assign',
  name: '박지민',
  email: 'jimin@team.kr',
  passwordHash: hashPassword('pass1234'),
  teamId: 'team_1',
  role: 'member',
};

const ccUser: User = {
  id: 'u_cc',
  name: '최민수',
  email: 'minsu@team.kr',
  passwordHash: hashPassword('pass1234'),
  teamId: 'team_1',
  role: 'member',
};

const unrelatedUser: User = {
  id: 'u_other',
  name: '정하은',
  email: 'haeun@team.kr',
  passwordHash: hashPassword('pass1234'),
  teamId: 'team_1',
  role: 'member',
};

const baseRequest: Request = {
  id: 'req_1',
  teamId: 'team_1',
  typeId: 'type_1',
  requesterId: 'u_req',
  title: '무선 키보드 교체 요청',
  content: '기존 키보드 키 인식이 간헐적으로 끊깁니다.',
  fieldValues: {},
  dueDate: '2026-11-22',
  urgency: '보통',
  status: '접수',
  rejectReason: null,
  createdAt: '2026-11-19T10:00:00Z',
  updatedAt: '2026-11-19T10:00:00Z',
};

const recipients: Recipient[] = [
  { id: 'r_1', requestId: 'req_1', userId: 'u_assign', role: 'assignee', seenAt: null },
  { id: 'r_2', requestId: 'req_1', userId: 'u_cc', role: 'cc', seenAt: null },
];

test('password hashing produces non-plaintext hash and verifies accurately', () => {
  const hashed = hashPassword('secret123');
  assert.notEqual(hashed, 'secret123');
  assert.equal(verifyPassword('secret123', hashed), true);
  assert.equal(verifyPassword('wrongpass', hashed), false);
});

test('visibility: only requester, recipients, and admin can view request', () => {
  assert.equal(canViewRequest(requesterUser, baseRequest, recipients), true);
  assert.equal(canViewRequest(assigneeUser, baseRequest, recipients), true);
  assert.equal(canViewRequest(ccUser, baseRequest, recipients), true);
  assert.equal(canViewRequest(adminUser, baseRequest, recipients), true);
  assert.equal(canViewRequest(unrelatedUser, baseRequest, recipients), false);
});

test('tab filtering routes requests accurately across sent, received, cc, and admin all', () => {
  assert.equal(filterRequestsForTab(requesterUser, [baseRequest], recipients, 'sent').length, 1);
  assert.equal(filterRequestsForTab(assigneeUser, [baseRequest], recipients, 'received').length, 1);
  assert.equal(filterRequestsForTab(ccUser, [baseRequest], recipients, 'cc').length, 1);
  assert.equal(filterRequestsForTab(unrelatedUser, [baseRequest], recipients, 'received').length, 0);
  assert.equal(filterRequestsForTab(adminUser, [baseRequest], recipients, 'all').length, 1);
  assert.equal(filterRequestsForTab(requesterUser, [baseRequest], recipients, 'all').length, 0);
});

test('requester can edit only in 접수 or 확인 status, blocked in 진행 중 or later', () => {
  assert.equal(canEditRequestContent(requesterUser, { ...baseRequest, status: '접수' }).allowed, true);
  assert.equal(canEditRequestContent(requesterUser, { ...baseRequest, status: '확인' }).allowed, true);
  assert.equal(canEditRequestContent(requesterUser, { ...baseRequest, status: '진행 중' }).allowed, false);
  assert.equal(canEditRequestContent(requesterUser, { ...baseRequest, status: '완료' }).allowed, false);
  assert.equal(canEditRequestContent(assigneeUser, { ...baseRequest, status: '접수' }).allowed, false);
});

test('status transitions require assignee and reject requires non-empty reason', () => {
  const transitions = getAvailableStatusTransitions('접수', true);
  assert.equal(transitions[0]?.toStatus, '확인');
  assert.equal(transitions[0]?.label, '확인했어요');
  assert.equal(getAvailableStatusTransitions('접수', false).length, 0);

  assert.equal(
    validateStatusChange({
      fromStatus: '접수',
      toStatus: '확인',
      userIsAssignee: false,
    }).valid,
    false
  );

  assert.equal(
    validateStatusChange({
      fromStatus: '접수',
      toStatus: '반려',
      rejectReason: '   ',
      userIsAssignee: true,
    }).valid,
    false
  );

  assert.equal(
    validateStatusChange({
      fromStatus: '접수',
      toStatus: '반려',
      rejectReason: '예산 범위 초과로 다음 달 신청 부탁드립니다.',
      userIsAssignee: true,
    }).valid,
    true
  );
});

test('recipient validation requires at least one assignee and no duplicates', () => {
  assert.equal(validateRecipients([{ userId: 'u_cc', role: 'cc' }]).valid, false);
  assert.equal(
    validateRecipients([
      { userId: 'u_assign', role: 'assignee' },
      { userId: 'u_cc', role: 'cc' },
    ]).valid,
    true
  );
  assert.equal(
    validateRecipients([
      { userId: 'u_assign', role: 'assignee' },
      { userId: 'u_assign', role: 'cc' },
    ]).valid,
    false
  );
});

test('requester cancel and admin delete permissions', () => {
  assert.equal(canDeleteOrCancelRequest(requesterUser, { ...baseRequest, status: '접수' }), true);
  assert.equal(canDeleteOrCancelRequest(requesterUser, { ...baseRequest, status: '완료' }), false);
  assert.equal(canDeleteOrCancelRequest(adminUser, { ...baseRequest, status: '완료' }), true);
});

import {
  moveFieldItem,
  pickDefaultInboxTab,
  validateRequestTypeInput,
} from './requestTypeRules';
import type { CustomFieldDefinition } from '../types/models';

test('formatDDay computes D-day strings accurately', () => {
  const ref = new Date(2026, 10, 19); // 2026-11-19
  assert.equal(formatDDay('2026-11-19', ref).label, 'D-Day');
  assert.equal(formatDDay('2026-11-22', ref).label, 'D-3');
  assert.equal(formatDDay('2026-11-17', ref).label, 'D+2');
  assert.equal(formatDDay('2026-11-17', ref).isOverdue, true);
});

test('validateRequestTypeInput checks name, field labels, and select options', () => {
  assert.equal(
    validateRequestTypeInput({
      name: '   ',
      icon: 'Package',
      color: 'blue',
      defaultAssigneeIds: [],
      fields: [],
    }).valid,
    false
  );

  assert.equal(
    validateRequestTypeInput({
      name: '장비 대여',
      icon: 'Laptop',
      color: 'purple',
      defaultAssigneeIds: [],
      fields: [{ id: 'f1', label: '대여 품목', type: 'select', options: [] }],
    }).valid,
    false
  );

  assert.equal(
    validateRequestTypeInput({
      name: '장비 대여',
      icon: 'Laptop',
      color: 'purple',
      defaultAssigneeIds: [],
      fields: [{ id: 'f1', label: '대여 품목', type: 'select', options: ['카메라', '마이크'] }],
    }).valid,
    true
  );
});

test('moveFieldItem reorders form fields safely', () => {
  const fields: CustomFieldDefinition[] = [
    { id: 'a', label: 'A', type: 'text' },
    { id: 'b', label: 'B', type: 'number' },
    { id: 'c', label: 'C', type: 'date' },
  ];
  assert.deepEqual(
    moveFieldItem(fields, 1, 'up').map((f) => f.id),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    moveFieldItem(fields, 0, 'up').map((f) => f.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(
    moveFieldItem(fields, 1, 'down').map((f) => f.id),
    ['a', 'c', 'b']
  );
});

import { evaluatePasswordStrength } from './passwordStrength';
import { validateAuthFormInput } from './formFeedback';

test('pickDefaultInboxTab selects first non-empty personal tab', () => {
  assert.equal(
    pickDefaultInboxTab({ sent: 3, received: 0, cc: 1, all: 9 }, 'received'),
    'sent'
  );
  assert.equal(
    pickDefaultInboxTab({ sent: 1, received: 4, cc: 2, all: 9 }, 'all'),
    'received'
  );
  assert.equal(
    pickDefaultInboxTab({ sent: 0, received: 0, cc: 2, all: 5 }, 'received'),
    'cc'
  );
});

test('evaluatePasswordStrength classifies empty, very-weak, weak, medium, and strong passwords', () => {
  assert.equal(evaluatePasswordStrength('').level, 'empty');
  assert.equal(evaluatePasswordStrength('').score, 0);

  assert.equal(evaluatePasswordStrength('123').level, 'very-weak');
  assert.equal(evaluatePasswordStrength('aaaa').level, 'very-weak');

  assert.equal(evaluatePasswordStrength('abcdef').level, 'weak');
  assert.equal(evaluatePasswordStrength('abcdef').label, '취약');

  assert.equal(evaluatePasswordStrength('abcd12').level, 'medium');
  assert.equal(evaluatePasswordStrength('abcd12').label, '보통');

  assert.equal(evaluatePasswordStrength('Abcd1234!').level, 'strong');
  assert.equal(evaluatePasswordStrength('Abcd1234!').label, '강함');
  assert.equal(evaluatePasswordStrength('Abcd1234!').score, 4);
});

test('validateAuthFormInput returns missing required fields in DOM focus order', () => {
  const loginIssues = validateAuthFormInput({
    mode: 'login',
    name: '',
    email: '',
    password: '',
    teamMode: 'join',
    inviteCode: '',
    newTeamName: '',
  });
  assert.deepEqual(
    loginIssues.map((i) => i.elementId),
    ['auth-email', 'auth-password']
  );

  const registerJoinIssues = validateAuthFormInput({
    mode: 'register',
    name: '',
    email: 'invalid-email',
    password: '12',
    teamMode: 'join',
    inviteCode: '',
    newTeamName: '',
  });
  assert.deepEqual(
    registerJoinIssues.map((i) => i.elementId),
    ['auth-name', 'auth-email', 'auth-password', 'invite-code']
  );

  const registerCreateValid = validateAuthFormInput({
    mode: 'register',
    name: '김민지',
    email: 'minji@team.kr',
    password: 'Password1!',
    teamMode: 'create',
    inviteCode: '',
    newTeamName: '디자인팀',
  });
  assert.equal(registerCreateValid.length, 0);
});

import {
  canAccessChatRoom,
  canDeleteChatRoom,
  canLeaveChatRoom,
  countUnreadMessagesForRoom,
  findExistingDirectRoom,
  getChatRoomDisplayName,
  getInvitableMembers,
  validateNewChatMembers,
} from './chatRules';
import type { ChatMessage, ChatRoom } from '../types/models';

test('chatRules: direct room matching, access control, display name, and invitable members', () => {
  const teamMembers = [adminUser, requesterUser, assigneeUser, ccUser];
  const userMap = new Map(teamMembers.map((u) => [u.id, u]));

  const directRoom: ChatRoom = {
    id: 'chat_1',
    teamId: 'team_1',
    kind: 'direct',
    memberIds: ['u_admin', 'u_req'],
    createdBy: 'u_admin',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    lastReadAtByUser: {
      u_admin: '2026-11-19T09:00:00Z',
    },
  };

  const groupRoom: ChatRoom = {
    id: 'chat_2',
    teamId: 'team_1',
    kind: 'group',
    title: '캠페인 TF',
    memberIds: ['u_admin', 'u_req', 'u_assign'],
    createdBy: 'u_admin',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    lastReadAtByUser: {},
  };

  assert.equal(findExistingDirectRoom([directRoom, groupRoom], 'team_1', 'u_req', 'u_admin')?.id, 'chat_1');
  assert.equal(findExistingDirectRoom([directRoom, groupRoom], 'team_1', 'u_admin', 'u_assign'), null);
  assert.equal(canAccessChatRoom('u_req', directRoom), true);
  assert.equal(canAccessChatRoom('u_cc', directRoom), false);

  assert.equal(getChatRoomDisplayName(directRoom, 'u_admin', userMap), '이준호');
  assert.equal(getChatRoomDisplayName(groupRoom, 'u_admin', userMap), '캠페인 TF');

  const invitable = getInvitableMembers(directRoom, teamMembers);
  assert.deepEqual(
    invitable.map((u) => u.id),
    ['u_assign', 'u_cc']
  );

  const msgs: ChatMessage[] = [
    { id: 'm1', roomId: 'chat_1', senderId: 'u_req', body: '첫 메시지', createdAt: '2026-11-19T08:30:00Z' },
    { id: 'm2', roomId: 'chat_1', senderId: 'u_req', body: '새 메시지', createdAt: '2026-11-19T09:30:00Z' },
    { id: 'm3', roomId: 'chat_1', senderId: 'u_admin', body: '내 답장', createdAt: '2026-11-19T09:40:00Z' },
  ];
  assert.equal(countUnreadMessagesForRoom(directRoom, msgs, 'u_admin'), 1);
  assert.equal(countUnreadMessagesForRoom(directRoom, msgs, 'u_req'), 1);

  assert.equal(validateNewChatMembers([]).valid, false);
  assert.equal(validateNewChatMembers(['u_req']).valid, true);
});

test('chatRules: leave and delete permissions by role, creator, and room kind', () => {
  const directRoom: ChatRoom = {
    id: 'chat_direct',
    teamId: 'team_1',
    kind: 'direct',
    memberIds: ['u_req', 'u_assign'],
    createdBy: 'u_req',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    lastReadAtByUser: {},
  };

  const groupByRequester: ChatRoom = {
    id: 'chat_group',
    teamId: 'team_1',
    kind: 'group',
    title: '디자인 리뷰',
    memberIds: ['u_admin', 'u_req', 'u_assign'],
    createdBy: 'u_req',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    lastReadAtByUser: {},
  };

  // Leave permissions
  assert.equal(canLeaveChatRoom('u_req', directRoom), true);
  assert.equal(canLeaveChatRoom('u_assign', directRoom), true);
  assert.equal(canLeaveChatRoom('u_cc', directRoom), false);
  assert.equal(canLeaveChatRoom('u_assign', groupByRequester), true);

  // Delete permissions
  assert.equal(canDeleteChatRoom(requesterUser, directRoom), true);
  assert.equal(canDeleteChatRoom(assigneeUser, directRoom), true);
  assert.equal(canDeleteChatRoom(ccUser, directRoom), false);

  assert.equal(canDeleteChatRoom(requesterUser, groupByRequester), true); // creator
  assert.equal(canDeleteChatRoom(adminUser, groupByRequester), true); // admin member
  assert.equal(canDeleteChatRoom(assigneeUser, groupByRequester), false); // non-creator member
  assert.equal(canDeleteChatRoom(ccUser, groupByRequester), false); // non-member
});




