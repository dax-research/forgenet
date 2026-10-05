import api from "./api";

export const chatService = {
  async getConversations(params = {}) {
    const res = await api.get("/conversations", { params });
    return res.data;
  },

  async getConversation(id) {
    const res = await api.get(`/conversations/${id}`);
    return res.data;
  },

  async createConversation(participantId) {
    const res = await api.post("/conversations", { participantId });
    return res.data;
  },

  async deleteConversation(id) {
    const res = await api.delete(`/conversations/${id}`);
    return res.data;
  },

  async getMessages(conversationId, params = {}) {
    const res = await api.get(`/conversations/${conversationId}/messages`, { params });
    return res.data;
  },

  async getUnreadCount() {
    const res = await api.get("/messages/unread-count");
    return res.data;
  },

  async markConversationRead(conversationId) {
    const res = await api.put(`/messages/conversation/${conversationId}/read`);
    return res.data;
  },

  async createMessage(conversationId, content) {
    const res = await api.post(`/conversations/${conversationId}/messages`, { content });
    return res.data;
  },

  /**
   * Schedules a message for later. `scheduledAt` must be an ISO string in UTC —
   * the caller converts from the user's timezone first.
   */
  async scheduleMessage(conversationId, content, scheduledAt) {
    const res = await api.post("/messages/schedule", { conversationId, content, scheduledAt });
    return res.data;
  },

  async getScheduledMessages(conversationId) {
    const res = await api.get(`/messages/conversation/${conversationId}/scheduled`);
    return res.data;
  },

  async cancelScheduledMessage(messageId) {
    const res = await api.delete(`/messages/${messageId}/schedule`);
    return res.data;
  },

  async updateScheduledMessage(messageId, payload) {
    const res = await api.patch(`/messages/${messageId}/schedule`, payload);
    return res.data;
  },
};
