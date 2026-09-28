export default function Card({
  children,
  header,
  footer,
  hoverable = false,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={`card ${hoverable ? "card-hover" : ""} ${className}`}
      style={style}
      {...props}
    >
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}