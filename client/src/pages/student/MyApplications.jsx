import { useEffect, useState } from "react";
import { apiRequest, openFileInline } from "../../services/api";
import StatusTimeline from "../../components/StatusTimeline";
import { resumeDownloadUrl } from "../../utils/resume";

const TABS = ["All", "Applied", "Under Review", "Shortlisted", "Selected", "Rejected"];

export default function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [tab, setTab] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    apiRequest("/applications/mine").then(setApplications).catch(() => {});
  }, []);

  const visible = tab === "All" ? applications : applications.filter((a) => a.status === tab);

  return (
    <div>
      <h1>My Applications</h1>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? "tab-btn-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <h3>No applications yet.</h3>
          <p>Start exploring opportunities and apply for your next experience.</p>
        </div>
      ) : (
        <div className="applications-list">
          {visible.map((a) => (
            <div className="application-row" key={a._id}>
              <div
                className="application-summary"
                onClick={() => setExpandedId(expandedId === a._id ? null : a._id)}
              >
                <div>
                  <strong>{a.internship?.title}</strong>
                  <div className="org-label">{a.internship?.orgLabel}</div>
                </div>
                <div className="application-summary-right">
                  <span className={`status-pill status-${a.status.replace(/\s/g, "-").toLowerCase()}`}>{a.status}</span>
                  <span className="expand-arrow">{expandedId === a._id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expandedId === a._id && (
                <div className="application-details">
                  <div className="application-meta-grid">
                    <span>Applied: {new Date(a.createdAt).toLocaleDateString()}</span>
                    <span>Last updated: {new Date(a.updatedAt).toLocaleDateString()}</span>
                    {a.resumeUrl && (
                      <span>
                        <button className="link-btn" onClick={() => openFileInline(a.resumeUrl).catch((err) => alert(err.message))}>View submitted resume</button>
                        {" | "}
                        <a href={resumeDownloadUrl(a.resumeUrl, a.resumeName)}>Download</a>
                      </span>
                    )}
                  </div>
                  <StatusTimeline application={a} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}