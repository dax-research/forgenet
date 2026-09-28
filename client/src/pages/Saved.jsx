import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usersService } from "../services/users.service";
import PostCard from "../components/PostCard";
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function Saved() {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;
    setLoading(true);
    usersService
      .getSavedPosts(user._id)
      .then((res) => {
        if (res.success && res.data?.posts) {
          setSavedPosts(res.data.posts);
        }
      })
      .catch((err) => console.warn("Load saved posts error:", err.message))
      .finally(() => setLoading(false));
  }, [user?._id]);

  const handlePostDeleted = (deletedId) => {
    setSavedPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          Saved Posts
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Bookmarked code snippets, articles, and discussions
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2].map((i) => (
            <Card key={i} style={{ padding: "16px" }}>
              <Skeleton width="40%" height="16px" style={{ marginBottom: "10px" }} />
              <Skeleton width="100%" height="40px" />
            </Card>
          ))}
        </div>
      ) : savedPosts.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved posts"
          description="Click the Save button on any post to bookmark it for later reference."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {savedPosts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onPostDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
