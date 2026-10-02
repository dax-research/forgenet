import api from "./api";

export const postsService = {
  async getPosts(params = {}) {
    const res = await api.get("/posts", { params });
    return res.data;
  },

  async getPost(id) {
    const res = await api.get(`/posts/${id}`);
    return res.data;
  },

  async createPost(postData) {
    const isFormData = typeof FormData !== "undefined" && postData instanceof FormData;
    const config = isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    const res = await api.post("/posts", postData, config);
    return res.data;
  },

  async updatePost(id, postData) {
    const res = await api.put(`/posts/${id}`, postData);
    return res.data;
  },

  async deletePost(id) {
    const res = await api.delete(`/posts/${id}`);
    return res.data;
  },

  async savePost(id) {
    const res = await api.post(`/posts/${id}/save`);
    return res.data;
  },

  async unsavePost(id) {
    const res = await api.delete(`/posts/${id}/save`);
    return res.data;
  },

  async searchPosts(q, params = {}) {
    const res = await api.get("/search/posts", { params: { q, ...params } });
    return res.data;
  },

  async getComments(postId, params = {}) {
    const res = await api.get(`/comments/post/${postId}`, { params });
    return res.data;
  },

  async createComment(postId, commentData) {
    const res = await api.post(`/comments/post/${postId}`, commentData);
    return res.data;
  },

  async deleteComment(commentId) {
    const res = await api.delete(`/comments/${commentId}`);
    return res.data;
  },
};
