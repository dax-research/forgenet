export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  required = false,
  disabled = false,
  helper,
  error,
  icon: Icon,
  className = "",
  rows,
  ...props
}) {
  const isTextarea = type === "textarea" || rows !== undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={name} className="form-label">
          {label}
          {required && <span style={{ color: "var(--danger)", marginLeft: "3px" }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative", width: "100%" }}>
        {Icon && !isTextarea && (
          <div
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            <Icon size={15} />
          </div>
        )}

        {isTextarea ? (
          <textarea
            id={name}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            rows={rows || 3}
            className="textarea"
            style={error ? { borderColor: "var(--danger)" } : {}}
            {...props}
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className="input"
            style={{
              paddingLeft: Icon ? "32px" : "10px",
              borderColor: error ? "var(--danger)" : undefined,
            }}
            {...props}
          />
        )}
      </div>

      {error ? (
        <span className="form-error">{error}</span>
      ) : helper ? (
        <span className="form-helper">{helper}</span>
      ) : null}
    </div>
  );
}