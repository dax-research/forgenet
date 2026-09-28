import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  FolderGit2,
  FileText,
  Users2,
  Briefcase,
} from "lucide-react";
import { usersService } from "../services/users.service";
import { projectsService } from "../services/projects.service";
import { postsService } from "../services/posts.service";
import { communitiesService } from "../services/communities.service";
import { chatService } from "../services/chat.service";
import SearchInput from "../components/SearchInput";
import Tabs from "../components/Tabs";
import UserCard from "../components/UserCard";
import ProjectCard from "../components/ProjectCard";
import PostCard from "../components/PostCard";
import CommunityCard from "../components/CommunityCard";
import JobCard from "../components/JobCard";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

const CURATED_JOBS = [
  {
    id: "job-1",
    title: "Senior Full Stack Engineer (React & Node)",
    company: "Forge Systems",
    location: "San Francisco, CA / Remote",
    type: "Remote",
    experience: "4+ years",
    salary: "$140k - $180k",
    postedDate: "2d ago",
    description: "Architect and scale real-time collaboration engines and microservices powering thousands of developers.",
    tags: ["React", "TypeScript", "Node.js", "WebSocket"],
  },
  {
    id: "job-2",
    title: "AI / Systems Infrastructure Engineer",
    company: "Nexus Labs",
    location: "Remote",
    type: "Remote",
    experience: "3+ years",
    salary: "$150k - $190k",
    postedDate: "3d ago",
    description: "Deploy large multimodal language models and low-latency inference pipelines with Docker and Kubernetes.",
    tags: ["Python", "PyTorch", "Docker", "Kubernetes"],
  },
  {
    id: "job-3",
    title: "Frontend Engineer (Design Systems)",
    company: "Veloct Platform",
    location: "New York, NY",
    type: "Full-time",
    experience: "2+ years",
    salary: "$110k - $140k",
    postedDate: "5d ago",
    description: "Craft accessible, high-performance UI components, icons, and themes for enterprise developer tools.",
    tags: ["React", "CSS", "Vite", "Accessibility"],
  },
];

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get("q") || "";
  const initialTab = searchParams.get("tab") || "projects";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);

  // Results
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);

  // Sync tab with URL
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tabId);
      return p;
    });
  };

  const handleSearchSubmit = (val) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (val) p.set("q", val);
      else p.delete("q");
      return p;
    });
  };

  const executeSearch = async () => {
    try {
      setLoading(true);
      const q = query.trim();

      if (activeTab === "people") {
        const res = q
          ? await usersService.searchUsers(q)
          : await usersService.getUsers({ limit: 30 });
        if (res.success && res.data?.users) setUsers(res.data.users);
      } else if (activeTab === "projects") {
        const res = q
          ? await projectsService.searchProjects(q)
          : await projectsService.getProjects({ limit: 30 });
        if (res.success && res.data?.projects) setProjects(res.data.projects);
      } else if (activeTab === "posts") {
        const res = q
          ? await postsService.searchPosts(q)
          : await postsService.getPosts({ limit: 30 });
        if (res.success && res.data?.posts) setPosts(res.data.posts);
      } else if (activeTab === "communities") {
        const res = q
          ? await communitiesService.searchCommunities(q)
          : await communitiesService.getCommunities({ limit: 30 });
        if (res.success && res.data?.communities) setCommunities(res.data.communities);
      }
    } catch (err) {
      console.warn("Explore search error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchParams.get("q")]);

  const handleMessageUser = async (userId) => {
    try {
      const res = await chatService.createConversation(userId);
      if (res.success && res.data?.conversation) {
        navigate("/chat", { state: { activeConversationId: res.data.conversation._id } });
      }
    } catch {
      navigate("/chat");
    }
  };

  const tabs = [
    { id: "projects", label: "Projects", icon: FolderGit2 },
    { id: "people", label: "Developers", icon: Users },
    { id: "posts", label: "Posts", icon: FileText },
    { id: "communities", label: "Communities", icon: Users2 },
    { id: "jobs", label: "Jobs", icon: Briefcase },
  ];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          Explore ForgeNet
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Discover developers, repositories, communities, and tech opportunities
        </p>
      </div>

      {/* Search Input Bar */}
      <div style={{ marginBottom: "16px" }}>
        <SearchInput
          placeholder={`Search ${activeTab}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={handleSearchSubmit}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {/* Results Content */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ padding: "16px" }}>
              <Skeleton width="50%" height="18px" style={{ marginBottom: "8px" }} />
              <Skeleton width="100%" height="14px" style={{ marginBottom: "4px" }} />
              <Skeleton width="80%" height="14px" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeTab === "projects" && (
            projects.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No projects found"
                description={query ? `No projects found matching "${query}"` : "No projects to display."}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                {projects.map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </div>
            )
          )}

          {activeTab === "people" && (
            users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No developers found"
                description={query ? `No developers matching "${query}"` : "No developers to display."}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                {users.map((u) => (
                  <UserCard
                    key={u._id}
                    user={u}
                    onMessageClick={handleMessageUser}
                  />
                ))}
              </div>
            )
          )}

          {activeTab === "posts" && (
            posts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No posts found"
                description={query ? `No posts found matching "${query}"` : "No posts to display."}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "720px" }}>
                {posts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            )
          )}

          {activeTab === "communities" && (
            communities.length === 0 ? (
              <EmptyState
                icon={Users2}
                title="No communities found"
                description={query ? `No communities matching "${query}"` : "No communities to display."}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                {communities.map((c) => (
                  <CommunityCard key={c._id} community={c} />
                ))}
              </div>
            )
          )}

          {activeTab === "jobs" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {CURATED_JOBS.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={(j) => alert(`Application modal for: ${j.title} at ${j.company}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
