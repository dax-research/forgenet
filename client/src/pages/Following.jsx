import { useState, useEffect } from "react";
import { UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usersService } from "../services/users.service";
import UserCard from "../components/UserCard";
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function Following() {
  const { user } = useAuth();
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;
    setLoading(true);
    usersService
      .getFollowing(user._id)
      .then((res) => {
        if (res.success && res.data?.users) {
          setFollowing(res.data.users);
        }
      })
      .catch((err) => console.warn("Load following error:", err.message))
      .finally(() => setLoading(false));
  }, [user?._id]);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          Following
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Developers, engineers, and creators you are keeping up with
        </p>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ padding: "16px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <Skeleton width="48px" height="48px" borderRadius="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="120px" height="15px" style={{ marginBottom: "6px" }} />
                  <Skeleton width="80px" height="12px" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : following.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Not following anyone yet"
          description="Explore the community and connect with developers to see their latest work in your feed."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {following.map((u) => (
            <UserCard key={u._id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}
