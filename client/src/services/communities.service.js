import api from "./api";

export const communitiesService = {
  async getCommunities(params = {}) {
    const res = await api.get("/communities", { params });
    return res.data;
  },

  async getCommunity(id) {
    const res = await api.get(`/communities/${id}`);
    return res.data;
  },

  async createCommunity(data) {
    const res = await api.post("/communities", data);
    return res.data;
  },

  async updateCommunity(id, data) {
    const res = await api.put(`/communities/${id}`, data);
    return res.data;
  },

  async deleteCommunity(id) {
    const res = await api.delete(`/communities/${id}`);
    return res.data;
  },

  async joinCommunity(id) {
    const res = await api.post(`/communities/${id}/join`);
    return res.data;
  },
  // (joinCommunity already returns the full envelope, whose .data.membership
  // carries the new state — see CommunityCard below.)

  async leaveCommunity(id) {
    const res = await api.post(`/communities/${id}/leave`);
    return res.data;
  },

  async requestToJoin(id, message) {
    const res = await api.post(`/communities/${id}/join`, { message });
    return res.data;
  },

  async getJoinRequests(id) {
    const res = await api.get(`/communities/${id}/join-requests`);
    return res.data;
  },

  async respondToJoinRequest(id, requestId, decision) {
    const res = await api.patch(`/communities/${id}/join-requests/${requestId}`, { decision });
    return res.data;
  },

  async cancelJoinRequest(id, requestId) {
    const res = await api.delete(`/communities/${id}/join-requests/${requestId}`);
    return res.data;
  },

  async getMembers(id, params = {}) {
    const res = await api.get(`/communities/${id}/members`, { params });
    return res.data;
  },

  async getCommunityPosts(id, params = {}) {
    const res = await api.get(`/communities/${id}/posts`, { params });
    return res.data;
  },

  async createCommunityPost(id, postData) {
    const res = await api.post(`/communities/${id}/posts`, postData);
    return res.data;
  },

  async searchCommunities(q, params = {}) {
    const res = await api.get("/search/communities", { params: { q, ...params } });
    return res.data;
  },
};
