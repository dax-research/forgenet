import { useState, useEffect } from "react";
import { Plus, Users2, ArrowLeft, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { communitiesService } from "../services/communities.service";
import CommunityCard from "../components/CommunityCard";
import PostCard from "../components/PostCard";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import SearchInput from "../components/SearchInput";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Card from "../components/Card";
import Avatar from "../components/Avatar";

export default function Communities() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [createData, setCreateData] = useState({
    name: "",
    description: "",
    image: "",
  });

  // Selected Community Detail View
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      const res = await communitiesService.getCommunities({ limit: 50 });
      if (res.success && res.data?.communities) {
        setCommunities(res.data.communities);
      }
    } catch (err) {
      console.warn("Load communities error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  const handleSelectCommunity = async (comm) => {
    setSelectedCommunity(comm);
    try {
      setLoadingPosts(true);
      const res = await communitiesService.getCommunityPosts(comm._id);
      if (res.success && res.data?.posts) {
        setCommunityPosts(res.data.posts);
      }
    } catch (err) {
      console.warn("Load community posts error:", err.message);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleCreateCommunityPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || !selectedCommunity) return;
    try {
      setSubmittingPost(true);
      const res = await communitiesService.createCommunityPost(selectedCommunity._id, {
        content: newPostContent.trim(),
      });
      if (res.success && res.data?.post) {
        const created = {
          ...res.data.post,
          author: { _id: user._id, name: user.name, profileImage: user.profileImage },
        };
        setCommunityPosts((prev) => [created, ...prev]);
        setNewPostContent("");
      }
    } catch (err) {
      console.warn("Create community post error:", err.message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!createData.name.trim() || !createData.description.trim()) {
      setFormError("Name and description are required.");
      return;
    }

    try {
      setCreating(true);
      setFormError("");
      const payload = {
        name: createData.name.trim(),
        description: createData.description.trim(),
        image: createData.image.trim() || undefined,
      };

      const res = await communitiesService.createCommunity(payload);
      if (res.success && res.data?.community) {
        setCommunities((prev) => [res.data.community, ...prev]);
        setIsCreateModalOpen(false);
        setCreateData({ name: "", description: "", image: "" });
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to create community.");
    } finally {
      setCreating(false);
    }
  };

  const filteredCommunities = communities.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* If Viewing Specific Community */}
      {selectedCommunity ? (
        <div>
          {/* Back button */}
          <button
            type="button"
            onClick={() => setSelectedCommunity(null)}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: "16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={16} />
            <span>Back to Communities</span>
          </button>

          {/* Community Banner Card */}
          <Card style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--accent-light)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #B4D2FB",
                }}
              >
                {selectedCommunity.image ? (
                  <img
                    src={selectedCommunity.image}
                    alt={selectedCommunity.name}
                    style={{ width: "100%", height: "100%", borderRadius: "var(--radius-btn)", objectFit: "cover" }}
                  />
                ) : (
                  <Users2 size={28} />
                )}
              </div>

              <div>
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {selectedCommunity.name}
                </h1>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {selectedCommunity.description}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {selectedCommunity.members?.length || 1} members
                </p>
              </div>
            </div>
          </Card>

          {/* Community Post Composer */}
          <Card style={{ padding: "16px", marginBottom: "20px" }}>
            <form onSubmit={handleCreateCommunityPost}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <Avatar src={user?.profileImage} name={user?.name} size={32} />
                <textarea
                  placeholder={`Post an update to ${selectedCommunity.name}...`}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={2}
                  className="textarea"
                  style={{ flex: 1, fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submittingPost}
                  disabled={!newPostContent.trim()}
                  icon={Send}
                >
                  Post to Community
                </Button>
              </div>
            </form>
          </Card>

          {/* Community Posts Feed */}
          {loadingPosts ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1, 2].map((i) => (
                <Card key={i} style={{ padding: "16px" }}>
                  <Skeleton width="100px" height="14px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="100%" height="40px" />
                </Card>
              ))}
            </div>
          ) : communityPosts.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No discussions yet"
              description="Be the first to post in this community and kick off the conversation!"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "760px" }}>
              {communityPosts.map((p) => (
                <PostCard key={p._id} post={p} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Community Directory View */
        <div>
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
                Developer Communities
              </h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Join technology hubs, language user groups, and open source collectives
              </p>
            </div>

            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Community
            </Button>
          </div>

          <div style={{ marginBottom: "16px", maxWidth: "340px" }}>
            <SearchInput
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} style={{ padding: "16px" }}>
                  <Skeleton width="60%" height="18px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="100%" height="14px" style={{ marginBottom: "4px" }} />
                  <Skeleton width="80%" height="14px" />
                </Card>
              ))}
            </div>
          ) : filteredCommunities.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No communities found"
              description={
                searchQuery
                  ? `No communities matching "${searchQuery}".`
                  : "No developer communities have been created yet. Launch your own community!"
              }
              actionLabel="Create Community"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {filteredCommunities.map((c) => (
                <CommunityCard
                  key={c._id}
                  community={c}
                  onCommunityClick={handleSelectCommunity}
                />
              ))}
            </div>
          )}

          {/* Create Community Modal */}
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create a Developer Community"
            maxWidth="500px"
          >
            <form onSubmit={handleCreateCommunity} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {formError && (
                <p style={{ color: "var(--danger)", fontSize: "12px" }}>{formError}</p>
              )}

              <Input
                label="Community Name"
                name="name"
                value={createData.name}
                onChange={(e) => setCreateData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Rust Developers Club"
                required
              />

              <Input
                label="Description"
                name="description"
                type="textarea"
                rows={3}
                value={createData.description}
                onChange={(e) => setCreateData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What is the purpose of this community? Who should join?"
                required
              />

              <Input
                label="Avatar / Logo Image URL (optional)"
                name="image"
                type="url"
                value={createData.image}
                onChange={(e) => setCreateData((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="https://... logo.png"
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={creating}>
                  Create
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </div>
  );
}
