export type UserRole = 'admin' | 'member';

export type RequestStatus = '접수' | '확인' | '진행 중' | '완료' | '반려';

export type UrgencyLevel = '낮음' | '보통' | '높음';

export type RecipientRole = 'assignee' | 'cc';

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox';

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export type RequestTypeIconName =
  | 'Package'
  | 'Laptop'
  | 'Handshake'
  | 'FileCheck'
  | 'CalendarDays'
  | 'MessageSquareHeart'
  | 'Sparkles'
  | 'ClipboardList';

export type RequestTypeColor =
  | 'blue'
  | 'purple'
  | 'orange'
  | 'emerald'
  | 'pink'
  | 'teal';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  teamId: string;
  role: UserRole;
  title?: string;
}

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
}

export interface RequestType {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  icon: RequestTypeIconName;
  color: RequestTypeColor;
  fields: CustomFieldDefinition[];
  defaultAssigneeIds: string[];
}

export type FieldValue = string | number | boolean;

export interface Request {
  id: string;
  teamId: string;
  typeId: string;
  requesterId: string;
  title: string;
  content: string;
  fieldValues: Record<string, FieldValue>;
  dueDate: string; // YYYY-MM-DD or ''
  urgency: UrgencyLevel;
  status: RequestStatus;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Recipient {
  id: string;
  requestId: string;
  userId: string;
  role: RecipientRole;
  seenAt: string | null;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface StatusLog {
  id: string;
  requestId: string;
  actorId: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  note?: string;
  createdAt: string;
}

export type NotificationKind =
  | 'new_request'
  | 'status_changed'
  | 'comment_added'
  | 'assigned'
  | 'chat_invited'
  | 'chat_message';

export interface Notification {
  id: string;
  userId: string;
  requestId?: string;
  chatRoomId?: string;
  kind: NotificationKind;
  actorId?: string;
  message?: string;
  readAt: string | null;
  createdAt: string;
}

export interface RequestWithDetails extends Request {
  type: RequestType | undefined;
  requester: User | undefined;
  recipients: Array<Recipient & { user: User | undefined }>;
  comments: Array<Comment & { author: User | undefined }>;
  statusLogs: Array<StatusLog & { actor: User | undefined }>;
}

export type InboxTab = 'sent' | 'received' | 'cc' | 'all';

export interface CreateRequestInput {
  typeId: string;
  requesterId: string;
  title: string;
  content: string;
  fieldValues: Record<string, FieldValue>;
  dueDate: string;
  urgency: UrgencyLevel;
  recipients: Array<{ userId: string; role: RecipientRole }>;
}

export interface UpdateRequestInput {
  title: string;
  content: string;
  fieldValues: Record<string, FieldValue>;
  dueDate: string;
  urgency: UrgencyLevel;
}

export type ChatRoomKind = 'direct' | 'group';

export interface ChatRoom {
  id: string;
  teamId: string;
  kind: ChatRoomKind;
  title?: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastReadAtByUser: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  system?: boolean;
  createdAt: string;
}

export interface ChatRoomWithDetails extends ChatRoom {
  members: User[];
  messages: Array<ChatMessage & { sender: User | undefined }>;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}
