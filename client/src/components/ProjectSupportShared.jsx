import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { getSocket } from "../services/socket";
import "../pages/projectSupport.css";

export const STAGES = ["Idea", "Prototype", "MVP", "Beta", "Live"];
export const SUPPORT_TYPES = ["Guidance", "Investment", "Both"];
export const DOMAINS = [
  "Web Development", "Mobile App", "AI / Machine Learning", "Data Science", "IoT / Embedded",
  "Cybersecurity", "Blockchain", "Cloud / DevOps", "AR / VR", "FinTech", "HealthTech", "EdTech", "Other",
];

// reuse the existing status-pill colour classes
const STATUS_CLASS = {
  Pending: "status-applied",
  "In Review": "status-under-review",
  Accepted: "status-selected",
  Rejected: "status-rejected",
  Completed: "status-shortlisted",
};

export function StatusPill({ status }) {
  return <span className={`status-pill ${STATUS_CLASS[status] || "status-applied"}`}>{status}</span>;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// Returns the shared app socket, reconnecting it if another page disconnected it
// (the Community page disconnects on unmount).
export function liveSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

// Pending -> In Review -> Accepted / Rejected -> Completed, with dates taken from the real history log.
export function ProjectSupportTimeline({ request, history = [] }) {
  const decision = request.status === "Rejected" ? "Rejected" : "Accepted";
  const steps = ["Pending", "In Review", decision, "Completed"];
  const rank = { Pending: 0, "In Review": 1, Accepted: 2, Rejected: 2, Completed: 3 };
  const current = rank[request.status] ?? 0;

  function dateFor(step) {
    const hits = history.filter((h) => h.toStatus === step);
    const last = hits[hits.length - 1];
    if (last) return formatDate(last.createdAt);
    return step === "Pending" ? formatDate(request.createdAt) : "—";
  }

  return (
    <div className="status-timeline">
      {steps.map((step, i) => {
        let symbol = "○";
        let dateLabel = "—";
        if (i < current) { symbol = "✓"; dateLabel = dateFor(step); }
        else if (i === current) { symbol = step === "Rejected" ? "✕" : "●"; dateLabel = dateFor(step); }
        return (
          <div className={`timeline-step ${i <= current ? "timeline-step-done" : ""}`} key={step}>
            <span className="timeline-symbol">{symbol}</span>
            <span className="timeline-label">{step === "Accepted" && current < 2 ? "Accepted / Rejected" : step}</span>
            <span className="timeline-date">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// Conversation (student <-> staff) + request history.
// canReply=false hides the composer (e.g. staff who haven't taken the request, or a completed request).
export function ProjectSupportThread({
  requestId, messages, setMessages, history, canReply, replyLabel = "Send", currentUserId, placeholder,
}) {
  const [tab, setTab] = useState("conversation");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // live messages from the other side
  useEffect(() => {
    const socket = liveSocket();
    function onMessage({ requestId: rid, message }) {
      if (rid !== requestId) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
    }
    socket.on("project-support:message", onMessage);
    return () => socket.off("project-support:message", onMessage);
  }, [requestId, setMessages]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      const created = await apiRequest(`/project-support/${requestId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setMessages((prev) => (prev.some((m) => m._id === created._id) ? prev : [...prev, created]));
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ps-card">
      <div className="ps-thread-tabs">
        <button type="button" className={`tab-btn ${tab === "conversation" ? "tab-btn-active" : ""}`} onClick={() => setTab("conversation")}>
          Conversation ({messages.length})
        </button>
        <button type="button" className={`tab-btn ${tab === "history" ? "tab-btn-active" : ""}`} onClick={() => setTab("history")}>
          Request History ({history.length})
        </button>
      </div>

      {tab === "conversation" ? (
        <>
          {messages.length === 0 ? (
            <p className="ps-empty-note" style={{ marginBottom: 12 }}>No messages yet.</p>
          ) : (
            <div className="ps-messages">
              {messages.map((m) => (
                <div className={`ps-bubble ${m.sender?._id === currentUserId ? "mine" : ""}`} key={m._id}>
                  <div className="ps-bubble-meta">
                    <strong>{m.sender?.name || "User"}</strong>
                    {m.sender?.role === "staff" && <span className="ps-staff-tag">Xentwin Staff</span>}
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
          )}

          {canReply && (
            <form className="ps-reply" onSubmit={send}>
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder || "Write a message…"}
              />
              <button type="submit" disabled={sending || !text.trim()}>{sending ? "Sending…" : replyLabel}</button>
            </form>
          )}
          {error && <p className="error-text">{error}</p>}
        </>
      ) : history.length === 0 ? (
        <p className="ps-empty-note">No history yet.</p>
      ) : (
        <ul className="ps-history">
          {history.map((h) => (
            <li key={h._id}>
              <time>{formatDateTime(h.createdAt)}</time>
              <div className="ps-history-body">
                <strong>{h.action}</strong>
                {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus && <> — {h.fromStatus} → {h.toStatus}</>}
                {h.actor?.name && <> <em>by {h.actor.name}</em></>}
                {h.note && <div><em>{h.note}</em></div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
