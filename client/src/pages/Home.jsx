import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  TrendingUp,
  FolderGit2,
  Users,
  Sparkles,
  Clock,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { postsService } from "../services/posts.service";
import { projectsService } from "../services/projects.service";
import { usersService } from "../services/users.service";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";
import Card from "../components/Card";
import Tabs from "../components/Tabs";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import Button from "../components/Button";

export default function Home() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTag = searchParams.get("tag");

  const [activeTab, setActiveTab] = useState("for-you");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState(null);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const res = await postsService.getPosts({ limit: 30, tag: activeTag || undefined });
      if (res.success && res.data?.posts) {
        setPosts(res.data.posts);
      }
    } catch (err) {
      console.warn("Failed to load feed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [activeTag]);

  useEffect(() => {
    // Load featured projects and suggested users for right column
    projectsService
      .getProjects({ limit: 3 })
      .then((res) => {
        if (res.success && res.data?.projects) {
          setFeaturedProjects(res.data.projects);
        }
      })
      .catch(() => {});

    usersService
      .getUsers({ limit: 4 })
      .then((res) => {
        if (res.success && res.data?.users) {
          setSuggestedUsers(
            res.data.users.filter((u) => u._id !== user?._id).slice(0, 3)
          );
        }
      })
      .catch(() => {});

    postsService
      .getTrendingTopics(8)
      .then((res) => {
        if (res.success && res.data?.trending) {
          setTrendingTopics(res.data.trending);
        }
      })
      .catch((err) => {
        setTrendingError(err?.message || "Failed to load trending topics");
      })
      .finally(() => {
        setTrendingLoading(false);
      });
  }, [user?._id]);

  const handlePostCreated = async (newPostData) => {
    const res = await postsService.createPost(newPostData);
    if (res.success && res.data?.post) {
      const created = {
        ...res.data.post,
        author: {
          _id: user._id,
          name: user.name,
          profileImage: user.profileImage,
        },
      };
      setPosts((prev) => [created, ...prev]);
    }
  };

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  const handleFollowUser = async (userId) => {
    try {
      await usersService.followUser(userId);
      setSuggestedUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (err) {
      console.warn("Follow error:", err.message);
    }
  };

  const feedTabs = [
    { id: "for-you", label: "For You", icon: Sparkles },
    { id: "following", label: "Following", icon: UserCheck },
    { id: "latest", label: "Latest", icon: Clock },
  ];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Greeting Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          {getGreeting()}, {user?.name || "Developer"}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Keep building. Keep sharing. Keep growing.
        </p>
      </div>

      {/* Main Grid: 2 columns on desktop (Feed 70% + Sidebar 30%) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: "24px",
          alignItems: "flex-start",
        }}
        id="home-feed-layout"
      >
        {/* Left Column: Feed */}
        <div style={{ minWidth: 0 }}>
          {/* Post Composer */}
          <PostComposer onPostCreated={handlePostCreated} />

          {activeTag && (
            <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "var(--surface-secondary)", borderRadius: "var(--radius-card)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                Showing posts tagged with <span style={{ color: "var(--accent)" }}>#{activeTag}</span>
              </span>
              <Link to="/" style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "underline" }}>
                Clear filter
              </Link>
            </div>
          )}

          {/* Feed Tabs */}
          {!activeTag && (
            <Tabs
              tabs={feedTabs}
              activeTab={activeTab}
              onChange={(tabId) => setActiveTab(tabId)}
            />
          )}

          {/* Posts Feed */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1, 2, 3].map((i) => (
                <Card key={i} style={{ padding: "16px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
                    <Skeleton width="36px" height="36px" borderRadius="50%" />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="120px" height="14px" style={{ marginBottom: "6px" }} />
                      <Skeleton width="80px" height="11px" />
                    </div>
                  </div>
                  <Skeleton width="100%" height="16px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="75%" height="16px" style={{ marginBottom: "14px" }} />
                  <Skeleton width="100%" height="70px" borderRadius="6px" />
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="Be the first to share an update, code snippet, or project with the community!"
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostDeleted={handlePostDeleted}
                onTagClick={(tag) => {
                  window.location.href = `/?tag=${tag}`;
                }}
              />
            ))
          )}
        </div>

        {/* Right Column: Widgets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Trending Topics */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <TrendingUp size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 600, fontSize: "13px" }}>Trending Topics</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {trendingLoading ? (
                <>
                  <Skeleton height={20} width="80%" />
                  <Skeleton height={20} width="65%" />
                  <Skeleton height={20} width="72%" />
                  <Skeleton height={20} width="58%" />
                </>
              ) : trendingError ? (
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Could not load trending topics.
                </span>
              ) : trendingTopics.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  No trending topics yet.
                </span>
              ) : (
                trendingTopics.map((topic) => (
                  <Link
                    key={topic.tag}
                    to={`/?tag=${topic.tag}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      padding: "4px 0",
                    }}
                    className="card-hover"
                  >
                    <span style={{ fontWeight: 500, color: "var(--accent)" }}>
                      #{topic.tag}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {topic.postCount} {topic.postCount === 1 ? "post" : "posts"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Featured Projects */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderGit2 size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Featured Projects</span>
              </div>
              <Link to="/projects" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
                View all
              </Link>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {featuredProjects.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No projects featured yet.</p>
              ) : (
                featuredProjects.map((proj) => (
                  <div key={proj._id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <Link
                      to={`/projects`}
                      style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}
                    >
                      {proj.title}
                    </Link>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {proj.description}
                    </p>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                        {proj.technologies.slice(0, 3).map((t, idx) => (
                          <span key={idx} className="badge" style={{ fontSize: "10px", padding: "0 5px" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Suggested Developers */}
          {suggestedUsers.length > 0 && (
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <Users size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Developers to follow</span>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {suggestedUsers.map((sUser) => (
                  <div
                    key={sUser._id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <Link to={`/profile/${sUser._id}`}>
                        <Avatar src={sUser.profileImage} name={sUser.name} size={30} />
                      </Link>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          to={`/profile/${sUser._id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: "12.5px",
                            color: "var(--text-primary)",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sUser.name}
                        </Link>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {sUser.skills?.[0] || "Developer"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleFollowUser(sUser._id)}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                    >
                      Follow
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Footer Links */}
          <div style={{ padding: "8px 14px", fontSize: "11px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <span>© 2026 ForgeNet</span>
            <span>•</span>
            <Link to="/explore">Explore</Link>
            <span>•</span>
            <Link to="/communities">Communities</Link>
            <span>•</span>
            <Link to="/jobs">Jobs</Link>
          </div>
        </div>
      </div>
    </div>
  );
}