import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recent, setRecent] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    apiRequest("/applications/mine").then(setApplications).catch(() => {});
    apiRequest("/notifications").then(setNotifications).catch(() => {});
    apiRequest("/opportunities").then((items) => setRecent(items.slice(0, 4))).catch(() => {});

    Promise.all([
      apiRequest("/workshops/mine").catch(() => []),
      apiRequest("/events/mine").catch(() => []),
      apiRequest("/hackathons/mine").catch(() => []),
    ]).then(([workshopRegs, eventRegs, hackathonRegs]) => {
      const combined = [
        ...workshopRegs.map((r) => ({ type: "Workshop", title: r.workshop?.title, date: r.workshop?.date, mode: r.workshop?.mode })),
        ...eventRegs.map((r) => ({ type: "Event", title: r.event?.title, date: r.event?.date, mode: r.event?.mode })),
        ...hackathonRegs.map((r) => ({ type: "Hackathon", title: r.hackathon?.name, date: r.hackathon?.date, mode: r.hackathon?.mode })),
      ]
        .filter((item) => item.date && new Date(item.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setUpcoming(combined.slice(0, 5));
    });
  }, []);

  const activeApplications = applications.filter((a) => a.status !== "Rejected").slice(0, 5);
  const shortlisted = applications.filter((a) => a.status === "Shortlisted").length;

  const typeColors = {
    internship: "var(--internship)",
    workshop: "var(--workshop)",
    event: "var(--event)",
    hackathon: "var(--hackathon)",
  };

  return (
    <div>
      <div className="hero-banner">
        <span className="hero-eyebrow">✦ Your Growth Hub</span>
        <h1 className="hero-title">
          Explore <span className="accent">Learn</span> <span className="accent">Build</span>
        </h1>
        <p className="hero-subtitle">
          Internships, workshops, events and hackathons — all in one place, {user?.name}. Your next opportunity is just a click away.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat-card"><strong>{applications.length}</strong><span>Applications</span></div>
        <div className="stat-card"><strong>{shortlisted}</strong><span>Shortlisted</span></div>
        <div className="stat-card"><strong>{upcoming.length}</strong><span>Upcoming Activities</span></div>
      </div>

      {recent.length > 0 && (
        <>
          <h2>Featured Opportunities</h2>
          <div className="featured-grid">
            {recent.map((item) => (
              <div className="featured-card" key={`${item.type}-${item.id}`}>
                <div className="featured-icon" style={{ background: typeColors[item.type] || "var(--blue)" }}>
                  {item.title?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="featured-body">
                  <div className="featured-type" style={{ color: typeColors[item.type] || "var(--blue)" }}>{item.type}</div>
                  <div className="featured-title">{item.title}</div>
                  <div className="featured-meta">{item.orgLabel}</div>
                </div>
                <Link to="/student/opportunities" className="featured-arrow" style={{ textDecoration: "none" }}>→</Link>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="dashboard-grid">
        <section>
          <h2>Active Applications</h2>
          {activeApplications.length === 0 ? (
            <p className="muted-text">No active applications. <Link to="/student/opportunities">Explore opportunities</Link>.</p>
          ) : (
            <ul className="dashboard-list">
              {activeApplications.map((a) => (
                <li key={a._id}>
                  <div>
                    <strong>{a.internship?.title}</strong>
                    <div className="org-label">{a.internship?.orgLabel}</div>
                  </div>
                  <span className={`status-pill status-${a.status.replace(/\s/g, "-").toLowerCase()}`}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Upcoming Activities</h2>
          {upcoming.length === 0 ? (
            <p className="muted-text">No upcoming workshops, events or hackathons yet.</p>
          ) : (
            <ul className="dashboard-list">
              {upcoming.map((item, i) => (
                <li key={i}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="org-label">{item.type}</div>
                  </div>
                  <span>{formatDate(item.date)} {item.mode ? `· ${item.mode}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Recent Notifications</h2>
          {notifications.length === 0 ? (
            <p className="muted-text">No notifications yet.</p>
          ) : (
            <ul className="dashboard-list">
              {notifications.slice(0, 5).map((n) => (
                <li key={n._id}><span>{n.message}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Recently Added Opportunities</h2>
          {recent.length === 0 ? (
            <p className="muted-text">No opportunities yet.</p>
          ) : (
            <ul className="dashboard-list">
              {recent.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="org-label">{item.orgLabel}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/student/opportunities">View all opportunities →</Link>
        </section>
      </div>
    </div>
  );
}