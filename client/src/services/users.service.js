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

  /**
   * Updates the signed-in user's profile, optionally with a new photo.
   * Passing a File switches the request to multipart/form-data.
   */
  async updateMyProfile(data, avatarFile) {
    if (avatarFile instanceof File) {
      const form = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        form.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
      });
      form.append("avatar", avatarFile);
      const res = await api.patch("/users/me", form);
      return res.data;
    }
    const res = await api.patch("/users/me", data);
    return res.data;
  },

  async removeAvatar() {
    const res = await api.delete("/users/me/avatar");
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

  async getUserActivity(id) {
    const res = await api.get(`/users/${id}/activity`);
    return res.data;
  },
};
