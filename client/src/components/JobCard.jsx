import { Briefcase, MapPin, Clock, ExternalLink } from "lucide-react";
import Card from "./Card";
import Button from "./Button";
import Badge from "./Badge";

export default function JobCard({ job, onApply }) {
  return (
    <Card hoverable className="job-card" style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
            {job.title}
          </h3>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--accent)", marginTop: "2px" }}>
            {job.company}
          </p>
        </div>

        <Badge variant={job.type === "Remote" ? "success" : "default"}>
          {job.type}
        </Badge>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "12px",
          color: "var(--text-secondary)",
          marginBottom: "10px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <MapPin size={13} style={{ color: "var(--text-muted)" }} />
          {job.location}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Briefcase size={13} style={{ color: "var(--text-muted)" }} />
          {job.experience}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock size={13} style={{ color: "var(--text-muted)" }} />
          {job.postedDate}
        </span>
      </div>

      <p
        style={{
          fontSize: "12.5px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
          marginBottom: "12px",
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {job.description}
      </p>

      {job.tags && job.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "14px" }}>
          {job.tags.map((tag, idx) => (
            <span
              key={idx}
              className="badge"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "1px 5px" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
          {job.salary || "Competitive"}
        </span>

        <Button
          variant="secondary"
          size="sm"
          icon={ExternalLink}
          onClick={() => onApply && onApply(job)}
        >
          Apply
        </Button>
      </div>
    </Card>
  );
}
