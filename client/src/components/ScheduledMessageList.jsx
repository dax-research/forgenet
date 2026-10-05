import { Clock, X, Pencil, CalendarClock } from "lucide-react";
import Button from "./Button";

/**
 * The sender's pending scheduled messages for a conversation. Visible only to
 * the person who scheduled them; recipients never see these until delivery.
 */
export default function ScheduledMessageList({
  messages = [],
  onCancel,
  onEdit,
  busyId = "",
}) {
  if (messages.length === 0) return null;

  const formatWhen = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div
      data-testid="scheduled-messages"
      style={{
        margin: "0 16px 12px",
        padding: "10px 12px",
        borderRadius: "var(--radius-btn)",
        border: "1px dashed var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: messages.length > 1 ? "8px" : 0,
        }}
      >
        <CalendarClock size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
          Scheduled · {messages.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {messages.map((msg) => (
          <div
            key={msg._id}
            data-testid="scheduled-message"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: "12.5px",
                  color: "var(--text-primary)",
                  wordBreak: "break-word",
                  opacity: 0.75,
                }}
              >
                {msg.content}
              </p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                <Clock size={11} />
                Sends {formatWhen(msg.scheduledAt)}
              </span>
            </div>

            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(msg)}
                  disabled={busyId === msg._id}
                  title="Edit scheduled message"
                  style={{ color: "var(--text-muted)", padding: "3px" }}
                >
                  <Pencil size={13} />
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(msg)}
                  disabled={busyId === msg._id}
                  title="Cancel scheduled message"
                  style={{ color: "var(--danger)", padding: "3px" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}