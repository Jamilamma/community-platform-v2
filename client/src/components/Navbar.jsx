import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NAV_ICON, LogOutIcon, SparklesIcon, ChevronDownIcon } from "./icons";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

export default function Navbar({ links }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(() => new Set());

  // Auto-expand a group on first load if the current page is one of its children.
  useEffect(() => {
    const toOpen = links
      .filter((l) => l.children?.some((c) => location.pathname.startsWith(c.to)))
      .map((l) => l.label);
    if (toOpen.length) setOpenGroups((prev) => new Set([...prev, ...toOpen]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGroup(label) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="XenTwin" className="brand-mark" />
        <span className="brand-wordmark">
          <img src="/xentwin-wordmark.png" alt="XenTwin" className="brand-wordmark-top" />
          <img src="/technologies-wordmark.png" alt="Technologies" className="brand-wordmark-bottom" />
        </span>
      </div>

      <div className="sidebar-nav">
        {links.map((link) => {
          const Icon = NAV_ICON[link.label] || SparklesIcon;

          if (link.children) {
            const isOpen = openGroups.has(link.label);
            const childActive = link.children.some((c) => location.pathname.startsWith(c.to));
            return (
              <div className="sidebar-group" key={link.label}>
                <button
                  type="button"
                  className={`sidebar-link sidebar-group-toggle ${childActive ? "active" : ""}`}
                  onClick={() => toggleGroup(link.label)}
                >
                  <Icon size={17} />
                  <span>{link.label}</span>
                  <ChevronDownIcon size={14} className={`sidebar-chevron ${isOpen ? "open" : ""}`} />
                </button>
                {isOpen && (
                  <div className="sidebar-submenu">
                    {link.children.map((child) => {
                      const ChildIcon = NAV_ICON[child.label] || SparklesIcon;
                      return (
                        <NavLink key={child.to} to={child.to} className="sidebar-sublink">
                          <ChildIcon size={15} />
                          <span>{child.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/staff" || link.to === "/student"}
              className="sidebar-link"
            >
              <Icon size={17} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="sidebar-promo">
        <SparklesIcon size={16} />
        <span>Better Skills.<br />Bigger Opportunities.</span>
      </div>

      <button className="logout-btn" onClick={logout}>
        <LogOutIcon size={16} />
        <span>Logout</span>
      </button>

      <div className="sidebar-user-chip">
        <span className="sidebar-avatar">{initials(user?.name)}</span>
        <span className="sidebar-user-text">
          <strong>{user?.name}</strong>
          <em>{user?.role}</em>
        </span>
      </div>
    </nav>
  );
}