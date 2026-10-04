import { useState, useEffect, useRef } from "react";
import { Plus, Users2, ArrowLeft, Send, AlertCircle, Check, UserCheck, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBadges } from "../context/BadgeContext";
import { socketService } from "../services/socket.service";
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
import Badge from "../components/Badge";
import Avatar from "../components/Avatar";
import { Link } from "react-router-dom";

function MemberRow({ person, role }) {
  if (!person) return null;

  const badgeVariant = role === "Owner" ? "primary" : role === "Admin" ? "warning" : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "6px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Link
        to={`/profile/${person._id}`}
        style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}
      >
        <Avatar src={person.profileImage} name={person.name} size={28} />
        <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{person.name}</span>
      </Link>

      {badgeVariant ? (
        <span className={`badge badge-${badgeVariant}`} style={{ fontSize: "10.5px", padding: "1px 6px" }}>
          {role}
        </span>
      ) : null}
    </div>
  );
}

export default function Communities() {
  const { user } = useAuth();
  const { refreshBadges } = useBadges();
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
    joinMode: "OPEN",
  });

  // Selected Community Detail View
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postError, setPostError] = useState("");
  const [membershipAction, setMembershipAction] = useState(false);
  const [members, setMembers] = useState(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [resolvingRequest, setResolvingRequest] = useState("");
  const [updatingMode, setUpdatingMode] = useState(false);

  const selectedCommunityRef = useRef(null);
  selectedCommunityRef.current = selectedCommunity;

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

  // Loads the admin's pending-request queue. Called on open AND whenever a
  // join-request notification arrives, so a request is never missed.
  const loadJoinRequests = async (communityId) => {
    try {
      const reqs = await communitiesService.getJoinRequests(communityId);
      if (reqs.success && reqs.data?.requests) setJoinRequests(reqs.data.requests);
      else setJoinRequests([]);
    } catch (err) {
      console.warn("Load join requests error:", err.message);
      setJoinRequests([]);
    }
  };

  // Real-time: a new join request must show up without a manual refresh.
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNotification = (notification) => {
      if (notification?.type !== "community") return;
      if (notification?.data?.action !== "join_request") return;

      refreshBadges();
      const communityId = notification?.data?.communityId;
      // Update the visible detail view and the queue if the owner is looking
      // at that community right now.
      if (communityId && selectedCommunityRef.current?._id === communityId) {
        loadJoinRequests(communityId);
      } else if (communityId) {
        setCommunities((prev) =>
          prev.map((c) => (c._id === communityId ? { ...c, hasPendingJoinRequest: true } : c))
        );
      }
    };

    socket.on("notification:new", handleNotification);
    return () => socket.off("notification:new", handleNotification);
  }, [refreshBadges]);

  const handleSelectCommunity = async (comm) => {
    setSelectedCommunity(comm);
    setShowAllMembers(false);
    setPostError("");
    try {
      setLoadingPosts(true);

      // The list endpoint carries only a summary; re-fetch for authoritative
      // membership state (role, pending request) and member counts.
      const [detail, posts, memberRes] = await Promise.all([
        communitiesService.getCommunity(comm._id),
        communitiesService.getCommunityPosts(comm._id),
        communitiesService.getMembers(comm._id, { limit: 12 }),
      ]);

      if (detail.success && detail.data?.community) {
        setSelectedCommunity(detail.data.community);
      }
      if (posts.success && posts.data?.posts) {
        setCommunityPosts(posts.data.posts);
      }
      if (memberRes.success && memberRes.data) {
        setMembers({
          owner: memberRes.data.owner,
          admins: memberRes.data.admins || [],
          members: memberRes.data.members || [],
          memberCount: memberRes.data.memberCount ?? 0,
          hasMore: !!memberRes.data.hasMore,
        });
      }

      // Only admins/admins-of-record get the pending-request queue.
      setJoinRequests([]);
      if (detail.data?.community?.membership?.isAdmin) {
        await loadJoinRequests(comm._id);
      }
    } catch (err) {
      console.warn("Load community detail error:", err.message);
    } finally {
      setLoadingPosts(false);
    }
  };

  const membership = selectedCommunity?.membership;

  const refreshCommunityDetail = async () => {
    if (!selectedCommunity?._id) return;
    const communityId = selectedCommunity._id;
    const res = await communitiesService.getCommunity(communityId);
    if (res.success && res.data?.community) {
      setSelectedCommunity(res.data.community);
      // Keep the directory cards in sync with the detail view.
      setCommunities((prev) =>
        prev.map((c) => (c._id === communityId ? res.data.community : c))
      );
      return res.data.community;
    }
    return null;
  };

  const handleMembershipAction = async () => {
    if (!selectedCommunity?._id || !membership) return;
    try {
      setMembershipAction(true);
      setPostError("");

      if (membership.isMember && !membership.isOwner) {
        await communitiesService.leaveCommunity(selectedCommunity._id);
      } else {
        // OPEN communities join immediately; APPROVAL_REQUIRED ones create a
        // pending request instead.
        await communitiesService.joinCommunity(selectedCommunity._id);
      }

      await refreshCommunityDetail();
      const memberRes = await communitiesService.getMembers(selectedCommunity._id, { limit: 12 });
      if (memberRes.success && memberRes.data) {
        setMembers({
          owner: memberRes.data.owner,
          admins: memberRes.data.admins || [],
          members: memberRes.data.members || [],
          memberCount: memberRes.data.memberCount ?? 0,
          hasMore: !!memberRes.data.hasMore,
        });
      }
    } catch (err) {
      // 409 = already a member / request already pending; the server knows the
      // real state, so adopt it rather than leaving a stale button.
      if (err.response?.status === 409) {
        await refreshCommunityDetail();
      }
      setPostError(err.response?.data?.message || err.message || "Membership change failed.");
    } finally {
      setMembershipAction(false);
    }
  };

  const handleLoadAllMembers = async () => {
    if (!selectedCommunity?._id) return;
    try {
      const res = await communitiesService.getMembers(selectedCommunity._id, { limit: 100 });
      if (res.success && res.data) {
        setMembers((prev) => ({ ...prev, members: res.data.members || [], hasMore: false }));
        setShowAllMembers(true);
      }
    } catch (err) {
      console.warn("Load all members error:", err.message);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedCommunity?._id || !membership?.hasPendingRequest) return;
    try {
      setMembershipAction(true);
      setPostError("");
      await communitiesService.cancelJoinRequest(selectedCommunity._id, membership.pendingRequestId);
      await refreshCommunityDetail();
    } catch (err) {
      setPostError(err.response?.data?.message || err.message || "Could not cancel the request.");
    } finally {
      setMembershipAction(false);
    }
  };

  const handleJoinModeChange = async (nextMode) => {
    if (!selectedCommunity?._id || nextMode === selectedCommunity.joinMode) return;
    try {
      setUpdatingMode(true);
      setPostError("");
      await communitiesService.updateCommunity(selectedCommunity._id, { joinMode: nextMode });
      await refreshCommunityDetail();

      // If the community became OPEN, pending requests were granted in the
      // background — pull the (now empty) admin queue and fresh member list.
      const isAdmin = membership?.isAdmin;
      if (isAdmin) {
        const reqs = await communitiesService.getJoinRequests(selectedCommunity._id);
        if (reqs.success && reqs.data?.requests) setJoinRequests(reqs.data.requests);
      }
      const memberRes = await communitiesService.getMembers(selectedCommunity._id, { limit: 12 });
      if (memberRes.success && memberRes.data) {
        setMembers({
          owner: memberRes.data.owner,
          admins: memberRes.data.admins || [],
          members: memberRes.data.members || [],
          memberCount: memberRes.data.memberCount ?? 0,
          hasMore: !!memberRes.data.hasMore,
        });
      }
    } catch (err) {
      setPostError(err.response?.data?.message || err.message || "Could not update the membership mode.");
    } finally {
      setUpdatingMode(false);
    }
  };

  const handleResolveRequest = async (requestId, decision) => {
    if (!selectedCommunity?._id) return;
    try {
      setResolvingRequest(requestId + decision);
      await communitiesService.respondToJoinRequest(selectedCommunity._id, requestId, decision);
      setJoinRequests((prev) => prev.filter((r) => r._id !== requestId));
      await refreshCommunityDetail();
    } catch (err) {
      setPostError(err.response?.data?.message || err.message || "Could not update the request.");
    } finally {
      setResolvingRequest("");
    }
  };

  const handleCreateCommunityPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || !selectedCommunity) return;
    try {
      setSubmittingPost(true);
      setPostError("");
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
      // Surface the real reason (e.g. 403 from the server-side membership gate).
      setPostError(
        err.response?.data?.message ||
          "Could not create the post. Make sure you are a member of this community."
      );
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
        joinMode: createData.joinMode,
      };

      const res = await communitiesService.createCommunity(payload);
      if (res.success && res.data?.community) {
        setCommunities((prev) => [res.data.community, ...prev]);
        setIsCreateModalOpen(false);
        setCreateData({ name: "", description: "", image: "", joinMode: "OPEN" });
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
                  {members?.memberCount ?? selectedCommunity.memberCount ?? selectedCommunity.members?.length ?? 1}{" "}
                  {selectedCommunity.joinMode === "APPROVAL_REQUIRED" ? "\u00b7 approval required to join" : "\u00b7 open to join"}
                </p>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexShrink: 0 }}>
                {membership?.isOwner ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-btn)",
                        overflow: "hidden",
                      }}
                      title="Who can join this community"
                    >
                      <button
                        type="button"
                        onClick={() => handleJoinModeChange("OPEN")}
                        disabled={updatingMode}
                        className={`btn btn-sm ${selectedCommunity.joinMode === "OPEN" ? "btn-primary" : "btn-secondary"}`}
                        style={{ borderRadius: 0, border: "none" }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJoinModeChange("APPROVAL_REQUIRED")}
                        disabled={updatingMode}
                        className={`btn btn-sm ${selectedCommunity.joinMode === "APPROVAL_REQUIRED" ? "btn-primary" : "btn-secondary"}`}
                        style={{ borderRadius: 0, border: "none" }}
                      >
                        Approval
                      </button>
                    </div>
                    <Badge variant="primary" style={{ fontSize: "11px" }}>
                      Owner
                    </Badge>
                  </div>
                ) : membership?.isMember ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Check}
                    loading={membershipAction}
                    onClick={handleMembershipAction}
                  >
                    Leave Community
                  </Button>
                ) : membership?.hasPendingRequest ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Clock}
                    loading={membershipAction}
                    onClick={handleCancelRequest}
                    title="Click to cancel your join request"
                  >
                    Request Pending
                  </Button>
                ) : selectedCommunity.joinMode === "APPROVAL_REQUIRED" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={UserCheck}
                    loading={membershipAction}
                    onClick={handleMembershipAction}
                  >
                    Request to Join
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Users2}
                    loading={membershipAction}
                    onClick={handleMembershipAction}
                  >
                    Join Community
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Community Post Composer — only members can post */}
          <Card style={{ padding: "16px", marginBottom: "20px" }}>
            {membership?.isMember ? (
              <form onSubmit={handleCreateCommunityPost}>
                {postError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      marginBottom: "10px",
                      borderRadius: "var(--radius-btn)",
                      backgroundColor: "var(--danger-bg)",
                      border: "1px solid var(--danger-border)",
                      color: "var(--danger)",
                      fontSize: "12.5px",
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{postError}</span>
                  </div>
                )}

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
                    Create Post
                  </Button>
                </div>
              </form>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {membership?.hasPendingRequest
                    ? "Your request to join is pending approval."
                    : "Join this community to post."}
                </p>
              </div>
            )}
          </Card>

          {/* Pending join requests — owner/admins only */}
          {membership?.isAdmin && (
            <Card style={{ padding: "16px", marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <UserCheck size={15} style={{ color: "var(--accent)" }} />
                <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Pending Join Requests
                </h2>
                {joinRequests.length > 0 && (
                  <span className="badge" style={{ fontSize: "10.5px", padding: "1px 6px" }}>
                    {joinRequests.length}
                  </span>
                )}
              </div>

              {joinRequests.length === 0 ? (
                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
                  No pending join requests.
                </p>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {joinRequests.map((req) => (
                  <div
                    key={req._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <Avatar src={req.user?.profileImage} name={req.user?.name} size={32} />
                      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                        {req.user?.name}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Check}
                        loading={resolvingRequest === req._id + "approve"}
                        onClick={() => handleResolveRequest(req._id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resolvingRequest === req._id + "reject"}
                        onClick={() => handleResolveRequest(req._id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Members / Admins / Owner */}
          {members && (
            <Card style={{ padding: "16px", marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users2 size={15} style={{ color: "var(--accent)" }} />
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Community Members
                  </h2>
                  <span className="badge" style={{ fontSize: "10.5px", padding: "1px 6px" }}>
                    {members.memberCount}
                  </span>
                </div>
                {(showAllMembers || members.hasMore) && (
                  <button
                    type="button"
                    onClick={handleLoadAllMembers}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {showAllMembers ? "Showing all" : "View all members"}
                  </button>
                )}
              </div>

              {members.owner && (
                <MemberRow person={members.owner} role="Owner" />
              )}
              {members.admins.map((a) => (
                <MemberRow key={a._id} person={a} role="Admin" />
              ))}
              {members.members.map((m) => (
                <MemberRow key={m._id} person={m} role="Member" />
              ))}
            </Card>
          )}

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

              <div className="form-group">
                <label className="form-label">Membership</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setCreateData((prev) => ({ ...prev, joinMode: "OPEN" }))}
                    className={`btn ${createData.joinMode === "OPEN" ? "btn-primary" : "btn-secondary"} btn-sm`}
                    style={{ flex: 1 }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateData((prev) => ({ ...prev, joinMode: "APPROVAL_REQUIRED" }))}
                    className={`btn ${createData.joinMode === "APPROVAL_REQUIRED" ? "btn-primary" : "btn-secondary"} btn-sm`}
                    style={{ flex: 1 }}
                  >
                    Approval Required
                  </button>
                </div>
                <span className="form-helper">
                  {createData.joinMode === "OPEN"
                    ? "Anyone can join immediately."
                    : "New members must be approved by an admin."}
                </span>
              </div>

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
