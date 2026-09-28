export default function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "var(--radius-btn)",
  className = "",
  style = {},
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}
