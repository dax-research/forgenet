import api from "./api";

export const authService = {
  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
  },

  async register(userData) {
    const res = await api.post("/auth/register", userData);
    return res.data;
  },

  async getMe() {
    const res = await api.get("/auth/me");
    return res.data;
  },

  async logout() {
    try {
      await api.delete("/auth/logout");
    } catch {
      // Ignored if token invalid
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  },

  async updatePassword(currentPassword, newPassword) {
    const res = await api.put("/auth/password", { currentPassword, newPassword });
    return res.data;
  },
};
