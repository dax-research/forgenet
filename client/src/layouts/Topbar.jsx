import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Code2,
  Search,
  Bell,
  MessageSquare,
  Compass,
  Menu,
  X,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import Dropdown from "../components/Dropdown";
import { notificationsService } from "../services/notifications.service";

export default function Topbar({ onToggleMobileSidebar, isMobileSidebarOpen }) {
  const { user, logout, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      notificationsService
        .getNotifications({ limit: 20 })
        .then((res) => {
          if (isMounted && res.success && res.data?.notifications) {
            const unread = res.data.notifications.filter((n) => !n.read).length;
            setUnreadCount(unread);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, location.pathname]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="topbar-container">
      {/* Left */}
      <div className="topbar-left">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="topbar-icon-btn"
          style={{ display: "none" }}
          id="mobile-menu-toggle"
          aria-label="Toggle Navigation"
        >
          {isMobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <Link to="/" className="topbar-logo">
          <div className="topbar-logo-icon">
            <Code2 size={16} strokeWidth={2.5} />
          </div>
          <span>ForgeNet</span>
        </Link>

        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="topbar-search-wrapper">
          <Search size={14} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Search ForgeNet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="topbar-search-input"
          />
          <kbd className="topbar-search-kbd">/</kbd>
        </form>
      </div>

      {/* Right */}
      <div className="topbar-right">
        <Link
          to="/explore"
          className={`topbar-nav-link ${
            location.pathname === "/explore" ? "active" : ""
          }`}
        >
          <Compass size={16} />
          <span>Explore</span>
        </Link>

        {isAuthenticated ? (
          <>
            <Link
              to="/notifications"
              className={`topbar-icon-btn ${
                location.pathname === "/notifications" ? "active" : ""
              }`}
              title="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && <span className="topbar-badge-dot" />}
            </Link>

            <Link
              to="/chat"
              className={`topbar-icon-btn ${
                location.pathname === "/chat" ? "active" : ""
              }`}
              title="Messages"
            >
              <MessageSquare size={17} />
            </Link>

            {/* User Dropdown */}
            <Dropdown
              trigger={
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Avatar
                    src={user?.profileImage}
                    name={user?.name}
                    size={28}
                  />
                </div>
              }
              align="right"
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <p style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                  {user?.name}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {user?.email}
                </p>
              </div>

              <Link to="/profile/me" className="dropdown-item">
                <User size={14} />
                <span>Your Profile</span>
              </Link>

              <Link to="/settings" className="dropdown-item">
                <Settings size={14} />
                <span>Settings</span>
              </Link>

              <div className="dropdown-divider" />

              <button
                type="button"
                onClick={handleLogout}
                className="dropdown-item"
                style={{ color: "var(--danger)" }}
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </Dropdown>
          </>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <Link to="/login" className="btn btn-secondary btn-sm">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}