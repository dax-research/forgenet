import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { notificationsService } from "../services/notifications.service";
import { chatService } from "../services/chat.service";
import { socketService } from "../services/socket.service";
import { useAuth } from "./AuthContext";

const BadgeContext = createContext(null);

export const formatBadge = (count) => {
  if (!count || count <= 0) return null;
  return count > 10 ? "10+" : String(count);
};

/**
 * Holds the unread badge counts for messages and notifications.
 *
 * MongoDB is the source of truth: counts are fetched from the API on load and
 * whenever a socket event says they may have changed. The socket only pushes
 * new values, so a refresh always reconciles against the database.
 */
export function BadgeProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }

    const [messages, notifications] = await Promise.allSettled([
      chatService.getUnreadCount(),
      notificationsService.getUnreadCount(),
    ]);

    if (!isMountedRef.current) return;

    if (messages.status === "fulfilled") {
      setUnreadMessages(messages.value?.data?.unreadCount ?? 0);
    }
    if (notifications.status === "fulfilled") {
      setUnreadNotifications(notifications.value?.data?.unreadCount ?? 0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, user?._id]);

  // Real-time updates.
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    const handleUnreadCount = ({ unreadCount } = {}) => {
      if (typeof unreadCount === "number") setUnreadMessages(unreadCount);
    };

    const handleNewNotification = () => {
      // The payload carries the unread flag; a refetch keeps counts exact.
      refresh();
    };

    const handleReadAll = ({ unreadCount } = {}) => {
      if (typeof unreadCount === "number") setUnreadNotifications(unreadCount);
    };

    socket.on("messages:unread_count", handleUnreadCount);
    socket.on("notification:new", handleNewNotification);
    socket.on("notification:read_all", handleReadAll);

    return () => {
      socket.off("messages:unread_count", handleUnreadCount);
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:read_all", handleReadAll);
    };
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({
      unreadMessages,
      unreadNotifications,
      messagesBadge: formatBadge(unreadMessages),
      notificationsBadge: formatBadge(unreadNotifications),
      refreshBadges: refresh,
      setUnreadMessages,
      setUnreadNotifications,
    }),
    [unreadMessages, unreadNotifications, refresh]
  );

  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

export function useBadges() {
  const context = useContext(BadgeContext);
  if (!context) {
    throw new Error("useBadges must be used within a BadgeProvider");
  }
  return context;
}
