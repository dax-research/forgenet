import { useState } from "react";
import { Code2, Image, Hash, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import Button from "./Button";
import Card from "./Card";

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "go",
  "rust",
  "html",
  "css",
  "sql",
  "shell",
  "json",
];

export default function PostComposer({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !code.trim()) {
      setError("Please write something or provide a code block.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const codeBlocks =
        showCode && code.trim()
          ? [{ language: codeLanguage, code: code.trim() }]
          : [];

      const tags = tagsInput
        ? tagsInput
            .split(/[\s,]+/)
            .map((t) => t.replace(/^#/, "").trim())
            .filter(Boolean)
        : [];

      const images = showImage && imageUrl.trim() ? [imageUrl.trim()] : [];

      await onPostCreated({
        content: content.trim(),
        codeBlocks,
        tags,
        images,
      });

      // Reset
      setContent("");
      setCode("");
      setShowCode(false);
      setImageUrl("");
      setShowImage(false);
      setTagsInput("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="composer-card" style={{ marginBottom: "20px" }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <Avatar src={user?.profileImage} name={user?.name} size={36} />
          <div style={{ flex: 1 }}>
            <textarea
              placeholder="What are you building, learning, or shipping today?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              className="textarea"
              style={{
                border: "none",
                padding: "4px 0",
                fontSize: "14px",
                boxShadow: "none",
                background: "transparent",
              }}
            />
          </div>
        </div>

        {/* Code Editor Preview */}
        {showCode && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              backgroundColor: "var(--surface-secondary)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Code2 size={15} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: "12px", fontWeight: 600 }}>Code Snippet</span>
              </div>
              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
                className="select"
                style={{ width: "auto", padding: "2px 8px", fontSize: "11px" }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder={`// Paste your ${codeLanguage} code here...`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                backgroundColor: "#161B22",
                color: "#E6EDF3",
                border: "1px solid #30363D",
                borderRadius: "var(--radius-btn)",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Image URL Input */}
        {showImage && (
          <div style={{ marginTop: "10px" }}>
            <input
              type="url"
              placeholder="Paste image URL (https://...)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="input"
              style={{ fontSize: "12px" }}
            />
          </div>
        )}

        {/* Tags input */}
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Hash size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Tags (e.g. react, nodejs, machine-learning)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "12px",
                color: "var(--text-secondary)",
                width: "100%",
              }}
            />
          </div>
        </div>

        {error && (
          <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <Button
              variant={showCode ? "primary" : "ghost"}
              size="sm"
              icon={Code2}
              onClick={() => setShowCode((prev) => !prev)}
            >
              Code
            </Button>
            <Button
              variant={showImage ? "primary" : "ghost"}
              size="sm"
              icon={Image}
              onClick={() => setShowImage((prev) => !prev)}
            >
              Image
            </Button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={loading}
            icon={Send}
            disabled={!content.trim() && !code.trim()}
          >
            Publish
          </Button>
        </div>
      </form>
    </Card>
  );
}
