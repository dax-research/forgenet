import { NavLink } from "react-router-dom";
import {
  Home,
  Compass,
  FolderGit2,
  Users2,
  Briefcase,
  MessageSquare,
  Bell,
  Bookmark,
  UserCheck,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBadges } from "../context/BadgeContext";
import Avatar from "../components/Avatar";

export default function Sidebar({ isOpen, onCloseMobile }) {
  const { user, logout, isAuthenticated } = useAuth();
  const { messagesBadge, notificationsBadge } = useBadges();

  const primaryNav = [
    { label: "Home", path: "/", icon: Home },
    { label: "Explore", path: "/explore", icon: Compass },
    { label: "Projects", path: "/projects", icon: FolderGit2 },
    { label: "Communities", path: "/communities", icon: Users2 },
    { label: "Jobs", path: "/jobs", icon: Briefcase },
    { label: "Messages", path: "/chat", icon: MessageSquare, badge: messagesBadge },
    { label: "Notifications", path: "/notifications", icon: Bell, badge: notificationsBadge },
    { label: "Saved", path: "/saved", icon: Bookmark },
  ];

  const secondaryNav = [
    { label: "Following", path: "/following", icon: UserCheck },
    { label: "Profile", path: "/profile/me", icon: User },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? "mobile-open" : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Main Section */}
        <div className="sidebar-nav-group">
          <p className="sidebar-group-title">Platform</p>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            );
          })}
        </div>

        <div className="sidebar-divider" />

        {/* Account & Personal */}
        <div className="sidebar-nav-group">
          <p className="sidebar-group-title">Personal</p>
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* User profile card or sign-in link */}
      {isAuthenticated && user ? (
        <div className="sidebar-user-card">
          <Avatar
            src={user.profileImage}
            name={user.name}
            size={32}
            online={true}
          />
          <div className="sidebar-user-meta">
            <p className="sidebar-user-name">{user.name}</p>
            <p className="sidebar-user-handle">
              {user.bio ? user.bio.substring(0, 24) + "..." : "Developer"}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Log out"
            style={{ color: "var(--text-muted)", padding: "4px" }}
          >
            <LogOut size={15} />
          </button>
        </div>
      ) : null}
    </aside>
  );
}