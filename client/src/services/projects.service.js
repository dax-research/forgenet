import api from "./api";

export const projectsService = {
  async getProjects(params = {}) {
    const res = await api.get("/projects", { params });
    return res.data;
  },

  async getProject(id) {
    const res = await api.get(`/projects/${id}`);
    return res.data;
  },

  async createProject(projectData) {
    const res = await api.post("/projects", projectData);
    return res.data;
  },

  async updateProject(id, projectData) {
    const res = await api.put(`/projects/${id}`, projectData);
    return res.data;
  },

  async deleteProject(id) {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
  },

  async searchProjects(q, params = {}) {
    const res = await api.get("/search/projects", { params: { q, ...params } });
    return res.data;
  },
};
