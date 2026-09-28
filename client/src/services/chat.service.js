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

  async createMessage(conversationId, content) {
    const res = await api.post(`/conversations/${conversationId}/messages`, { content });
    return res.data;
  },
};
