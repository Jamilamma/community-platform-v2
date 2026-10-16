import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { BellIcon, SparklesIcon } from "../../components/icons";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/notifications")
      .then(setNotifications)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id) {
    await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
  }

  return (
    <div>
      <h1>Notifications</h1>
      <p className="page-subtitle">Stay in the loop.</p>

      {loading && <p className="muted-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && notifications.length === 0 && (
        <div className="notif-empty">
          <div className="notif-empty-icon"><BellIcon size={36} /></div>
          <h2>No new <span className="accent">updates</span> yet</h2>
          <p>You'll see your latest notifications here once something new happens.</p>
          <span className="notif-empty-pill"><SparklesIcon size={13} /> Stay connected</span>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="notif-list">
          {notifications.map((n) => (
            <div key={n._id} className={`notif-item ${n.read ? "read" : "unread"}`}>
              <span>{n.message}</span>
              {!n.read && <button onClick={() => markRead(n._id)}>Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}