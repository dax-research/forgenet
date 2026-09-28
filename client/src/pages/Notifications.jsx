import { useState, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { notificationsService } from "../services/notifications.service";
import NotificationItem from "../components/NotificationItem";
import Tabs from "../components/Tabs";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Card from "../components/Card";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsService.getNotifications({ limit: 50 });
      if (res.success && res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.warn("Load notifications error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await notificationsService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("Mark read error:", err.message);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadList = notifications.filter((n) => !n.read);
    try {
      await Promise.all(
        unreadList.map((n) => notificationsService.markAsRead(n._id))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn("Mark all read error:", err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.warn("Delete notification error:", err.message);
    }
  };

  const tabs = [
    { id: "all", label: "All Notifications" },
    {
      id: "unread",
      label: "Unread",
      count: notifications.filter((n) => !n.read).length || undefined,
    },
  ];

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read;
    return true;
  });

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Notifications
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Stay updated with your developer network and project interactions
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id)}
      />

      {/* Notification List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={{ padding: "14px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <Skeleton width="36px" height="36px" borderRadius="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="70%" height="14px" style={{ marginBottom: "6px" }} />
                  <Skeleton width="30%" height="11px" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All caught up!"
          description={
            activeTab === "unread"
              ? "You have no unread notifications."
              : "No notifications to show at this time."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredNotifications.map((notif) => (
            <NotificationItem
              key={notif._id}
              notification={notif}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
