import { useState, useRef } from "react";
import { Code2, Image as ImageIcon, Hash, Send, X, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import Button from "./Button";
import Card from "./Card";

const MAX_POST_LENGTH = 3000;
const MAX_IMAGE_COUNT = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const fileInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of File objects
  const [previews, setPreviews] = useState([]); // Array of { file, url, name, size }
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const charCount = content.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError("");

    // Check count limit
    if (selectedFiles.length + files.length > MAX_IMAGE_COUNT) {
      setError(`You can only upload up to ${MAX_IMAGE_COUNT} images per post.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const validNewFiles = [];
    const newPreviews = [];

    for (const file of files) {
      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setError(`"${file.name}" has an unsupported format. Allowed: JPG, PNG, WEBP.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Validate size limit
      if (file.size > MAX_IMAGE_SIZE) {
        setError(`"${file.name}" exceeds the 5 MB file size limit.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      validNewFiles.push(file);
      newPreviews.push({
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
      });
    }

    setSelectedFiles((prev) => [...prev, ...validNewFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    // Revoke object URL to avoid memory leak
    const item = previews[indexToRemove];
    if (item && item.url) {
      URL.revokeObjectURL(item.url);
    }

    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setPreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !code.trim() && selectedFiles.length === 0) {
      setError("Please write something, share code, or attach an image.");
      return;
    }

    if (isOverLimit) {
      setError(`Post content cannot exceed ${MAX_POST_LENGTH} characters.`);
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

      if (selectedFiles.length > 0) {
        // Send as FormData for multipart upload
        const formData = new FormData();
        formData.append("content", content.trim());
        formData.append("codeBlocks", JSON.stringify(codeBlocks));
        formData.append("tags", JSON.stringify(tags));

        selectedFiles.forEach((file) => {
          formData.append("images", file);
        });

        await onPostCreated(formData);
      } else {
        // Text/code-only post as JSON
        await onPostCreated({
          content: content.trim(),
          codeBlocks,
          tags,
          images: [],
        });
      }

      // Cleanup previews
      previews.forEach((p) => URL.revokeObjectURL(p.url));

      // Reset state
      setContent("");
      setCode("");
      setShowCode(false);
      setSelectedFiles([]);
      setPreviews([]);
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
              rows={3}
              className="textarea"
              style={{
                border: "none",
                padding: "4px 0",
                fontSize: "14px",
                boxShadow: "none",
                background: "transparent",
                width: "100%",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* Selected Image Previews */}
        {previews.length > 0 && (
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
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Attached Images ({previews.length} / {MAX_IMAGE_COUNT})
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Max 5 MB each (JPG, PNG, WEBP)
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                gap: "8px",
              }}
            >
              {previews.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    aspectRatio: "1/1",
                    backgroundColor: "#000",
                  }}
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      background: "rgba(0, 0, 0, 0.65)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      padding: "2px 4px",
                      background: "rgba(0, 0, 0, 0.6)",
                      color: "#fff",
                      fontSize: "9px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.size} MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Tags input */}
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Hash size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Tags (e.g. react, nodejs, webdev)"
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

        {/* Error message */}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              padding: "6px 10px",
              borderRadius: "var(--radius-input)",
              backgroundColor: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              color: "var(--danger)",
              fontSize: "12px",
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Footer toolbar */}
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
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: "none" }}
            />

            <Button
              type="button"
              variant={previews.length > 0 ? "primary" : "ghost"}
              size="sm"
              icon={ImageIcon}
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedFiles.length >= MAX_IMAGE_COUNT}
              title={`Attach images (up to ${MAX_IMAGE_COUNT}, max 5MB each)`}
            >
              Image {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
            </Button>

            <Button
              type="button"
              variant={showCode ? "primary" : "ghost"}
              size="sm"
              icon={Code2}
              onClick={() => setShowCode((prev) => !prev)}
            >
              Code
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Character counter */}
            <span
              style={{
                fontSize: "12px",
                color: isOverLimit
                  ? "var(--danger)"
                  : charCount > 2500
                  ? "var(--warning)"
                  : "var(--text-muted)",
                fontWeight: isOverLimit ? 600 : 400,
              }}
            >
              {charCount} / {MAX_POST_LENGTH}
            </span>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loading}
              icon={Send}
              disabled={
                loading ||
                isOverLimit ||
                (!content.trim() && !code.trim() && selectedFiles.length === 0)
              }
            >
              Publish
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
