import api from "./api";

export const notificationsService = {
  async getNotifications(params = {}) {
    const res = await api.get("/notifications", { params });
    return res.data;
  },

  async getNotification(id) {
    const res = await api.get(`/notifications/${id}`);
    return res.data;
  },

  async getUnreadCount() {
    const res = await api.get("/notifications/unread-count");
    return res.data;
  },

  async markAllAsRead() {
    const res = await api.put("/notifications/read-all");
    return res.data;
  },

  async markAsRead(id) {
    const res = await api.put(`/notifications/${id}`, { read: true });
    return res.data;
  },

  async deleteNotification(id) {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
  },
};
