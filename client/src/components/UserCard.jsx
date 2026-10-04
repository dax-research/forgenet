import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, UserCheck, MessageSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usersService } from "../services/users.service";
import Card from "./Card";
import Avatar from "./Avatar";
import Button from "./Button";
import Badge from "./Badge";

export default function UserCard({ user, onMessageClick, onFollowToggle }) {
  const { user: currentUser } = useAuth();
  const isSelf = currentUser?._id === user?._id;

  const [isFollowing, setIsFollowing] = useState(() => {
    if (!currentUser?._id || !user?.followers) return false;
    return user.followers.some(
      (f) => (typeof f === "object" ? f._id : f) === currentUser._id
    );
  });
  const [loading, setLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (isSelf || !currentUser?._id) return;
    try {
      setLoading(true);
      if (isFollowing) {
        await usersService.unfollowUser(user._id);
        setIsFollowing(false);
        if (onFollowToggle) onFollowToggle(user._id, false);
      } else {
        await usersService.followUser(user._id);
        setIsFollowing(true);
        if (onFollowToggle) onFollowToggle(user._id, true);
      }
    } catch (err) {
      console.warn("Follow toggle error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card hoverable className="user-card" style={{ padding: "16px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <Link to={`/profile/${user._id}`}>
          <Avatar src={user.profileImage} name={user.name} size={48} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <Link
              to={`/profile/${user._id}`}
              style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}
            >
              {user.name}
            </Link>

            {user.isJobSeeking && (
              <Badge variant="success" style={{ fontSize: "10px", padding: "1px 5px" }}>
                Open to work
              </Badge>
            )}
          </div>

          <p
            style={{
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              marginTop: "3px",
              lineHeight: "1.4",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {user.bio || "Software Engineer & Builder"}
          </p>

          {user.skills && user.skills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
              {user.skills.slice(0, 4).map((skill, idx) => (
                <span
                  key={idx}
                  className="badge"
                  style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", padding: "1px 5px" }}
                >
                  {skill}
                </span>
              ))}
              {user.skills.length > 4 && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)", alignSelf: "center" }}>
                  +{user.skills.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!isSelf && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {onMessageClick && (
            <Button
              variant="secondary"
              size="sm"
              icon={MessageSquare}
              onClick={() => onMessageClick(user._id)}
            >
              Message
            </Button>
          )}

          <Button
            variant={isFollowing ? "secondary" : "primary"}
            size="sm"
            icon={isFollowing ? UserCheck : UserPlus}
            loading={loading}
            onClick={handleFollowToggle}
          >
            {isFollowing ? "Following" : "Follow"}
          </Button>
        </div>
      )}
    </Card>
  );
}
