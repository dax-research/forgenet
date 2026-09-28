import { useState, useEffect } from "react";
import { Plus, FolderGit2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { projectsService } from "../services/projects.service";
import ProjectCard from "../components/ProjectCard";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import Tabs from "../components/Tabs";
import SearchInput from "../components/SearchInput";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Card from "../components/Card";

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    technologies: "",
    githubUrl: "",
    liveUrl: "",
    status: "in-progress",
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await projectsService.getProjects({ limit: 50 });
      if (res.success && res.data?.projects) {
        setProjects(res.data.projects);
      }
    } catch (err) {
      console.warn("Failed to load projects:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError("Title and description are required.");
      return;
    }

    try {
      setCreating(true);
      setFormError("");

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        technologies: formData.technologies
          ? formData.technologies.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        githubUrl: formData.githubUrl.trim() || undefined,
        liveUrl: formData.liveUrl.trim() || undefined,
        status: formData.status,
      };

      const res = await projectsService.createProject(payload);
      if (res.success && res.data?.project) {
        const created = {
          ...res.data.project,
          owner: { _id: user._id, name: user.name, profileImage: user.profileImage },
        };
        setProjects((prev) => [created, ...prev]);
        setIsModalOpen(false);
        setFormData({
          title: "",
          description: "",
          technologies: "",
          githubUrl: "",
          liveUrl: "",
          status: "in-progress",
        });
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await projectsService.deleteProject(id);
        setProjects((prev) => prev.filter((p) => p._id !== id));
      } catch (err) {
        console.warn("Delete project error:", err.message);
      }
    }
  };

  const statusTabs = [
    { id: "all", label: "All Projects" },
    { id: "in-progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
    { id: "planned", label: "Planned" },
  ];

  const filteredProjects = projects.filter((p) => {
    const matchesStatus =
      activeStatus === "all" || p.status === activeStatus;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      p.title?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.technologies?.some((t) => t.toLowerCase().includes(query));

    return matchesStatus && matchesQuery;
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
            Explore Projects
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Discover open source repositories, tools, and developer showcases
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsModalOpen(true)}
        >
          New Project
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "320px" }}>
          <SearchInput
            placeholder="Filter projects by title, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs
          tabs={statusTabs}
          activeTab={activeStatus}
          onChange={(id) => setActiveStatus(id)}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} style={{ padding: "16px" }}>
              <Skeleton width="60%" height="18px" style={{ marginBottom: "10px" }} />
              <Skeleton width="100%" height="14px" style={{ marginBottom: "6px" }} />
              <Skeleton width="80%" height="14px" style={{ marginBottom: "16px" }} />
              <Skeleton width="40%" height="14px" />
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects found"
          description={
            searchQuery
              ? `No projects matching "${searchQuery}". Try different keywords.`
              : "No projects have been posted yet. Create your first project showcase!"
          }
          actionLabel="Add Project"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredProjects.map((proj) => (
            <ProjectCard
              key={proj._id}
              project={proj}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Showcase a Project"
        maxWidth="540px"
      >
        <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {formError && (
            <p style={{ color: "var(--danger)", fontSize: "12px" }}>{formError}</p>
          )}

          <Input
            label="Project title"
            name="title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. ForgeNet AI Pipeline"
            required
          />

          <Input
            label="Description"
            name="description"
            type="textarea"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief overview of what the project does, problems it solves, architecture..."
            required
          />

          <Input
            label="Technologies & Languages (comma separated)"
            name="technologies"
            value={formData.technologies}
            onChange={(e) => setFormData((prev) => ({ ...prev, technologies: e.target.value }))}
            placeholder="React, TypeScript, Node.js, PyTorch"
          />

          <Input
            label="GitHub Repository URL"
            name="githubUrl"
            type="url"
            value={formData.githubUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, githubUrl: e.target.value }))}
            placeholder="https://github.com/username/project"
          />

          <Input
            label="Live Demo URL (optional)"
            name="liveUrl"
            type="url"
            value={formData.liveUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, liveUrl: e.target.value }))}
            placeholder="https://myproject.dev"
          />

          <div className="form-group">
            <label className="form-label">Development Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              className="select"
            >
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="planned">Planned</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creating}
            >
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
