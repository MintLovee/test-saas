/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AppShell, type NavSection } from './components/AppShell';
import { LiquidBackground } from './components/LiquidBackground';
import { NewRequestModal } from './components/NewRequestModal';
import { NotificationsSheet } from './components/NotificationsSheet';
import { RequestDetailModal } from './components/RequestDetailModal';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { ChatPage } from './pages/ChatPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { repository, subscribeRepositorySync, type RegisterPayload } from './repository';
import type {
  ChatRoomWithDetails,
  CreateRequestInput,
  InboxTab,
  Notification,
  RequestStatus,
  RequestType,
  RequestWithDetails,
  Team,
  UpdateRequestInput,
  User,
} from './types/models';
import { pickDefaultInboxTab, type RequestTypeInput } from './utils/requestTypeRules';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    repository.getCurrentUser()
  );
  const [demoAccounts, setDemoAccounts] = useState<User[]>(() =>
    repository.getDemoAccounts()
  );
  const [activeSection, setActiveSection] = useState<NavSection>('inbox');
  const [activeTab, setActiveTab] = useState<InboxTab>(() => {
    const user = repository.getCurrentUser();
    if (!user) return 'received';
    return pickDefaultInboxTab(repository.getRequestCounts(user.id), 'received');
  });
  const [inboxResetKey, setInboxResetKey] = useState(0);

  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [counts, setCounts] = useState<Record<InboxTab, number>>({
    sent: 0,
    received: 0,
    cc: 0,
    all: 0,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoomWithDetails[]>([]);
  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(
    null
  );
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const refreshWorkspace = useCallback(
    (user: User | null, tab: InboxTab, openReqId: string | null) => {
      setDemoAccounts(repository.getDemoAccounts());
      if (!user) {
        setTeam(null);
        setTeamMembers([]);
        setRequestTypes([]);
        setRequests([]);
        setCounts({ sent: 0, received: 0, cc: 0, all: 0 });
        setNotifications([]);
        setChatRooms([]);
        setUnreadChatCount(0);
        setSelectedRequest(null);
        return;
      }

      setTeam(repository.getTeam(user.teamId));
      setTeamMembers(repository.getTeamMembers(user.teamId));
      setRequestTypes(repository.getRequestTypes(user.teamId));
      setRequests(repository.getRequests(user.id, tab));
      setCounts(repository.getRequestCounts(user.id));
      setNotifications(repository.getNotifications(user.id));
      setChatRooms(repository.getChatRooms(user.id));
      setUnreadChatCount(repository.getUnreadChatCount(user.id));

      if (openReqId) {
        setSelectedRequest(repository.getRequestById(openReqId, user.id));
      } else {
        setSelectedRequest(null);
      }
    },
    []
  );

  useEffect(() => {
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
  }, [currentUser, activeTab, selectedRequestId, refreshWorkspace]);

  useEffect(() => {
    return subscribeRepositorySync(() => {
      const syncedUser = repository.getCurrentUser();
      setCurrentUser(syncedUser);
      refreshWorkspace(syncedUser, activeTab, selectedRequestId);
    });
  }, [activeTab, selectedRequestId, refreshWorkspace]);

  const handleSelectSection = (section: NavSection) => {
    const isSameSection = activeSection === section;
    setSelectedRequestId(null);
    setNotificationsOpen(false);
    setNewRequestOpen(false);
    setActiveSection(section);
    if (section === 'inbox' && currentUser) {
      setInboxResetKey((k) => k + 1);
      const userCounts = repository.getRequestCounts(currentUser.id);
      setActiveTab((prev) => pickDefaultInboxTab(userCounts, prev));
    }
    if (typeof window !== 'undefined') {
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.requestAnimationFrame(() => {
        if (!isSameSection || prefersReducedMotion || window.scrollY <= 4) {
          window.scrollTo(0, 0);
          return;
        }
        const startY = window.scrollY;
        const duration = 280;
        const startTime = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          window.scrollTo(0, Math.round(startY * (1 - eased)));
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        };
        window.requestAnimationFrame(step);
      });
    }
  };

  const handleLogin = (email: string, password: string) => {
    const res = repository.login(email, password);
    if (!res.ok) return res;
    setCurrentUser(res.user);
    setActiveSection('inbox');
    setActiveTab(
      pickDefaultInboxTab(repository.getRequestCounts(res.user.id), 'received')
    );
    setInboxResetKey((k) => k + 1);
    return { ok: true as const };
  };

  const handleRegister = (payload: RegisterPayload) => {
    const res = repository.register(payload);
    if (!res.ok) return res;
    setCurrentUser(res.user);
    setActiveSection('inbox');
    setActiveTab('sent');
    setInboxResetKey((k) => k + 1);
    return { ok: true as const };
  };

  const handleDemoLogin = (userId: string) => {
    const res = repository.loginAsUser(userId);
    if (res.ok) {
      setCurrentUser(res.user);
      setActiveSection('inbox');
      setActiveTab(
        pickDefaultInboxTab(repository.getRequestCounts(res.user.id), 'received')
      );
      setInboxResetKey((k) => k + 1);
      setSelectedRequestId(null);
      setSelectedChatRoomId(null);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const res = repository.loginAsUser(userId);
    if (res.ok) {
      setCurrentUser(res.user);
      setSelectedRequestId(null);
      setSelectedChatRoomId(null);
      if (res.user.role !== 'admin' && activeSection === 'admin') {
        setActiveSection('inbox');
      }
      const nextCounts = repository.getRequestCounts(res.user.id);
      setActiveTab((prev) => {
        const preferred =
          res.user.role !== 'admin' && prev === 'all' ? 'received' : prev;
        return pickDefaultInboxTab(nextCounts, preferred);
      });
      setInboxResetKey((k) => k + 1);
    }
  };

  const handleLogout = () => {
    repository.logout();
    setCurrentUser(null);
    setSelectedRequestId(null);
    setSelectedChatRoomId(null);
    setNewRequestOpen(false);
    setNotificationsOpen(false);
  };

  const handleCreateRequest = (input: CreateRequestInput) => {
    const res = repository.createRequest(input);
    if (!res.ok) return { ok: false as const, error: res.error };
    setActiveSection('inbox');
    setActiveTab('sent');
    refreshWorkspace(currentUser, 'sent', null);
    return { ok: true as const };
  };

  const handleUpdateStatus = (
    requestId: string,
    toStatus: RequestStatus,
    rejectReason?: string
  ) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.updateStatus(
      requestId,
      currentUser.id,
      toStatus,
      rejectReason
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, requestId);
    return { ok: true as const };
  };

  const handleUpdateRequest = (requestId: string, input: UpdateRequestInput) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.updateRequest(requestId, currentUser.id, input);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, requestId);
    return { ok: true as const };
  };

  const handleDeleteRequest = (requestId: string) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.deleteRequest(requestId, currentUser.id);
    if (!res.ok) return { ok: false as const, error: res.error };
    setSelectedRequestId(null);
    refreshWorkspace(currentUser, activeTab, null);
    return { ok: true as const };
  };

  const handleAddComment = (requestId: string, body: string) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.addComment(requestId, currentUser.id, body);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, requestId);
    return { ok: true as const };
  };

  const handleCreateRequestType = (input: RequestTypeInput) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.createRequestType(currentUser.id, input);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return { ok: true as const };
  };

  const handleUpdateRequestType = (typeId: string, input: RequestTypeInput) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.updateRequestType(currentUser.id, typeId, input);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return { ok: true as const };
  };

  const handleDeleteRequestType = (typeId: string) => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.deleteRequestType(currentUser.id, typeId);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return { ok: true as const };
  };

  const handleRegenerateInviteCode = () => {
    if (!currentUser) return { ok: false as const, error: '로그인이 필요합니다.' };
    const res = repository.regenerateInviteCode(currentUser.id);
    if (!res.ok) return res;
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleSelectNotification = (noti: Notification) => {
    repository.markNotificationRead(noti.id);
    setNotificationsOpen(false);
    if (noti.chatRoomId) {
      setSelectedRequestId(null);
      setActiveSection('chat');
      setSelectedChatRoomId(noti.chatRoomId);
      if (currentUser) {
        repository.markChatRoomRead(noti.chatRoomId, currentUser.id);
      }
      refreshWorkspace(currentUser, activeTab, null);
      return;
    }
    if (noti.requestId) {
      setActiveSection('inbox');
      setSelectedRequestId(noti.requestId);
      refreshWorkspace(currentUser, activeTab, noti.requestId);
      return;
    }
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    repository.markAllNotificationsRead(currentUser.id);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
  };

  const handleDeleteNotification = (notificationId: string) => {
    repository.deleteNotification(notificationId);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
  };

  const handleDeleteAllNotifications = () => {
    if (!currentUser) return;
    repository.deleteAllNotifications(currentUser.id);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
  };

  const handleSelectChatRoom = (roomId: string | null) => {
    setSelectedChatRoomId(roomId);
    if (roomId && currentUser) {
      repository.markChatRoomRead(roomId, currentUser.id);
      refreshWorkspace(currentUser, activeTab, selectedRequestId);
    }
  };

  const handleCreateDirectChat = (targetUserId: string) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.createOrGetDirectChat(currentUser.id, targetUserId);
    if (!res.ok) return res;
    setSelectedChatRoomId(res.room.id);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleCreateGroupChat = (memberIds: string[], title?: string) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.createGroupChat(currentUser.id, memberIds, title);
    if (!res.ok) return res;
    setSelectedChatRoomId(res.room.id);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleInviteChatMembers = (roomId: string, inviteeIds: string[]) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.inviteToChatRoom(roomId, currentUser.id, inviteeIds);
    if (!res.ok) return res;
    setSelectedChatRoomId(res.room.id);
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleSendChatMessage = (roomId: string, body: string) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.sendChatMessage(roomId, currentUser.id, body);
    if (!res.ok) return { ok: false as const, error: res.error };
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return { ok: true as const };
  };

  const handleLeaveChatRoom = (roomId: string) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.leaveChatRoom(roomId, currentUser.id);
    if (!res.ok) return res;
    if (selectedChatRoomId === roomId) {
      setSelectedChatRoomId(null);
    }
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleDeleteChatRoom = (roomId: string) => {
    if (!currentUser) {
      return { ok: false as const, error: '로그인이 필요합니다.' };
    }
    const res = repository.deleteChatRoom(roomId, currentUser.id);
    if (!res.ok) return res;
    if (selectedChatRoomId === roomId) {
      setSelectedChatRoomId(null);
    }
    refreshWorkspace(currentUser, activeTab, selectedRequestId);
    return res;
  };

  const handleStartParticipantChat = (memberIds: string[], roomTitle?: string) => {
    if (!currentUser || memberIds.length === 0) return;
    const res =
      memberIds.length === 1
        ? repository.createOrGetDirectChat(currentUser.id, memberIds[0])
        : repository.createGroupChat(currentUser.id, memberIds, roomTitle);
    if (res.ok) {
      setSelectedRequestId(null);
      setActiveSection('chat');
      setSelectedChatRoomId(res.room.id);
      refreshWorkspace(currentUser, activeTab, null);
    }
  };

  const unreadNotificationCount = notifications.filter((n) => !n.readAt).length;

  return (
    <MotionConfig reducedMotion="user">
      <LiquidBackground>
        {!currentUser ? (
          <LoginPage
            demoAccounts={demoAccounts}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onDemoLogin={handleDemoLogin}
          />
        ) : (
          <AppShell
            currentUser={currentUser}
            team={team}
            teamMembers={teamMembers}
            activeSection={activeSection}
            unreadNotificationCount={unreadNotificationCount}
            unreadChatCount={unreadChatCount}
            onSelectSection={handleSelectSection}
            onOpenNewRequest={() => setNewRequestOpen(true)}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onSwitchUser={handleSwitchUser}
            onLogout={handleLogout}
          >
            {activeSection === 'admin' && currentUser.role === 'admin' ? (
              <div key="section-admin" className="ios-section-enter">
                <AdminSettingsPage
                  team={team}
                  requestTypes={requestTypes}
                  teamMembers={teamMembers}
                  onCreateRequestType={handleCreateRequestType}
                  onUpdateRequestType={handleUpdateRequestType}
                  onDeleteRequestType={handleDeleteRequestType}
                  onRegenerateInviteCode={handleRegenerateInviteCode}
                />
              </div>
            ) : activeSection === 'chat' ? (
              <div key="section-chat" className="ios-section-enter">
                <ChatPage
                  currentUser={currentUser}
                  teamMembers={teamMembers}
                  rooms={chatRooms}
                  selectedRoomId={selectedChatRoomId}
                  onSelectRoom={handleSelectChatRoom}
                  onCreateDirectChat={handleCreateDirectChat}
                  onCreateGroupChat={handleCreateGroupChat}
                  onInviteMembers={handleInviteChatMembers}
                  onSendMessage={handleSendChatMessage}
                  onLeaveRoom={handleLeaveChatRoom}
                  onDeleteRoom={handleDeleteChatRoom}
                />
              </div>
            ) : (
              <div key="section-inbox" className="ios-section-enter">
                <InboxPage
                  currentUser={currentUser}
                  activeTab={activeTab}
                  counts={counts}
                  requests={requests}
                  requestTypes={requestTypes}
                  resetKey={inboxResetKey}
                  onChangeTab={setActiveTab}
                  onSelectRequest={(id) => setSelectedRequestId(id)}
                  onOpenNewRequest={() => setNewRequestOpen(true)}
                />
              </div>
            )}

            <NewRequestModal
              open={newRequestOpen}
              currentUser={currentUser}
              requestTypes={requestTypes}
              teamMembers={teamMembers}
              onClose={() => setNewRequestOpen(false)}
              onSubmit={handleCreateRequest}
            />

            <RequestDetailModal
              request={selectedRequest}
              currentUser={currentUser}
              onClose={() => setSelectedRequestId(null)}
              onUpdateStatus={handleUpdateStatus}
              onUpdateRequest={handleUpdateRequest}
              onDeleteRequest={handleDeleteRequest}
              onAddComment={handleAddComment}
              onStartParticipantChat={handleStartParticipantChat}
            />

            <NotificationsSheet
              open={notificationsOpen}
              notifications={notifications}
              onClose={() => setNotificationsOpen(false)}
              onSelectNotification={handleSelectNotification}
              onMarkAllRead={handleMarkAllRead}
              onDeleteNotification={handleDeleteNotification}
              onDeleteAllNotifications={handleDeleteAllNotifications}
            />
          </AppShell>
        )}
      </LiquidBackground>
    </MotionConfig>
  );
}
