import { Link } from "react-router-dom";
import {
  FolderGit2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import GithubIcon from "./GithubIcon";
import { useAuth } from "../context/AuthContext";
import Card from "./Card";
import Badge from "./Badge";
import Avatar from "./Avatar";
import SafeImage from "./SafeImage";

export default function ProjectCard({
  project,
  onDelete,
}) {
  const { user } = useAuth();
  const owner = project?.owner || {};
  const isOwner = user?._id && (owner._id === user._id || owner === user._id);

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "in-progress":
        return "primary";
      case "planned":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <Card hoverable className="project-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Project Banner / Thumbnail */}
      {project.images && project.images.length > 0 && (
        <div
          style={{
            marginBottom: "12px",
            borderRadius: "var(--radius-btn)",
            overflow: "hidden",
            height: "140px",
            backgroundColor: "var(--surface-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <SafeImage
            src={project.images[0]}
            alt={project.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <FolderGit2 size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--accent)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {project.title}
          </h3>
        </div>

        <Badge variant={getStatusBadgeVariant(project.status)}>
          {project.status || "in-progress"}
        </Badge>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: "1.5",
          marginBottom: "14px",
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {project.description}
      </p>

      {/* Technologies */}
      {project.technologies && project.technologies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>
          {project.technologies.map((tech, idx) => (
            <span
              key={idx}
              className="badge"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "1px 6px",
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Footer / Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        {/* Owner */}
        <Link
          to={`/profile/${owner._id || ""}`}
          style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}
        >
          <Avatar src={owner.profileImage} name={owner.name} size={20} />
          <span style={{ fontSize: "12px", fontWeight: 500 }}>{owner.name || "Developer"}</span>
        </Link>

        {/* Links */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}
              title="GitHub repository"
            >
              <GithubIcon size={15} />
            </a>
          )}

          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}
              title="Live demo"
            >
              <ExternalLink size={15} />
            </a>
          )}

          {isOwner && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(project._id)}
              style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
              title="Delete project"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
