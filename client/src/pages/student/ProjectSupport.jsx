import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  STAGES, SUPPORT_TYPES, DOMAINS, StatusPill, formatDate,
  ProjectSupportTimeline, ProjectSupportThread,
} from "../../components/ProjectSupportShared";

const EMPTY_FORM = {
  title: "", description: "", domain: DOMAINS[0], projectStage: STAGES[0],
  supportType: SUPPORT_TYPES[0], investmentRequired: "", demoLink: "", message: "",
};

export default function StudentProjectSupport() {
  const { user } = useAuth();
  const myId = user?._id || user?.id;

  const [tab, setTab] = useState("mine"); // "mine" | "new"
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    return apiRequest("/project-support/mine")
      .then((list) => { setRequests(list); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const needsInvestment = form.supportType !== "Guidance";

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setOk("");
    try {
      await apiRequest("/project-support", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY_FORM);
      setOk("Request submitted. Xentwin Technologies staff will pick it up soon.");
      await load();
      setTab("mine");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedId) {
    return <StudentRequestDetails id={selectedId} myId={myId} onBack={() => { setSelectedId(null); load(); }} />;
  }

  return (
    <div>
      <h1>Project Support</h1>
      <p className="page-subtitle">Get guidance or investment support for your project from Xentwin Technologies.</p>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === "mine" ? "tab-btn-active" : ""}`} onClick={() => setTab("mine")}>
          My Requests ({requests.length})
        </button>
        <button className={`tab-btn ${tab === "new" ? "tab-btn-active" : ""}`} onClick={() => { setTab("new"); setOk(""); }}>
          New Request
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {ok && <p className="ps-note-ok">{ok}</p>}

      {tab === "new" ? (
        <form className="ps-card ps-form" onSubmit={submit}>
          <label className="ps-full">
            Project Title
            <input value={form.title} onChange={set("title")} required maxLength={120} placeholder="e.g. Smart attendance tracker" />
          </label>

          <label className="ps-full">
            Description
            <textarea rows={5} value={form.description} onChange={set("description")} required
              placeholder="What problem does it solve, what have you built so far, what tech are you using?" />
          </label>

          <label>
            Domain
            <select value={form.domain} onChange={set("domain")}>
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label>
            Project Stage
            <select value={form.projectStage} onChange={set("projectStage")}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            Support Type
            <select value={form.supportType} onChange={set("supportType")}>
              {SUPPORT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          {needsInvestment && (
            <label>
              Investment Required
              <input value={form.investmentRequired} onChange={set("investmentRequired")} required
                placeholder="e.g. ₹50,000 for cloud + hardware" />
            </label>
          )}

          <label className="ps-full">
            GitHub / Demo Link (optional)
            <input type="url" value={form.demoLink} onChange={set("demoLink")} placeholder="https://github.com/you/project" />
          </label>

          <label className="ps-full">
            Message to Staff (optional)
            <textarea rows={3} value={form.message} onChange={set("message")} placeholder="Anything else the reviewer should know?" />
          </label>

          <div className="ps-full">
            <button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit Request"}</button>
          </div>
        </form>
      ) : loading ? (
        <p className="muted-text">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>No requests yet.</h3>
          <p>Submit your first project for guidance or investment support.</p>
          <button onClick={() => setTab("new")}>New Request</button>
        </div>
      ) : (
        <div className="ps-table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Support</th><th>Stage</th><th>Status</th><th>Reviewer</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id} className="ps-clickable" onClick={() => setSelectedId(r._id)}>
                  <td><strong>{r.title}</strong><br /><small>{r.domain}</small></td>
                  <td><span className="mode-pill">{r.supportType}</span></td>
                  <td>{r.projectStage}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>{r.staff?.name || <small>Waiting for staff</small>}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td><button className="link-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(r._id); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StudentRequestDetails({ id, myId, onBack }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/project-support/${id}`).then(setD).catch((err) => setError(err.message));
  }, [id]);

  function setMessages(updater) {
    setD((prev) => (prev ? { ...prev, messages: typeof updater === "function" ? updater(prev.messages) : updater } : prev));
  }

  if (!d) {
    return (
      <div>
        <button className="secondary-btn ps-back" onClick={onBack}>← Back to my requests</button>
        {error ? <p className="error-text">{error}</p> : <p className="muted-text">Loading…</p>}
      </div>
    );
  }

  const completed = d.status === "Completed";

  return (
    <div>
      <button className="secondary-btn ps-back" onClick={onBack}>← Back to my requests</button>

      <div className="ps-title-row">
        <h1>{d.title}</h1>
        <StatusPill status={d.status} />
        <span className="mode-pill">{d.supportType}</span>
      </div>
      <p className="page-subtitle">{d.orgLabel}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        <div className="ps-card"><ProjectSupportTimeline request={d} history={d.history} /></div>

        <div className="ps-card">
          <h3>Request Details</h3>
          <div className="ps-kv">
            <div><label>Domain</label>{d.domain}</div>
            <div><label>Project Stage</label>{d.projectStage}</div>
            <div><label>Support Type</label>{d.supportType}</div>
            {d.supportType !== "Guidance" && <div><label>Investment Required</label>{d.investmentRequired || "-"}</div>}
            <div><label>Submitted</label>{formatDate(d.createdAt)}</div>
            <div><label>Reviewer</label>{d.staff?.name || "Waiting for staff"}</div>
            {d.demoLink && <div><label>GitHub / Demo</label><a href={d.demoLink} target="_blank" rel="noreferrer">{d.demoLink}</a></div>}
          </div>
          <h3 style={{ marginTop: 16 }}>Description</h3>
          <p className="ps-text">{d.description}</p>
        </div>

        {d.guidanceFeedback && (
          <div className="ps-card">
            <h3>Guidance / Feedback</h3>
            <p className="ps-text">{d.guidanceFeedback}</p>
          </div>
        )}
        {d.investmentNotes && (
          <div className="ps-card">
            <h3>Investment Decision / Notes</h3>
            <p className="ps-text">{d.investmentNotes}</p>
          </div>
        )}

        <ProjectSupportThread
          requestId={d._id}
          messages={d.messages || []}
          setMessages={setMessages}
          history={d.history || []}
          canReply={!completed}
          currentUserId={myId}
          placeholder="Write to the Xentwin team…"
          replyLabel="Send"
        />
        {completed && <p className="ps-empty-note">This request is completed, so replies are closed.</p>}
      </div>
    </div>
  );
}