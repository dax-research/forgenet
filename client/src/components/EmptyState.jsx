import { Inbox } from "lucide-react";
import Button from "./Button";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No items found",
  description = "There are no items to display at this moment.",
  actionLabel,
  onAction,
  className = "",
  style = {},
}) {
  return (
    <div className={`empty-state ${className}`} style={style}>
      <div className="empty-state-icon">
        <Icon size={22} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
