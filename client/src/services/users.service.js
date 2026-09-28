import api from "./api";

export const usersService = {
  async getUsers(params = {}) {
    const res = await api.get("/users", { params });
    return res.data;
  },

  async getUser(id) {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },

  async updateUser(id, data) {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },

  async searchUsers(q, params = {}) {
    const res = await api.get("/search/users", { params: { q, ...params } });
    return res.data;
  },

  async followUser(id) {
    const res = await api.post(`/users/${id}/follow`);
    return res.data;
  },

  async unfollowUser(id) {
    const res = await api.delete(`/users/${id}/follow`);
    return res.data;
  },

  async getFollowers(id, params = {}) {
    const res = await api.get(`/users/${id}/followers`, { params });
    return res.data;
  },

  async getFollowing(id, params = {}) {
    const res = await api.get(`/users/${id}/following`, { params });
    return res.data;
  },

  async getSavedPosts(id, params = {}) {
    const res = await api.get(`/users/${id}/saved-posts`, { params });
    return res.data;
  },
};
