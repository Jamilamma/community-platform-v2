import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { SearchIcon, BellIcon, ChevronDownIcon } from "./icons";

export default function TopBar({ searchPlaceholder = "Search internships, events, workshops…" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef(null);
  const isStaff = user?.role === "staff";

  useEffect(() => {
    apiRequest("/notifications")
      .then((list) => setUnread(list.filter((n) => !n.read).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/${isStaff ? "staff" : "student"}/opportunities?search=${encodeURIComponent(query)}`);
  }

  return (
    <header className="topbar">
      {!isStaff ? (
        <form className="topbar-search" onSubmit={handleSearchSubmit}>
          <SearchIcon size={16} />
          <input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      ) : <div />}

      <div className="topbar-right">
        <button
          className="topbar-bell"
          onClick={() => navigate(`/${isStaff ? "staff" : "student"}/notifications`)}
          aria-label="Notifications"
        >
          <BellIcon size={18} />
          {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>

        <div className="topbar-user" ref={menuRef}>
          <button className="topbar-user-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="topbar-avatar">{user?.name?.[0]?.toUpperCase() || "?"}</span>
            <span className="topbar-user-text">
              <strong>{user?.name}</strong>
              <em>{user?.role}</em>
            </span>
            <ChevronDownIcon size={14} />
          </button>
          {menuOpen && (
            <div className="topbar-menu">
              <button onClick={() => navigate(`/${isStaff ? "staff" : "student"}/profile`)}>
                {isStaff ? "Dashboard" : "Profile"}
              </button>
              <button onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}