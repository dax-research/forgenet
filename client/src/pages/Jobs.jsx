import { useState, useEffect } from "react";
import {
  CheckCircle2,
} from "lucide-react";
import { usersService } from "../services/users.service";
import JobCard from "../components/JobCard";
import UserCard from "../components/UserCard";
import SearchInput from "../components/SearchInput";
import Tabs from "../components/Tabs";

const DEV_JOBS = [
  {
    id: "job-1",
    title: "Full Stack Engineer (Node.js & React)",
    company: "GitSync Technologies",
    location: "San Francisco, CA / Remote",
    type: "Remote",
    experience: "3-5 years",
    salary: "$145,000 - $175,000",
    postedDate: "1d ago",
    description: "Build developer workflows, real-time sync systems, and open source collaboration tools for modern cloud stacks.",
    tags: ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"],
  },
  {
    id: "job-2",
    title: "Distributed Systems & Go Engineer",
    company: "Aether Cloud",
    location: "Seattle, WA / Remote",
    type: "Remote",
    experience: "4+ years",
    salary: "$160,000 - $200,000",
    postedDate: "2d ago",
    description: "Design low-latency distributed storage pipelines, Raft consensus engines, and Kubernetes container runtimes.",
    tags: ["Go", "Kubernetes", "gRPC", "Distributed Systems"],
  },
  {
    id: "job-3",
    title: "Senior AI / ML Research Engineer",
    company: "Cortex Intelligence",
    location: "Austin, TX / Remote",
    type: "Remote",
    experience: "3+ years",
    salary: "$150,000 - $190,000",
    postedDate: "3d ago",
    description: "Fine-tune and deploy open-weight coding models and code evaluation datasets for next-generation developer tooling.",
    tags: ["Python", "PyTorch", "HuggingFace", "LLMs"],
  },
  {
    id: "job-4",
    title: "Frontend Architect (TypeScript & Performance)",
    company: "Prism DevTools",
    location: "New York, NY",
    type: "Full-time",
    experience: "5+ years",
    salary: "$165,000 - $195,000",
    postedDate: "4d ago",
    description: "Lead the frontend architecture of our web-based IDE, code visualizers, and AST analysis workspace.",
    tags: ["TypeScript", "WebAssembly", "React", "Canvas", "Performance"],
  },
  {
    id: "job-5",
    title: "DevOps & Infrastructure Engineer",
    company: "Beacon Data",
    location: "Chicago, IL / Remote",
    type: "Remote",
    experience: "2-4 years",
    salary: "$130,000 - $160,000",
    postedDate: "5d ago",
    description: "Manage Terraform pipelines, CI/CD observability with Prometheus/Grafana, and secure multi-region AWS deployments.",
    tags: ["Terraform", "AWS", "CI/CD", "Linux", "Docker"],
  },
];

export default function Jobs() {
  const [jobSeekers, setJobSeekers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    usersService
      .getUsers({ limit: 50 })
      .then((res) => {
        if (res.success && res.data?.users) {
          setJobSeekers(res.data.users.filter((u) => u.isJobSeeking));
        }
      })
      .catch(() => {});
  }, []);

  const typeTabs = [
    { id: "all", label: "All Roles" },
    { id: "Remote", label: "Remote Only" },
    { id: "Full-time", label: "Full-time" },
  ];

  const filteredJobs = DEV_JOBS.filter((job) => {
    const matchesType = selectedType === "all" || job.type === selectedType;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.tags.some((t) => t.toLowerCase().includes(q));

    return matchesType && matchesQuery;
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          Developer Opportunities
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Engineering roles at innovative dev-tool and technology companies
        </p>
      </div>

      {/* Developers Open to Work Showcase */}
      {jobSeekers.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>
              Developers Open to Work ({jobSeekers.length})
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "14px",
            }}
          >
            {jobSeekers.map((seeker) => (
              <UserCard key={seeker._id} user={seeker} />
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ maxWidth: "340px", width: "100%" }}>
          <SearchInput
            placeholder="Search by role, company, or stack (e.g. React, Go)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs
          tabs={typeTabs}
          activeTab={selectedType}
          onChange={(id) => setSelectedType(id)}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* Jobs Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onApply={(j) =>
              alert(
                `Interested in ${j.title} at ${j.company}? Reach out directly on ForgeNet or check their careers portal.`
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
