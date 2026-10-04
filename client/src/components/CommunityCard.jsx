import { useState } from "react";
import { Users2, Check, Clock, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { communitiesService } from "../services/communities.service";
import Card from "./Card";
import Button from "./Button";
import Badge from "./Badge";

export default function CommunityCard({
  community,
  onCommunityClick,
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState(community?.members || []);
  // Server-computed membership; authoritative for role and pending requests.
  const [membership, setMembership] = useState(community?.membership ?? null);
  const [loading, setLoading] = useState(false);

  const isMember = membership?.isMember ?? false;
  const isOwner = membership?.isOwner ?? false;

  const handleJoinLeave = async (e) => {
    e.stopPropagation();
    if (!user?._id || isOwner) return;
    try {
      setLoading(true);
      if (isMember) {
        await communitiesService.leaveCommunity(community._id);
        setMembership((prev) => ({ ...(prev || {}), isMember: false, role: "NONE" }));
        setMembers((prev) =>
          prev.filter((m) => (typeof m === "object" ? m._id : m) !== user._id)
        );
      } else {
        const res = await communitiesService.joinCommunity(community._id);
        if (res?.data?.membership) {
          setMembership(res.data.membership);
        } else {
          setMembership((prev) => ({ ...(prev || {}), isMember: true, role: "MEMBER" }));
          setMembers((prev) => [...prev, user._id]);
        }
      }
    } catch (err) {
      console.warn("Join/leave error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      hoverable
      className="community-card"
      style={{
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: onCommunityClick ? "pointer" : "default",
      }}
      onClick={() => onCommunityClick && onCommunityClick(community)}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "10px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "var(--radius-btn)",
            backgroundColor: "var(--accent-light)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid #B4D2FB",
          }}
        >
          {community.image ? (
            <img
              src={community.image}
              alt={community.name}
              style={{ width: "100%", height: "100%", borderRadius: "var(--radius-btn)", objectFit: "cover" }}
            />
          ) : (
            <Users2 size={20} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {community.name}
          </h3>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      <p
        style={{
          fontSize: "12.5px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
          marginBottom: "14px",
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {community.description}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {isOwner ? (
          <Badge variant="primary" style={{ fontSize: "11px" }}>
            Owner
          </Badge>
        ) : isMember ? (
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            icon={Check}
            onClick={handleJoinLeave}
          >
            Leave
          </Button>
        ) : membership?.hasPendingRequest ? (
          <Button variant="secondary" size="sm" icon={Clock} disabled>
            Pending
          </Button>
        ) : community?.joinMode === "APPROVAL_REQUIRED" ? (
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            icon={UserCheck}
            onClick={handleJoinLeave}
          >
            Request
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            icon={Users2}
            onClick={handleJoinLeave}
          >
            Join
          </Button>
        )}
      </div>
    </Card>
  );
}
