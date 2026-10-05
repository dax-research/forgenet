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
import SafeImage from "../components/SafeImage";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";

const emptyForm = () => ({
  title: "",
  description: "",
  technologies: "",
  githubUrl: "",
  liveUrl: "",
  imageUrl: "",
  status: "in-progress",
});

/** Normalises an http(s) URL, returning undefined when unusable. */
const normaliseImageUrl = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
};

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editData, setEditData] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState(emptyForm());

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
        images: normaliseImageUrl(formData.imageUrl) ? [normaliseImageUrl(formData.imageUrl)] : [],
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
        setFormData(emptyForm());
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (project) => {
    setEditingProject(project);
    setEditData({
      title: project?.title || "",
      description: project?.description || "",
      technologies: Array.isArray(project?.technologies) ? project.technologies.join(", ") : "",
      githubUrl: project?.githubUrl || "",
      liveUrl: project?.liveUrl || "",
      imageUrl: project?.images?.[0] || "",
      status: project?.status || "in-progress",
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProject?._id) return;
    if (!editData.title.trim() || !editData.description.trim()) {
      setEditError("Title and description are required.");
      return;
    }

    try {
      setEditing(true);
      setEditError("");
      const res = await projectsService.updateProject(editingProject._id, {
        title: editData.title.trim(),
        description: editData.description.trim(),
        technologies: editData.technologies
          ? editData.technologies.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        githubUrl: editData.githubUrl.trim(),
        liveUrl: editData.liveUrl.trim(),
        images: normaliseImageUrl(editData.imageUrl) ? [normaliseImageUrl(editData.imageUrl)] : [],
        status: editData.status,
      });
      if (res.success && res.data?.project) {
        setProjects((prev) =>
          prev.map((p) => (p._id === editingProject._id ? { ...p, ...res.data.project } : p))
        );
        setIsEditModalOpen(false);
      }
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Could not save the project.");
    } finally {
      setEditing(false);
    }
  };

  const handleOpenDelete = (project) => {
    setDeleteTarget(project);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await projectsService.deleteProject(deleteTarget._id);
      setProjects((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err.response?.data?.message || err.message || "Could not delete the project."
      );
    } finally {
      setDeleting(false);
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
              onDelete={handleOpenDelete}
            onEdit={handleOpenEdit}
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
            <label className="form-label">Cover Image URL</label>
            <input
              type="url"
              className="input"
              value={formData.imageUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://.../cover.png"
            />
            <span className="form-helper">Paste a direct link to an image.</span>
            {formData.imageUrl && (
              <div
                style={{
                  marginTop: "8px",
                  height: "110px",
                  borderRadius: "var(--radius-btn)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-secondary)",
                }}
              >
                <SafeImage
                  src={formData.imageUrl}
                  alt="Cover preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>

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

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !editing && setIsEditModalOpen(false)}
        title="Edit Project"
        maxWidth="520px"
      >
        <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {editError && (
            <p style={{ color: "var(--danger)", fontSize: "12px" }}>{editError}</p>
          )}

          <Input
            label="Project Title"
            name="edit-title"
            value={editData.title}
            onChange={(e) => setEditData((prev) => ({ ...prev, title: e.target.value }))}
            required
            disabled={editing}
          />

          <Input
            label="Description"
            name="edit-description"
            type="textarea"
            rows={3}
            value={editData.description}
            onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
            required
            disabled={editing}
          />

          <Input
            label="Technologies (comma separated)"
            name="edit-technologies"
            value={editData.technologies}
            onChange={(e) => setEditData((prev) => ({ ...prev, technologies: e.target.value }))}
            placeholder="React, TypeScript, Node.js"
            disabled={editing}
          />

          <Input
            label="GitHub Repository URL"
            name="edit-githubUrl"
            type="url"
            value={editData.githubUrl}
            onChange={(e) => setEditData((prev) => ({ ...prev, githubUrl: e.target.value }))}
            placeholder="https://github.com/username/project"
            disabled={editing}
          />

          <Input
            label="Live Demo URL"
            name="edit-liveUrl"
            type="url"
            value={editData.liveUrl}
            onChange={(e) => setEditData((prev) => ({ ...prev, liveUrl: e.target.value }))}
            placeholder="https://myproject.dev"
            disabled={editing}
          />

          <div className="form-group">
            <label className="form-label">Cover Image URL</label>
            <input
              type="url"
              className="input"
              value={editData.imageUrl}
              onChange={(e) => setEditData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://.../cover.png"
              disabled={editing}
            />
            <span className="form-helper">Leave empty to remove the cover image.</span>
            {editData.imageUrl && (
              <div
                style={{
                  marginTop: "8px",
                  height: "110px",
                  borderRadius: "var(--radius-btn)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-secondary)",
                }}
              >
                <SafeImage
                  src={editData.imageUrl}
                  alt="Cover preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Development Status</label>
            <select
              value={editData.status}
              onChange={(e) => setEditData((prev) => ({ ...prev, status: e.target.value }))}
              className="select"
              disabled={editing}
            >
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="planned">Planned</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={editing}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editing}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Project"
        maxWidth="420px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {deleteError && (
            <p style={{ color: "var(--danger)", fontSize: "12px" }}>{deleteError}</p>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              padding: "12px",
              borderRadius: "var(--radius-btn)",
              backgroundColor: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              fontSize: "13px",
              lineHeight: "1.5",
            }}
          >
            <AlertCircle size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: "1px" }} />
            <span>
              This permanently deletes <strong>{deleteTarget?.title}</strong>. This cannot be undone.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} loading={deleting} onClick={handleConfirmDelete}>
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
