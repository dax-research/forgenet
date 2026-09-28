import { Search, X } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  showShortcut = true,
  className = "",
  style = {},
  ...props
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        width: "100%",
        ...style,
      }}
      className={className}
    >
      <Search
        size={14}
        style={{
          position: "absolute",
          left: "10px",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      />

      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input"
        style={{ paddingLeft: "32px", paddingRight: value ? "30px" : showShortcut ? "32px" : "10px" }}
        {...props}
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange({ target: { value: "" } })}
          style={{
            position: "absolute",
            right: "8px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            padding: "2px",
          }}
        >
          <X size={14} />
        </button>
      ) : showShortcut ? (
        <kbd
          style={{
            position: "absolute",
            right: "8px",
            fontSize: "10px",
            background: "var(--surface-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "3px",
            padding: "1px 5px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            pointerEvents: "none",
          }}
        >
          /
        </kbd>
      ) : null}
    </div>
  );
}
