import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Send, MessageSquare, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { chatService } from "../services/chat.service";
import { socketService } from "../services/socket.service";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Real-time presence and typing
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set()); // userIds typing in active conversation

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
      (p) => (p._id || p) !== user?._id
    );
    if (otherParticipant?._id) {
      socketService.getPresence(otherParticipant._id, (res) => {
        if (res?.success && res.data?.online) {
          setOnlineUsers((prev) => new Set([...prev, otherParticipant._id]));
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

  // Setup real-time Socket.IO listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Incoming new message
    const handleNewMessage = (newMsg) => {
      if (!newMsg) return;
      if (
        activeConversation &&
        (newMsg.conversation === activeConversation._id ||
          newMsg.conversation?._id === activeConversation._id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }

      // Also update conversations list order
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === (newMsg.conversation?._id || newMsg.conversation));
        if (idx !== -1) {
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          return [moved, ...updated];
        }
        return prev;
      });
    };

    // Typing start
    const handleUserTyping = ({ userId, conversationId }) => {
      if (
        activeConversation &&
        activeConversation._id === conversationId &&
        userId !== user?._id
      ) {
        setTypingUsers((prev) => new Set([...prev, userId]));
      }
    };

    // Typing stop
    const handleUserStoppedTyping = ({ userId, conversationId }) => {
      if (
        activeConversation &&
        activeConversation._id === conversationId &&
        userId !== user?._id
      ) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    // Presence online
    const handleUserOnline = ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    };

    // Presence offline
    const handleUserOffline = ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
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
  }, [activeConversation, user?._id]);

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
          if (prev.some((m) => m._id === ack.data.message._id)) return prev;
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
    return conv.participants.find((p) => (p._id || p) !== user?._id) || conv.participants[0];
  };

  const currentOtherUser = getOtherParticipant(activeConversation);
  const isOtherUserOnline = currentOtherUser?._id && onlineUsers.has(currentOtherUser._id);
  const isOtherUserTyping = currentOtherUser?._id && typingUsers.has(currentOtherUser._id);

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
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Messages</h2>
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
                const isOnline = other?._id && onlineUsers.has(other._id);

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
                      backgroundColor: isActive ? "var(--accent-light)" : "transparent",
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    const isMine = senderId === user?._id;

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
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={handleInputChange}
                  className="input"
                  style={{ fontSize: "13px", height: "38px" }}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!messageInput.trim()}
                  icon={Send}
                >
                  Send
                </Button>
              </form>
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
