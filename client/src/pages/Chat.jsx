import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Send, MessageSquare, Search, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { chatService } from "../services/chat.service";
import { socketService } from "../services/socket.service";
import { useBadges } from "../context/BadgeContext";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import ScheduleMessageModal from "../components/ScheduleMessageModal";
import ScheduledMessageList from "../components/ScheduledMessageList";

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();
  const { refreshBadges, setUnreadMessages, messagesBadge } = useBadges();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Scheduled messaging
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [scheduledBusyId, setScheduledBusyId] = useState("");
  const [editingScheduled, setEditingScheduled] = useState(null);
  const [scheduleNotice, setScheduleNotice] = useState("");

  // Real-time presence and typing
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set()); // userIds typing in active conversation

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConversationRef = useRef(null);
  const userIdRef = useRef(null);

  const idsEqual = (a, b) => a != null && b != null && String(a) === String(b);

  activeConversationRef.current = activeConversation;
  userIdRef.current = user?._id;

  // Scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Load conversations
  useEffect(() => {
    let isMounted = true;

    async function fetchConversations() {
      try {
        setLoadingConversations(true);
        const res = await chatService.getConversations();
        if (isMounted && res.success && res.data?.conversations) {
          const convList = res.data.conversations;
          setConversations(convList);

          // If navigated with active conversation in state, select it
          const targetId = location.state?.activeConversationId;
          if (targetId) {
            const found = convList.find((c) => c._id === targetId);
            if (found) {
              setActiveConversation(found);
            } else {
              // Try fetching directly
              const single = await chatService.getConversation(targetId);
              if (single.success && single.data?.conversation) {
                setConversations((prev) => [single.data.conversation, ...prev]);
                setActiveConversation(single.data.conversation);
              }
            }
          } else if (convList.length > 0 && !activeConversation) {
            setActiveConversation(convList[0]);
          }
        }
      } catch (err) {
        console.warn("Load conversations error:", err.message);
      } finally {
        if (isMounted) setLoadingConversations(false);
      }
    }

    fetchConversations();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.activeConversationId]);

  // Handle active conversation selection and room join
  useEffect(() => {
    if (!activeConversation?._id) return;

    let isMounted = true;
    const conversationId = activeConversation._id;

    // Join Socket room
    socketService.joinConversation(conversationId);

    // Opening the conversation marks it read. REST (not socket) so the
    // readAt write is persisted even if the socket drops mid-request.
    const markRead = async () => {
      try {
        const res = await chatService.markConversationRead(conversationId);
        if (!isMounted) return;
        if (typeof res?.data?.unreadCount === "number") {
          setUnreadMessages(res.data.unreadCount);
        }
        setConversations((prev) =>
          prev.map((c) => (idsEqual(c._id, conversationId) ? { ...c, unreadCount: 0 } : c))
        );
      } catch (err) {
        console.warn("Mark conversation read error:", err.message);
      }
    };
    markRead();

    // Fetch messages
    setLoadingMessages(true);
    chatService
      .getMessages(conversationId)
      .then((res) => {
        if (isMounted && res.success && res.data?.messages) {
          setMessages(res.data.messages);
        }
      })
      .catch((err) => console.warn("Fetch messages error:", err.message))
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });

    // Check presence for other participant
    const otherParticipant = activeConversation.participants?.find(
      (p) => !idsEqual(p._id || p, user?._id)
    );
    if (otherParticipant?._id) {
      socketService.getPresence(otherParticipant._id, (res) => {
        if (res?.success && res.data?.online) {
          setOnlineUsers((prev) => new Set([...prev, String(otherParticipant._id)]));
        }
      });
    }

    return () => {
      isMounted = false;
      socketService.leaveConversation(conversationId);
      setTypingUsers(new Set());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?._id, user?._id]);

  // Setup real-time Socket.IO listeners once; read latest chat state from refs
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      if (!newMsg) return;
      const incomingConvId = newMsg.conversation?._id || newMsg.conversation;
      const active = activeConversationRef.current;

      if (active && idsEqual(incomingConvId, active._id)) {
        setMessages((prev) => {
          if (prev.some((m) => idsEqual(m._id, newMsg._id))) return prev;
          return [...prev, newMsg];
        });

        // The user is looking at this thread, so it is read on arrival.
        if (!idsEqual(newMsg.sender?._id || newMsg.sender, userIdRef.current)) {
          chatService
            .markConversationRead(incomingConvId)
            .then((res) => {
              if (typeof res?.data?.unreadCount === "number") {
                setUnreadMessages(res.data.unreadCount);
              }
            })
            .catch((err) => console.warn("Mark read on new message error:", err.message));
        }
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => idsEqual(c._id, incomingConvId));
        if (idx !== -1) {
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          // Unread count only grows when the message is for a thread the user
          // is not currently viewing, and never for their own message.
          const isFromOther = !idsEqual(newMsg.sender?._id || newMsg.sender, userIdRef.current);
          const isActiveThread = active && idsEqual(incomingConvId, active._id);
          moved.unreadCount =
            (moved.unreadCount || 0) + (isFromOther && !isActiveThread ? 1 : 0);
          return [moved, ...updated];
        }
        return prev;
      });

      // A new message from someone else means the total badge is stale.
      if (!idsEqual(newMsg.sender?._id || newMsg.sender, userIdRef.current)) {
        refreshBadges();
      }
    };

    const handleUserTyping = ({ userId, conversationId } = {}) => {
      const active = activeConversationRef.current;
      if (
        active &&
        idsEqual(active._id, conversationId) &&
        !idsEqual(userId, userIdRef.current)
      ) {
        setTypingUsers((prev) => new Set([...prev, String(userId)]));
      }
    };

    const handleUserStoppedTyping = ({ userId, conversationId } = {}) => {
      const active = activeConversationRef.current;
      if (
        active &&
        idsEqual(active._id, conversationId) &&
        !idsEqual(userId, userIdRef.current)
      ) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(String(userId));
          return next;
        });
      }
    };

    const handleUserOnline = ({ userId } = {}) => {
      if (!userId) return;
      setOnlineUsers((prev) => new Set([...prev, String(userId)]));
    };

    const handleUserOffline = ({ userId } = {}) => {
      if (!userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
    };
    // Bind once; handlers read current conversation/user from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the sender's own pending scheduled messages for this conversation.
  const loadScheduled = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      try {
        const res = await chatService.getScheduledMessages(conversationId);
        if (res.success && res.data?.messages) {
          setScheduledMessages(res.data.messages);
        }
      } catch (err) {
        console.warn("Load scheduled messages error:", err.message);
      }
    },
    []
  );

  const handleScheduleSubmit = async (scheduledAtIso) => {
    if (editingScheduled?._id) {
      await chatService.updateScheduledMessage(editingScheduled._id, {
        ...(messageInput.trim() ? { content: messageInput.trim() } : {}),
        scheduledAt: scheduledAtIso,
      });
      setScheduleNotice("Scheduled message updated.");
    } else {
      await chatService.scheduleMessage(activeConversation._id, messageInput.trim(), scheduledAtIso);
      setScheduleNotice("Message scheduled.");
    }

    setMessageInput("");
    setEditingScheduled(null);
    await loadScheduled(activeConversation._id);

    setTimeout(() => setScheduleNotice(""), 4000);
  };

  const handleCancelScheduled = async (msg) => {
    try {
      setScheduledBusyId(msg._id);
      await chatService.cancelScheduledMessage(msg._id);
      setScheduledMessages((prev) => prev.filter((m) => m._id !== msg._id));
      setScheduleNotice("Scheduled message cancelled.");
      setTimeout(() => setScheduleNotice(""), 4000);
    } catch (err) {
      setScheduleNotice(
        err.response?.data?.message || "Could not cancel the scheduled message."
      );
    } finally {
      setScheduledBusyId("");
    }
  };

  const handleEditScheduled = (msg) => {
    setEditingScheduled(msg);
    setMessageInput(msg.content);
    setIsScheduleOpen(true);
  };

  // Reload the pending list when the active conversation changes.
  useEffect(() => {
    if (!activeConversation?._id) {
      setScheduledMessages([]);
      return;
    }
    setScheduledMessages([]);
    loadScheduled(activeConversation._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?._id]);

  // Handle typing input with debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessageInput(val);

    if (!activeConversation) return;

    // Send typing start
    socketService.startTyping(activeConversation._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(activeConversation._id);
    }, 1500);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || !activeConversation?._id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socketService.stopTyping(activeConversation._id);
    }

    setMessageInput("");

    // Send through Socket.IO with fallback to REST
    const convId = activeConversation._id;
    socketService.sendMessage(convId, content, async (ack) => {
      if (ack?.success && ack.data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => idsEqual(m._id, ack.data.message._id))) return prev;
          return [...prev, ack.data.message];
        });
      } else {
        // Fallback to REST
        try {
          const res = await chatService.createMessage(convId, content);
          if (res.success && res.data?.message) {
            setMessages((prev) => [...prev, res.data.message]);
          }
        } catch (err) {
          console.warn("Send message fallback error:", err.message);
        }
      }
    });
  };

  // Get other participant in conversation
  const getOtherParticipant = (conv) => {
    if (!conv?.participants) return null;
    return conv.participants.find((p) => !idsEqual(p._id || p, user?._id)) || conv.participants[0];
  };

  const currentOtherUser = getOtherParticipant(activeConversation);
  const isOtherUserOnline = currentOtherUser?._id && onlineUsers.has(String(currentOtherUser._id));
  const isOtherUserTyping = currentOtherUser?._id && typingUsers.has(String(currentOtherUser._id));

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const other = getOtherParticipant(c);
    return other?.name?.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        height: "calc(100vh - 110px)",
        minHeight: "500px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          backgroundColor: "var(--surface)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Left Pane: Conversation List */}
        <div
          style={{
            width: "300px",
            minWidth: "260px",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--surface)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Messages</h2>
              {messagesBadge && <span className="nav-badge">{messagesBadge}</span>}
            </div>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ paddingLeft: "28px", fontSize: "12px", height: "30px" }}
              />
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingConversations ? (
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <Skeleton width="36px" height="36px" borderRadius="50%" />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="100px" height="13px" style={{ marginBottom: "4px" }} />
                      <Skeleton width="60px" height="10px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                No active conversations yet. Visit a developer's profile to start chatting!
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isActive = activeConversation?._id === conv._id;
                const isOnline = other?._id && onlineUsers.has(String(other._id));

                return (
                  <div
                    key={conv._id}
                    onClick={() => setActiveConversation(conv)}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      padding: "10px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: isActive
                        ? "var(--accent-light)"
                        : conv.unreadCount > 0
                        ? "var(--accent-subtle)"
                        : "transparent",
                      transition: "background-color 0.12s ease",
                    }}
                  >
                    <Avatar
                      src={other?.profileImage}
                      name={other?.name}
                      size={36}
                      online={isOnline}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontWeight: isActive ? 600 : 500,
                            fontSize: "13px",
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {other?.name || "Developer"}
                        </span>

                        {!isActive && conv.unreadCount > 0 && (
                          <span className="nav-badge" style={{ marginLeft: 0, flexShrink: 0 }}>
                            {conv.unreadCount > 10 ? "10+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "11px", color: isOnline ? "var(--success)" : "var(--text-muted)" }}>
                        {isOnline ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Room */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "var(--surface)" }}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Avatar
                    src={currentOtherUser?.profileImage}
                    name={currentOtherUser?.name}
                    size={36}
                    online={isOtherUserOnline}
                  />

                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {currentOtherUser?.name || "Developer"}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          color: isOtherUserTyping
                            ? "var(--accent)"
                            : isOtherUserOnline
                            ? "var(--success)"
                            : "var(--text-muted)",
                          fontWeight: isOtherUserTyping ? 600 : 400,
                        }}
                      >
                        {isOtherUserTyping
                          ? "typing..."
                          : isOtherUserOnline
                          ? "Online"
                          : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  backgroundColor: "var(--bg)",
                }}
              >
                {loadingMessages ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Skeleton width="40%" height="32px" borderRadius="12px" />
                    <Skeleton width="50%" height="32px" borderRadius="12px" style={{ alignSelf: "flex-end" }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                    No messages yet. Say hello to {currentOtherUser?.name}!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const senderId = msg.sender?._id || msg.sender;
                    const isMine = idsEqual(senderId, user?._id);

                    return (
                      <div
                        key={msg._id}
                        style={{
                          display: "flex",
                          justifyContent: isMine ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "70%",
                            padding: "8px 12px",
                            borderRadius: isMine
                              ? "12px 12px 2px 12px"
                              : "12px 12px 12px 2px",
                            backgroundColor: isMine ? "var(--accent)" : "var(--surface)",
                            color: isMine ? "#ffffff" : "var(--text-primary)",
                            border: isMine ? "none" : "1px solid var(--border)",
                            boxShadow: "var(--shadow-sm)",
                            fontSize: "13px",
                            lineHeight: "1.45",
                            wordBreak: "break-word",
                          }}
                        >
                          <p>{msg.content}</p>
                          <div
                            style={{
                              fontSize: "10px",
                              marginTop: "4px",
                              textAlign: "right",
                              color: isMine ? "rgba(255, 255, 255, 0.75)" : "var(--text-muted)",
                            }}
                          >
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Live typing indicator bubble */}
                {isOtherUserTyping && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px 12px 12px 2px",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {currentOtherUser?.name} is typing...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Bar */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={handleInputChange}
                  className="input"
                  style={{ fontSize: "13px", height: "38px", flex: 1, minWidth: 0 }}
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={Clock}
                  disabled={!messageInput.trim()}
                  onClick={() => setIsScheduleOpen(true)}
                  title="Schedule this message for later"
                  style={{ flexShrink: 0 }}
                >
                  Schedule
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!messageInput.trim()}
                  icon={Send}
                  style={{ flexShrink: 0 }}
                >
                  Send
                </Button>
                </div>

              {scheduleNotice && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textAlign: "right",
                  }}
                >
                  {scheduleNotice}
                </p>
              )}
            </form>

            {/* Pending scheduled messages — visible only to the sender */}
            <ScheduledMessageList
              messages={scheduledMessages}
              onCancel={handleCancelScheduled}
              onEdit={handleEditScheduled}
              busyId={scheduledBusyId}
            />

            <ScheduleMessageModal
              isOpen={isScheduleOpen}
              onClose={() => {
                setIsScheduleOpen(false);
                if (editingScheduled) {
                  setEditingScheduled(null);
                  setMessageInput("");
                }
              }}
              onSchedule={handleScheduleSubmit}
              initialDate={editingScheduled?.scheduledAt ?? null}
            />
            </>
          ) : (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)" }}>
              <MessageSquare size={36} style={{ marginBottom: "8px", opacity: 0.5 }} />
              <p style={{ fontSize: "14px", fontWeight: 500 }}>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
