import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { ChatRoomWithDetails, User } from '../types/models';
import {
  canDeleteChatRoom,
  canLeaveChatRoom,
  getChatRoomDisplayName,
  getInvitableMembers,
  validateNewChatMembers,
} from '../utils/chatRules';
import { formatKoreanDateTime, formatRelativeKoreanTime } from '../utils/dateUtils';
import { useFormValidationFeedback } from '../utils/formFeedback';
import {
  IOS_EASE,
  IOS_SPRING_IMESSAGE,
  IOS_SPRING_SHEET,
  IOS_SPRING_SNAPPY,
} from '../utils/motionPresets';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { UserAvatar } from '../components/UserAvatar';

export function ChatPage({
  currentUser,
  teamMembers,
  rooms,
  selectedRoomId,
  onSelectRoom,
  onCreateDirectChat,
  onCreateGroupChat,
  onInviteMembers,
  onSendMessage,
  onLeaveRoom,
  onDeleteRoom,
}: {
  currentUser: User;
  teamMembers: User[];
  rooms: ChatRoomWithDetails[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onCreateDirectChat: (
    targetUserId: string
  ) => { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string };
  onCreateGroupChat: (
    memberIds: string[],
    title?: string
  ) => { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string };
  onInviteMembers: (
    roomId: string,
    inviteeIds: string[]
  ) => { ok: true; room: ChatRoomWithDetails } | { ok: false; error: string };
  onSendMessage: (
    roomId: string,
    body: string
  ) => { ok: true } | { ok: false; error: string };
  onLeaveRoom: (roomId: string) => { ok: true } | { ok: false; error: string };
  onDeleteRoom: (roomId: string) => { ok: true } | { ok: false; error: string };
}) {
  const [roomQuery, setRoomQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(Boolean(selectedRoomId));

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatMemberIds, setNewChatMemberIds] = useState<string[]>([]);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatError, setNewChatError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMemberIds, setInviteMemberIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    'leave' | 'delete' | 'cancelNewChat' | 'cancelInvite' | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevRoomIdRef = useRef<string | null>(null);
  const prevMsgCountRef = useRef<number>(0);
  const { isInvalid, clearFieldInvalid, clearAllInvalid, triggerInvalid } =
    useFormValidationFeedback();

  const userMap = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m])),
    [teamMembers]
  );

  const activeRoom = useMemo(() => {
    if (!selectedRoomId) return rooms[0] ?? null;
    return rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId) {
      setMobileShowDetail(true);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    const roomId = activeRoom?.id ?? null;
    const msgCount = activeRoom?.messages.length ?? 0;
    const isSameRoom = prevRoomIdRef.current === roomId;
    const hasNewMessages = isSameRoom && msgCount > prevMsgCountRef.current;

    messagesEndRef.current?.scrollIntoView({
      behavior: hasNewMessages ? 'smooth' : 'auto',
      block: 'end',
    });

    prevRoomIdRef.current = roomId;
    prevMsgCountRef.current = msgCount;
  }, [activeRoom?.id, activeRoom?.messages.length]);

  const filteredRooms = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => {
      const displayName = getChatRoomDisplayName(room, currentUser.id, userMap).toLowerCase();
      const memberMatch = room.members.some((m) => m.name.toLowerCase().includes(q));
      const lastMsgMatch = (room.lastMessage?.body ?? '').toLowerCase().includes(q);
      return displayName.includes(q) || memberMatch || lastMsgMatch;
    });
  }, [rooms, roomQuery, currentUser.id, userMap]);

  const otherTeammates = useMemo(
    () => teamMembers.filter((m) => m.id !== currentUser.id),
    [teamMembers, currentUser.id]
  );

  const filteredNewChatTeammates = useMemo(() => {
    const q = newChatSearch.trim().toLowerCase();
    if (!q) return otherTeammates;
    return otherTeammates.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.title ?? '').toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [otherTeammates, newChatSearch]);

  const invitableMembers = useMemo(
    () => (activeRoom ? getInvitableMembers(activeRoom, teamMembers) : []),
    [activeRoom, teamMembers]
  );

  const handleOpenRoom = (roomId: string) => {
    setChatError(null);
    clearFieldInvalid('chatMessage');
    onSelectRoom(roomId);
    setMobileShowDetail(true);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    setChatError(null);
    if (!messageText.trim()) {
      setChatError('메시지 내용을 입력해 주세요.');
      triggerInvalid(
        [{ key: 'chatMessage', elementId: 'chat-message-input' }],
        'chat-message-input'
      );
      return;
    }
    const res = onSendMessage(activeRoom.id, messageText);
    if (!res.ok) {
      setChatError(res.error);
      triggerInvalid(
        [{ key: 'chatMessage', elementId: 'chat-message-input' }],
        'chat-message-input'
      );
      return;
    }
    clearFieldInvalid('chatMessage');
    setMessageText('');
  };

  const handleOpenNewChat = () => {
    setNewChatMemberIds([]);
    setNewChatTitle('');
    setNewChatSearch('');
    setNewChatError(null);
    clearAllInvalid();
    setNewChatOpen(true);
  };

  const handleSubmitNewChat = (e: FormEvent) => {
    e.preventDefault();
    setNewChatError(null);
    const check = validateNewChatMembers(newChatMemberIds);
    if (!check.valid) {
      setNewChatError(check.error ?? '대화할 팀원을 선택해 주세요.');
      triggerInvalid(
        [{ key: 'newChatMembers', elementId: 'new-chat-member-list' }],
        'new-chat-search'
      );
      return;
    }

    const res =
      newChatMemberIds.length === 1 && !newChatTitle.trim()
        ? onCreateDirectChat(newChatMemberIds[0])
        : onCreateGroupChat(newChatMemberIds, newChatTitle);

    if (!res.ok) {
      setNewChatError(res.error);
      return;
    }
    clearAllInvalid();
    setNewChatOpen(false);
    setMobileShowDetail(true);
  };

  const handleOpenInvite = () => {
    setInviteMemberIds([]);
    setInviteError(null);
    clearAllInvalid();
    setInviteOpen(true);
  };

  const handleSubmitInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    setInviteError(null);
    if (inviteMemberIds.length === 0) {
      setInviteError('초대할 팀원을 최소 1명 선택해 주세요.');
      triggerInvalid(
        [{ key: 'inviteMembers', elementId: 'invite-member-list' }],
        'invite-member-list'
      );
      return;
    }
    const res = onInviteMembers(activeRoom.id, inviteMemberIds);
    if (!res.ok) {
      setInviteError(res.error);
      return;
    }
    clearAllInvalid();
    setInviteOpen(false);
  };

  const activeDisplayName = activeRoom
    ? getChatRoomDisplayName(activeRoom, currentUser.id, userMap)
    : '';
  const activeDirectPartner =
    activeRoom && activeRoom.kind === 'direct'
      ? activeRoom.members.find((m) => m.id !== currentUser.id)
      : undefined;
  const canLeave = activeRoom ? canLeaveChatRoom(currentUser.id, activeRoom) : false;
  const canDelete = activeRoom ? canDeleteChatRoom(currentUser, activeRoom) : false;

  const handleRequestCloseNewChat = () => {
    if (newChatMemberIds.length > 0 || newChatTitle.trim()) {
      setConfirmAction('cancelNewChat');
      return;
    }
    setNewChatOpen(false);
  };

  const handleRequestCloseInvite = () => {
    if (inviteMemberIds.length > 0) {
      setConfirmAction('cancelInvite');
      return;
    }
    setInviteOpen(false);
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-2 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white glass-text-shadow">
            팀 채팅
          </h1>
          <p className="hidden sm:block mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            팀원과 1:1 또는 그룹 대화를 나누고 필요한 동료를 바로 초대하세요.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewChat}
          className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-bold shadow-md min-h-[38px] sm:min-h-[40px]"
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          새 채팅
        </button>
      </div>

      <div className="glass rounded-[28px] overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-[calc(100dvh-210px)] min-h-[400px] lg:h-[calc(100vh-200px)]">
        {/* Left: Chat Room List */}
        <section
          aria-label="채팅방 목록"
          className={`lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/30 dark:border-white/15 flex flex-col min-h-0 ${
            mobileShowDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-white/25 dark:border-white/12">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={roomQuery}
                onChange={(e) => setRoomQuery(e.target.value)}
                aria-label="채팅방 검색"
                placeholder="대화방 또는 팀원 검색..."
                className="focus-glass w-full rounded-full bg-white/35 dark:bg-white/10 border border-white/40 dark:border-white/15 pl-9 pr-4 py-2 text-xs font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  참여 중인 대화가 없습니다
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  새 채팅 버튼으로 1:1 또는 그룹 대화를 시작해 보세요.
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = activeRoom?.id === room.id;
                const displayName = getChatRoomDisplayName(room, currentUser.id, userMap);
                const directPartner =
                  room.kind === 'direct'
                    ? room.members.find((m) => m.id !== currentUser.id)
                    : undefined;

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleOpenRoom(room.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`focus-glass glass-press w-full text-left flex items-center gap-3 rounded-[20px] p-3 transition-colors border ${
                      isSelected
                        ? 'bg-white/60 dark:bg-white/18 border-white/65 dark:border-white/30 shadow-sm'
                        : 'bg-white/15 dark:bg-white/5 border-transparent hover:bg-white/35 dark:hover:bg-white/10'
                    }`}
                  >
                    {directPartner ? (
                      <UserAvatar user={directPartner} size="md" />
                    ) : (
                      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
                        <Users size={18} aria-hidden="true" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold truncate text-slate-950 dark:text-white">
                          {displayName}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                          {formatRelativeKoreanTime(room.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          {room.lastMessage
                            ? room.lastMessage.body
                            : `${room.members.length}명 참여 중`}
                        </p>
                        {room.unreadCount > 0 && (
                          <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white tabular-nums shrink-0">
                            {room.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Active Chat Conversation */}
        <section
          aria-label="대화 내용"
          className={`lg:col-span-8 flex flex-col min-h-0 ${
            mobileShowDetail ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!activeRoom ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/40 dark:bg-white/10 mb-3">
                <MessageCircle size={26} aria-hidden="true" />
              </div>
              <h2 className="text-base font-extrabold">대화방을 선택해 주세요</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                왼쪽에서 채팅방을 고르거나 새 채팅을 만들어 팀원과 소통할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={handleOpenNewChat}
                className="focus-glass glass-press mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2 text-xs font-bold min-h-[40px]"
              >
                <Plus size={14} aria-hidden="true" />
                새 채팅 시작하기
              </button>
            </div>
          ) : (
            <>
              {/* Active Room Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 border-b border-white/30 dark:border-white/15">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowDetail(false)}
                    aria-label="채팅방 목록으로 돌아가기"
                    className="focus-glass lg:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/35 dark:bg-white/10"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                  </button>

                  {activeDirectPartner ? (
                    <UserAvatar user={activeDirectPartner} size="sm" />
                  ) : (
                    <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                      <Users size={15} aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-extrabold truncate">
                        {activeDisplayName}
                      </h2>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                        {activeRoom.members.length}명
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {activeRoom.members.map((m) => m.name).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenInvite}
                    disabled={invitableMembers.length === 0}
                    title={
                      invitableMembers.length === 0
                        ? '모든 팀원이 이미 참여 중입니다'
                        : '팀원 초대하기'
                    }
                    className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-white/45 dark:bg-white/12 border border-white/50 dark:border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/65 disabled:opacity-45 min-h-[36px]"
                  >
                    <UserPlus size={14} aria-hidden="true" />
                    <span>초대</span>
                  </button>
                  {canLeave && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('leave')}
                      aria-label="채팅방 나가기"
                      title="채팅방 나가기"
                      className="focus-glass glass-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/30 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      <LogOut size={15} aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('delete')}
                      aria-label="채팅방 삭제"
                      title="채팅방 삭제"
                      className="focus-glass glass-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 border border-rose-400/35 text-rose-700 dark:text-rose-200 hover:bg-rose-500/25"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-3">
                {activeRoom.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center py-10">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      첫 메시지를 보내 대화를 시작해 보세요.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {activeRoom.messages.map((msg) => {
                      if (msg.system) {
                        return (
                          <motion.div
                            key={msg.id}
                            layout="position"
                            initial={{ opacity: 0, y: 12, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={IOS_SPRING_IMESSAGE}
                            style={{ transformOrigin: 'bottom center' }}
                            className="flex justify-center py-1"
                          >
                            <span className="rounded-full bg-white/35 dark:bg-white/10 border border-white/40 dark:border-white/15 px-3.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {msg.body}
                            </span>
                          </motion.div>
                        );
                      }

                      const isMine = msg.senderId === currentUser.id;
                      return (
                        <motion.div
                          key={msg.id}
                          layout="position"
                          initial={{ opacity: 0, y: 18, scale: 0.86, x: isMine ? 10 : -10 }}
                          animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={IOS_SPRING_IMESSAGE}
                          style={{ transformOrigin: isMine ? 'bottom right' : 'bottom left' }}
                          className={`flex items-end gap-2 ${
                            isMine ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isMine && (
                            <UserAvatar user={msg.sender} size="xs" />
                          )}

                          <div
                            className={`max-w-[78%] sm:max-w-[68%] space-y-1 ${
                              isMine ? 'items-end flex flex-col' : ''
                            }`}
                          >
                            {!isMine && (
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 px-1">
                                {msg.sender?.name ?? '팀원'}
                              </span>
                            )}
                            <div
                              className={`rounded-[20px] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                                isMine
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm rounded-br-[6px]'
                                  : 'bg-white/55 dark:bg-white/14 border border-white/55 dark:border-white/20 text-slate-950 dark:text-slate-100 rounded-bl-[6px]'
                              }`}
                            >
                              {msg.body}
                            </div>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 px-1 tabular-nums">
                              {formatKoreanDateTime(msg.createdAt)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSend}
                noValidate
                className="border-t border-white/30 dark:border-white/15 px-4 py-3 sm:px-5 space-y-2"
              >
                {chatError && (
                  <p
                    role="alert"
                    className="text-xs font-semibold text-rose-700 dark:text-rose-300 px-1"
                  >
                    {chatError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <label htmlFor="chat-message-input" className="sr-only">
                    채팅 메시지 입력
                  </label>
                  <input
                    id="chat-message-input"
                    type="text"
                    value={messageText}
                    aria-invalid={isInvalid('chatMessage')}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      clearFieldInvalid('chatMessage');
                      if (chatError) setChatError(null);
                    }}
                    placeholder={`${activeDisplayName}에 메시지 보내기...`}
                    className={`focus-glass glass min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 min-h-[44px] ${
                      isInvalid('chatMessage') ? 'input-invalid' : ''
                    }`}
                  />
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.92 }}
                    transition={IOS_SPRING_SNAPPY}
                    aria-label="메시지 전송"
                    className="focus-glass glass-press inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-bold shadow-md shrink-0 min-h-[44px]"
                  >
                    <Send size={15} aria-hidden="true" />
                    전송
                  </motion.button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Portaled New Chat Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {newChatOpen && (
              <motion.div
                key="new-chat-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: IOS_EASE }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-0 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-label="새 채팅 시작"
                onClick={handleRequestCloseNewChat}
              >
                <motion.div
                  key="new-chat-sheet"
                  initial={{ opacity: 0, y: 28, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.97 }}
                  transition={IOS_SPRING_SHEET}
                  className="glass-elevated flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-[28px] sm:rounded-[28px] text-slate-900 dark:text-slate-100 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/30 dark:border-white/15 px-5 py-4">
                    <div>
                      <h2 className="text-base font-extrabold">새 채팅 시작</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        1명 선택 시 1:1 대화, 2명 이상 선택 시 그룹 채팅이 만들어집니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestCloseNewChat}
                      aria-label="새 채팅 창 닫기"
                      className="focus-glass glass-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/30 dark:bg-white/10"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>

                  <form
                    onSubmit={handleSubmitNewChat}
                    noValidate
                    className="flex flex-1 flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {newChatError && (
                        <div
                          role="alert"
                          className="rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-950 dark:text-rose-100"
                        >
                          {newChatError}
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="new-chat-title"
                          className="block text-xs font-bold mb-1.5"
                        >
                          채팅방 이름 (선택 · 그룹 대화 시 표시)
                        </label>
                        <input
                          id="new-chat-title"
                          type="text"
                          value={newChatTitle}
                          onChange={(e) => setNewChatTitle(e.target.value)}
                          placeholder="예: 디자인 리뷰방, 12월 프로모션 TF"
                          className="focus-glass glass w-full rounded-[16px] px-4 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="new-chat-search"
                            className="text-xs font-bold"
                          >
                            대화 상대 선택 <span className="text-rose-600">*</span>
                          </label>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                            {newChatMemberIds.length}명 선택됨
                          </span>
                        </div>

                        <input
                          id="new-chat-search"
                          type="search"
                          value={newChatSearch}
                          onChange={(e) => setNewChatSearch(e.target.value)}
                          placeholder="팀원 이름 또는 직무 검색..."
                          className="focus-glass glass w-full rounded-[16px] px-4 py-2 text-xs mb-2.5"
                        />

                        <div
                          id="new-chat-member-list"
                          className={`space-y-1.5 max-h-60 overflow-y-auto rounded-[18px] p-1 ${
                            isInvalid('newChatMembers') ? 'input-invalid' : ''
                          }`}
                        >
                          {filteredNewChatTeammates.map((member) => {
                            const selected = newChatMemberIds.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  clearFieldInvalid('newChatMembers');
                                  setNewChatError(null);
                                  setNewChatMemberIds((prev) =>
                                    prev.includes(member.id)
                                      ? prev.filter((id) => id !== member.id)
                                      : [...prev, member.id]
                                  );
                                }}
                                className={`focus-glass w-full flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5 text-left border transition-colors ${
                                  selected
                                    ? 'bg-white/65 dark:bg-white/18 border-slate-900/40 dark:border-white/45'
                                    : 'bg-white/25 dark:bg-white/6 border-white/30 dark:border-white/10 hover:bg-white/45'
                                }`}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <UserAvatar user={member} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-bold truncate">
                                      {member.name}
                                    </span>
                                    <span className="block text-xs text-slate-600 dark:text-slate-300 truncate">
                                      {member.title ?? member.email}
                                    </span>
                                  </span>
                                </span>
                                <span
                                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                    selected
                                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'
                                      : 'border-slate-400/60 dark:border-white/30'
                                  }`}
                                >
                                  {selected && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-white/30 dark:border-white/15 px-5 py-3.5">
                      <button
                        type="button"
                        onClick={handleRequestCloseNewChat}
                        className="focus-glass rounded-full bg-white/35 dark:bg-white/10 px-4 py-2 text-xs font-semibold min-h-[40px]"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2 text-xs font-bold shadow-md min-h-[40px]"
                      >
                        {newChatMemberIds.length > 1
                          ? `그룹 채팅 시작 (${newChatMemberIds.length}명)`
                          : newChatMemberIds.length === 1
                            ? '1:1 대화 시작'
                            : '대화 시작'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Portaled Invite Members Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {inviteOpen && activeRoom && (
              <motion.div
                key="invite-chat-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: IOS_EASE }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/24 dark:bg-slate-950/48 backdrop-blur-sm p-0 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-label="채팅방에 팀원 초대"
                onClick={handleRequestCloseInvite}
              >
                <motion.div
                  key="invite-chat-sheet"
                  initial={{ opacity: 0, y: 28, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.97 }}
                  transition={IOS_SPRING_SHEET}
                  className="glass-elevated flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[28px] sm:rounded-[28px] text-slate-900 dark:text-slate-100 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/30 dark:border-white/15 px-5 py-4">
                    <div>
                      <h2 className="text-base font-extrabold">팀원 초대하기</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {activeRoom.kind === 'direct'
                          ? '동료를 초대하면 자동으로 그룹 채팅으로 전환됩니다.'
                          : '현재 대화방에 새 팀원을 추가합니다.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestCloseInvite}
                      aria-label="초대 창 닫기"
                      className="focus-glass glass-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/30 dark:bg-white/10"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>

                  <form
                    onSubmit={handleSubmitInvite}
                    noValidate
                    className="flex flex-1 flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                      {inviteError && (
                        <div
                          role="alert"
                          className="rounded-[16px] border border-rose-400/60 bg-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-950 dark:text-rose-100"
                        >
                          {inviteError}
                        </div>
                      )}

                      <div
                        id="invite-member-list"
                        tabIndex={-1}
                        className={`space-y-1.5 max-h-64 overflow-y-auto rounded-[18px] p-1 ${
                          isInvalid('inviteMembers') ? 'input-invalid' : ''
                        }`}
                      >
                        {invitableMembers.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-600 dark:text-slate-400">
                            모든 팀원이 이미 이 채팅방에 참여하고 있습니다.
                          </p>
                        ) : (
                          invitableMembers.map((member) => {
                            const selected = inviteMemberIds.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  clearFieldInvalid('inviteMembers');
                                  setInviteError(null);
                                  setInviteMemberIds((prev) =>
                                    prev.includes(member.id)
                                      ? prev.filter((id) => id !== member.id)
                                      : [...prev, member.id]
                                  );
                                }}
                                className={`focus-glass w-full flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5 text-left border transition-colors ${
                                  selected
                                    ? 'bg-white/65 dark:bg-white/18 border-slate-900/40 dark:border-white/45'
                                    : 'bg-white/25 dark:bg-white/6 border-white/30 dark:border-white/10 hover:bg-white/45'
                                }`}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <UserAvatar user={member} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-bold truncate">
                                      {member.name}
                                    </span>
                                    <span className="block text-xs text-slate-600 dark:text-slate-300 truncate">
                                      {member.title ?? member.email}
                                    </span>
                                  </span>
                                </span>
                                <span
                                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                    selected
                                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'
                                      : 'border-slate-400/60 dark:border-white/30'
                                  }`}
                                >
                                  {selected && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-white/30 dark:border-white/15 px-5 py-3.5">
                      <button
                        type="button"
                        onClick={handleRequestCloseInvite}
                        className="focus-glass rounded-full bg-white/35 dark:bg-white/10 px-4 py-2 text-xs font-semibold min-h-[40px]"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={invitableMembers.length === 0}
                        className="focus-glass glass-press inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2 text-xs font-bold shadow-md disabled:opacity-45 min-h-[40px]"
                      >
                        <UserPlus size={14} aria-hidden="true" />
                        초대하기 ({inviteMemberIds.length})
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ConfirmDeleteModal
        open={confirmAction !== null}
        variant={confirmAction === 'delete' ? 'danger' : 'neutral'}
        title={
          confirmAction === 'delete'
            ? '채팅방 삭제 확인'
            : confirmAction === 'leave'
              ? '채팅방 나가기'
              : confirmAction === 'cancelNewChat'
                ? '새 채팅 취소'
                : '초대 취소'
        }
        message={
          confirmAction === 'delete'
            ? `"${activeDisplayName}" 채팅방을 삭제하시겠습니까? 모든 대화 내용이 삭제되며 이 작업은 되돌릴 수 없습니다.`
            : confirmAction === 'leave'
              ? `"${activeDisplayName}" 채팅방에서 나가시겠습니까?${
                  activeRoom && activeRoom.members.length <= 1
                    ? ' 마지막 참여자이므로 채팅방도 함께 정리됩니다.'
                    : ''
                }`
              : confirmAction === 'cancelNewChat'
                ? '선택 중인 채팅 설정을 취소하고 나가시겠습니까?'
                : '선택 중인 초대를 취소하고 나가시겠습니까?'
        }
        confirmLabel={
          confirmAction === 'delete'
            ? '삭제'
            : confirmAction === 'leave'
              ? '나가기'
              : '나가기'
        }
        cancelLabel="돌아가기"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          setConfirmAction(null);
          if (action === 'leave' && activeRoom) {
            const res = onLeaveRoom(activeRoom.id);
            if (!res.ok) setChatError(res.error);
            else setMobileShowDetail(false);
            return;
          }
          if (action === 'delete' && activeRoom) {
            const res = onDeleteRoom(activeRoom.id);
            if (!res.ok) setChatError(res.error);
            else setMobileShowDetail(false);
            return;
          }
          if (action === 'cancelNewChat') {
            setNewChatOpen(false);
            return;
          }
          if (action === 'cancelInvite') {
            setInviteOpen(false);
          }
        }}
      />
    </div>
  );
}
