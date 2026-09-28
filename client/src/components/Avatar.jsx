export default function Avatar({
  src,
  name = "User",
  size = 32,
  online = null, // true | false | null
  className = "",
  style = {},
}) {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const fontSize = Math.max(10, Math.floor(size * 0.38));

  return (
    <div
      className={`avatar-wrapper ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, ...style }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="avatar-img"
          style={{ width: `${size}px`, height: `${size}px` }}
          onError={(e) => {
            // Fallback on broken image link
            e.currentTarget.style.display = "none";
            e.currentTarget.nextSibling.style.display = "flex";
          }}
        />
      ) : null}

      <div
        className="avatar-fallback"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${fontSize}px`,
          display: src ? "none" : "flex",
        }}
      >
        {initials}
      </div>

      {online === true && <span className="avatar-online-dot" title="Online" />}
      {online === false && <span className="avatar-offline-dot" title="Offline" />}
    </div>
  );
}