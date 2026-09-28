import {
  Heart,
  MessageSquare,
  UserPlus,
  Users2,
  Bell,
  Trash2,
  Check,
} from "lucide-react";
import Avatar from "./Avatar";

export default function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}) {
  const getIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart size={14} style={{ color: "var(--danger)" }} />;
      case "comment":
        return <MessageSquare size={14} style={{ color: "var(--accent)" }} />;
      case "follow":
        return <UserPlus size={14} style={{ color: "var(--success)" }} />;
      case "community":
        return <Users2 size={14} style={{ color: "var(--warning)" }} />;
      case "message":
        return <MessageSquare size={14} style={{ color: "var(--accent)" }} />;
      default:
        return <Bell size={14} style={{ color: "var(--text-muted)" }} />;
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const sender = notification.sender || {};

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 14px",
        backgroundColor: notification.read ? "var(--surface)" : "var(--accent-subtle)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        transition: "background-color 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          <Avatar src={sender.profileImage} name={sender.name || "User"} size={36} />
          <div
            style={{
              position: "absolute",
              bottom: "-2px",
              right: "-2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {getIcon(notification.type)}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.4" }}>
            {notification.message || "You have a new notification."}
          </p>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {formatTimestamp(notification.createdAt)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {!notification.read && onMarkRead && (
          <button
            type="button"
            onClick={() => onMarkRead(notification._id)}
            style={{
              color: "var(--accent)",
              padding: "4px",
              borderRadius: "var(--radius-btn)",
              display: "flex",
            }}
            title="Mark as read"
          >
            <Check size={15} />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(notification._id)}
            style={{
              color: "var(--text-muted)",
              padding: "4px",
              borderRadius: "var(--radius-btn)",
              display: "flex",
            }}
            title="Delete notification"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
