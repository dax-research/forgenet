import { useState } from "react";

/**
 * An <img> that degrades gracefully.
 *
 * If the source fails to load, the broken-image icon is replaced with a neutral
 * placeholder block. Card dimensions are preserved because the wrapper keeps
 * the same box, and a single broken image never breaks the surrounding
 * component.
 */
export default function SafeImage({
  src,
  alt = "",
  className = "",
  style = {},
  fallbackLabel = "Image unavailable",
  loading,
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={className}
        role="img"
        aria-label={fallbackLabel}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "60px",
          padding: "8px",
          textAlign: "center",
          fontSize: "11px",
          color: "var(--text-muted)",
          backgroundColor: "var(--surface-secondary, #f6f8fa)",
          ...style,
        }}
      >
        {fallbackLabel}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
      style={style}
      {...rest}
    />
  );
}