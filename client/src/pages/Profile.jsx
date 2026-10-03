import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Globe,
  Calendar,
  Edit3,
  MessageSquare,
  UserPlus,
  UserCheck,
  CheckCircle2,
  FolderGit2,
  FileText,
  Activity,
} from "lucide-react";
import GithubIcon from "../components/GithubIcon";
import { useAuth } from "../context/AuthContext";
import { usersService } from "../services/users.service";
import { projectsService } from "../services/projects.service";
import { postsService } from "../services/posts.service";
import { chatService } from "../services/chat.service";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import ProjectCard from "../components/ProjectCard";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser, updateProfile } = useAuth();
  const navigate = useNavigate();

  const isOwnProfile = !id || id === "me" || id === currentUser?._id;
  const targetUserId = isOwnProfile ? currentUser?._id : id;

  const [profileUser, setProfileUser] = useState(isOwnProfile ? currentUser : null);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [activeTab, setActiveTab] = useState("overview");
  const [userProjects, setUserProjects] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    bio: "",
    skills: "",
    githubUrl: "",
    portfolioUrl: "",
    isJobSeeking: false,
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!targetUserId) return;
      try {
        setLoading(true);
        const res = await usersService.getUser(targetUserId);
        if (isMounted && res.success && res.data?.user) {
          const u = res.data.user;
          setProfileUser(u);
          setFollowersCount(u.followers?.length || 0);
          setFollowingCount(u.following?.length || 0);

          if (currentUser?._id && u.followers) {
            setIsFollowing(
              u.followers.some(
                (f) => (typeof f === "object" ? f._id : f) === currentUser._id
              )
            );
          }

          // Populate edit form
          if (isOwnProfile) {
            setEditFormData({
              name: u.name || "",
              bio: u.bio || "",
              skills: Array.isArray(u.skills) ? u.skills.join(", ") : "",
              githubUrl: u.githubUrl || "",
              portfolioUrl: u.portfolioUrl || "",
              isJobSeeking: !!u.isJobSeeking,
            });
          }
        }
      } catch (err) {
        console.warn("Load profile error:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [targetUserId, currentUser?._id, isOwnProfile]);

  const [userActivity, setUserActivity] = useState([]);

  // Load user projects, posts, and activity
  useEffect(() => {
    if (!targetUserId) return;

    projectsService
      .getProjects({ limit: 50 })
      .then((res) => {
        if (res.success && res.data?.projects) {
          setUserProjects(
            res.data.projects.filter(
              (p) => (p.owner?._id || p.owner) === targetUserId
            )
          );
        }
      })
      .catch(() => {});

    postsService
      .getPosts({ limit: 50 })
      .then((res) => {
        if (res.success && res.data?.posts) {
          setUserPosts(
            res.data.posts.filter(
              (p) => (p.author?._id || p.author) === targetUserId
            )
          );
        }
      })
      .catch(() => {});

    usersService
      .getUserActivity(targetUserId)
      .then((res) => {
        if (res.success && res.data?.activity) {
          setUserActivity(res.data.activity);
        }
      })
      .catch(() => {});
  }, [targetUserId]);

  const handleFollowToggle = async () => {
    if (!currentUser?._id || isOwnProfile) return;
    try {
      if (isFollowing) {
        await usersService.unfollowUser(targetUserId);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await usersService.followUser(targetUserId);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err) {
      console.warn("Toggle follow error:", err.message);
    }
  };

  const handleStartChat = async () => {
    if (!currentUser?._id || isOwnProfile) return;
    try {
      const res = await chatService.createConversation(targetUserId);
      if (res.success && res.data?.conversation) {
        navigate("/chat", { state: { activeConversationId: res.data.conversation._id } });
      }
    } catch (err) {
      console.warn("Start chat error:", err.message);
      navigate("/chat");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setUpdating(true);
      const payload = {
        name: editFormData.name.trim(),
        bio: editFormData.bio.trim(),
        skills: editFormData.skills
          ? editFormData.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        githubUrl: editFormData.githubUrl.trim(),
        portfolioUrl: editFormData.portfolioUrl.trim(),
        isJobSeeking: editFormData.isJobSeeking,
      };

      const updated = await updateProfile(payload);
      if (updated) {
        setProfileUser(updated);
        setIsEditModalOpen(false);
      }
    } catch (err) {
      console.warn("Update profile error:", err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Generate ForgeNet 52-week activity block visualization
  const activityBlocks = useMemo(() => {
    const totalDays = 52 * 7;
    const blocks = [];
    
    // Map activity data to date strings
    const activityMap = {};
    userActivity.forEach((item) => {
      activityMap[item.date] = item.count;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const count = activityMap[dateString] || 0;

      let level = 0;
      if (count >= 8) level = 4;
      else if (count >= 5) level = 3;
      else if (count >= 3) level = 2;
      else if (count >= 1) level = 1;

      blocks.push(level);
    }
    return blocks;
  }, [userActivity]);

  const profileTabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "projects", label: "Projects", icon: FolderGit2, count: userProjects.length },
    { id: "posts", label: "Posts", icon: FileText, count: userPosts.length },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <Card style={{ padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <Skeleton width="80px" height="80px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton width="180px" height="22px" style={{ marginBottom: "8px" }} />
              <Skeleton width="280px" height="14px" style={{ marginBottom: "14px" }} />
              <Skeleton width="200px" height="14px" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <EmptyState
        title="Developer not found"
        description="The requested user profile does not exist or has been removed."
        actionLabel="Go Home"
        onAction={() => navigate("/")}
      />
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Profile Header Card */}
      <Card style={{ padding: "24px", marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          {/* Avatar & Info */}
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            <Avatar
              src={profileUser.profileImage}
              name={profileUser.name}
              size={80}
            />

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {profileUser.name}
                </h1>

                {profileUser.isJobSeeking && (
                  <Badge variant="success" icon={CheckCircle2}>
                    Open to Work
                  </Badge>
                )}
              </div>

              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px", maxWidth: "600px" }}>
                {profileUser.bio || "No developer biography provided yet."}
              </p>

              {/* Meta Links */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginTop: "12px",
                  fontSize: "12.5px",
                  color: "var(--text-secondary)",
                }}
              >
                {profileUser.githubUrl && (
                  <a
                    href={profileUser.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent)" }}
                  >
                    <GithubIcon size={14} />
                    <span>GitHub</span>
                  </a>
                )}

                {profileUser.portfolioUrl && (
                  <a
                    href={profileUser.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent)" }}
                  >
                    <Globe size={14} />
                    <span>Portfolio</span>
                  </a>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-muted)" }}>
                  <Calendar size={14} />
                  <span>
                    Joined{" "}
                    {profileUser.createdAt
                      ? new Date(profileUser.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })
                      : "recently"}
                  </span>
                </div>
              </div>

              {/* Followers / Following Stats */}
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginTop: "12px",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                }}
              >
                <span>
                  <strong style={{ color: "var(--text-primary)" }}>{followersCount}</strong> followers
                </span>
                <span>•</span>
                <span>
                  <strong style={{ color: "var(--text-primary)" }}>{followingCount}</strong> following
                </span>
                <span>•</span>
                <span>
                  <strong style={{ color: "var(--text-primary)" }}>{userProjects.length}</strong> projects
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            {isOwnProfile ? (
              <Button
                variant="secondary"
                icon={Edit3}
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? "secondary" : "primary"}
                  icon={isFollowing ? UserCheck : UserPlus}
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                <Button
                  variant="secondary"
                  icon={MessageSquare}
                  onClick={handleStartChat}
                >
                  Message
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Skills Section */}
        {profileUser.skills && profileUser.skills.length > 0 && (
          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Technical Skills & Tools
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {profileUser.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="badge badge-primary"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px" }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Tabs
        tabs={profileTabs}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t)}
      />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Contribution / Activity Graph */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "13px" }}>
                Developer Activity (Past Year)
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
                <span>Less</span>
                <span className="activity-cell" />
                <span className="activity-cell level-1" />
                <span className="activity-cell level-2" />
                <span className="activity-cell level-3" />
                <span className="activity-cell level-4" />
                <span>More</span>
              </div>
            </div>

            <div style={{ padding: "16px" }}>
              <div className="activity-graph-wrapper">
                <div className="activity-grid">
                  {activityBlocks.map((lvl, idx) => (
                    <div
                      key={idx}
                      className={`activity-cell ${lvl > 0 ? `level-${lvl}` : ""}`}
                      title={`Activity level ${lvl}`}
                    />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                Activity and project contributions on ForgeNet
              </p>
            </div>
          </Card>

          {/* Featured Projects in Overview */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Featured Projects</h3>
              {userProjects.length > 2 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("projects")}
                  style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}
                >
                  View all ({userProjects.length})
                </button>
              )}
            </div>

            {userProjects.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No projects showcased"
                description={
                  isOwnProfile
                    ? "Showcase your repositories, frameworks, and side projects."
                    : "This developer hasn't published any projects yet."
                }
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {userProjects.slice(0, 4).map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "projects" && (
        <div>
          {userProjects.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No projects found"
              description="No projects have been published by this user."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {userProjects.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "posts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {userPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No posts yet"
              description="No public thoughts, code snippets, or updates from this developer."
            />
          ) : (
            userPosts.map((post) => (
              <PostCard 
                key={post._id} 
                post={post} 
                onTagClick={(tag) => {
                  window.location.href = `/?tag=${tag}`;
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Developer Profile"
          maxWidth="520px"
        >
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Name"
              name="name"
              value={editFormData.name}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <Input
              label="Bio / Headline"
              name="bio"
              type="textarea"
              rows={2}
              value={editFormData.bio}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Full-stack Engineer exploring distributed systems & AI..."
            />

            <Input
              label="Skills (comma separated)"
              name="skills"
              value={editFormData.skills}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, skills: e.target.value }))}
              placeholder="React, TypeScript, Go, Docker, GraphQL"
            />

            <Input
              label="GitHub Profile URL"
              name="githubUrl"
              type="url"
              value={editFormData.githubUrl}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, githubUrl: e.target.value }))}
              placeholder="https://github.com/username"
              icon={GithubIcon}
            />

            <Input
              label="Portfolio / Website URL"
              name="portfolioUrl"
              type="url"
              value={editFormData.portfolioUrl}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
              placeholder="https://developer.dev"
              icon={Globe}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
              <input
                type="checkbox"
                id="isJobSeeking"
                checked={editFormData.isJobSeeking}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, isJobSeeking: e.target.checked }))}
                style={{ width: "16px", height: "16px", accentColor: "var(--accent)" }}
              />
              <label htmlFor="isJobSeeking" style={{ fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                I am actively looking for job / contract opportunities (Open to Work)
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <Button
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={updating}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
