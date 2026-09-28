export default function Badge({
  children,
  variant = "default",
  className = "",
  icon: Icon,
  onClick,
  style = {},
}) {
  const variantClass = variant !== "default" ? `badge-${variant}` : "";

  return (
    <span
      className={`badge ${variantClass} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", ...style }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
