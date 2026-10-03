import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageSquare,
  Bookmark,
  Share2,
  Copy,
  Check,
  MoreHorizontal,
  Trash2,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { postsService } from "../services/posts.service";
import Avatar from "./Avatar";
import Button from "./Button";
import Card from "./Card";
import Dropdown from "./Dropdown";
import ImageGallery from "./ImageGallery";

export default function PostCard({
  post,
  onPostDeleted,
  onTagClick,
}) {
  const { user } = useAuth();
  const [likes, setLikes] = useState(post?.likes || []);
  const [isLiked, setIsLiked] = useState(() => {
    if (!user?._id || !post?.likes) return false;
    return post.likes.some(
      (id) => (typeof id === "object" ? id._id : id) === user._id
    );
  });
  const [isSaved, setIsSaved] = useState(() => {
    if (!user?.savedPosts || !post?._id) return false;
    return user.savedPosts.includes(post._id);
  });
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  const author = post?.author || {};
  const isOwner = user?._id && (author._id === user._id || author === user._id);

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleToggleLike = async () => {
    if (!user) return;

    // Snapshot current state for rollback
    const prevIsLiked = isLiked;
    const prevLikes = likes;

    // Optimistic update
    const nextIsLiked = !isLiked;
    setIsLiked(nextIsLiked);
    if (nextIsLiked) {
      setLikes((prev) => [...prev, user._id]);
    } else {
      setLikes((prev) =>
        prev.filter((id) => (typeof id === "object" ? id._id : id) !== user._id)
      );
    }

    try {
      if (nextIsLiked) {
        await postsService.likePost(post._id);
      } else {
        await postsService.unlikePost(post._id);
      }
    } catch {
      // Revert on failure
      setIsLiked(prevIsLiked);
      setLikes(prevLikes);
    }
  };

  const handleToggleSave = async () => {
    if (!user) return;
    try {
      if (isSaved) {
        await postsService.unsavePost(post._id);
        setIsSaved(false);
      } else {
        await postsService.savePost(post._id);
        setIsSaved(true);
      }
    } catch (err) {
      console.warn("Save post error:", err.message);
    }
  };

  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState && !commentsLoaded) {
      try {
        const res = await postsService.getComments(post._id);
        if (res.success && res.data?.comments) {
          setComments(res.data.comments);
          setCommentsLoaded(true);
        }
      } catch (err) {
        console.warn("Load comments error:", err.message);
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      const res = await postsService.createComment(post._id, {
        content: newComment.trim(),
      });
      if (res.success && res.data?.comment) {
        // Attach current user as author for immediate display
        const createdComment = {
          ...res.data.comment,
          author: { _id: user._id, name: user.name, profileImage: user.profileImage },
        };
        setComments((prev) => [createdComment, ...prev]);
        setNewComment("");
      }
    } catch (err) {
      console.warn("Add comment error:", err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await postsService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.warn("Delete comment error:", err.message);
    }
  };

  const handleDeletePost = async () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await postsService.deletePost(post._id);
        if (onPostDeleted) onPostDeleted(post._id);
      } catch (err) {
        console.warn("Delete post error:", err.message);
      }
    }
  };

  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${post._id}`;
    navigator.clipboard.writeText(url);
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2000);
  };

  return (
    <Card className="post-card" style={{ marginBottom: "16px" }}>
      {/* Post Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link to={`/profile/${author._id || ""}`}>
            <Avatar src={author.profileImage} name={author.name} size={36} />
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Link
                to={`/profile/${author._id || ""}`}
                style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}
              >
                {author.name || "Developer"}
              </Link>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>•</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {formatTimestamp(post.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {isOwner && (
          <Dropdown
            trigger={
              <button type="button" className="btn-ghost btn-sm" style={{ padding: "4px" }}>
                <MoreHorizontal size={16} />
              </button>
            }
            align="right"
          >
            <button
              type="button"
              onClick={handleDeletePost}
              className="dropdown-item"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={14} />
              <span>Delete post</span>
            </button>
          </Dropdown>
        )}
      </div>

      {/* Post Content */}
      <div style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>

      {/* Technical Code Blocks */}
      {post.codeBlocks && post.codeBlocks.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          {post.codeBlocks.map((block, idx) => (
            <div key={idx} className="code-block-wrapper">
              <div className="code-block-header">
                <span>{block.language || "code"}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.code, idx)}
                  className="code-block-copy-btn"
                >
                  {copiedCodeIndex === idx ? (
                    <>
                      <Check size={12} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="code-block-pre">
                <code>{block.code}</code>
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Images & Media */}
      {((post.media && post.media.length > 0) || (post.images && post.images.length > 0)) && (
        <ImageGallery 
          mediaItems={post.media && post.media.length > 0 ? post.media : post.images.map(img => ({ type: "image", url: img }))}
        />
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
          {post.tags.map((tag, idx) => (
            <span
              key={idx}
              className="tag-badge"
              onClick={() => onTagClick && onTagClick(tag)}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "14px",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          <button
            type="button"
            onClick={handleToggleLike}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: isLiked ? "var(--danger)" : "var(--text-secondary)",
              fontWeight: isLiked ? 600 : 500,
            }}
          >
            <Heart size={16} fill={isLiked ? "var(--danger)" : "none"} />
            <span>{likes.length}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleComments}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: showComments ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            <MessageSquare size={16} />
            <span>{comments.length || "Comments"}</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={handleToggleSave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              color: isSaved ? "var(--accent)" : "var(--text-secondary)",
            }}
            title={isSaved ? "Saved" : "Save post"}
          >
            <Bookmark size={15} fill={isSaved ? "var(--accent)" : "none"} />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-secondary)" }}
            title="Share post"
          >
            {shareSuccess ? <Check size={15} style={{ color: "var(--success)" }} /> : <Share2 size={15} />}
            <span>{shareSuccess ? "Copied" : "Share"}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {/* New Comment Input */}
          <form onSubmit={handleAddComment} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <Avatar src={user?.profileImage} name={user?.name} size={28} />
            <input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="input"
              style={{ fontSize: "12.5px" }}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={submittingComment}
              disabled={!newComment.trim()}
              icon={Send}
            >
              Reply
            </Button>
          </form>

          {/* Comments List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {comments.map((comment) => {
              const cAuthor = comment.author || {};
              const isCommentOwner = user?._id && (cAuthor._id === user._id || cAuthor === user._id);

              return (
                <div
                  key={comment._id}
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                    padding: "8px 10px",
                    backgroundColor: "var(--surface-secondary)",
                    borderRadius: "var(--radius-btn)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <Avatar src={cAuthor.profileImage} name={cAuthor.name} size={24} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary)" }}>
                          {cAuthor.name || "Developer"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>

                      {isCommentOwner && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment._id)}
                          style={{ color: "var(--text-muted)", padding: "2px" }}
                          title="Delete comment"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: "12.5px", marginTop: "3px", color: "var(--text-primary)" }}>
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
