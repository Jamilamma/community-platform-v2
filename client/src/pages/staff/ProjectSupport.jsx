import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  SUPPORT_TYPES, StatusPill, formatDate, liveSocket,
  ProjectSupportTimeline, ProjectSupportThread,
} from "../../components/ProjectSupportShared";

const STATUSES = ["Pending", "In Review", "Accepted", "Rejected", "Completed"];

// ---------------------------------------------------------------------------
// STAFF: see every request a student sends, take it, and reply.
// (Staff do NOT create requests — only students do.)
// ---------------------------------------------------------------------------
export default function StaffProjectSupport() {
  const { user } = useAuth();
  const myId = user?._id || user?.id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [takingId, setTakingId] = useState(null);

  const [scope, setScope] = useState("all"); // all | unassigned | mine
  const [supportType, setSupportType] = useState("");
  const [status, setStatus] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (scope !== "all") params.set("scope", scope);
    if (supportType) params.set("supportType", supportType);
    if (status) params.set("status", status);
    const qs = params.toString();
    return apiRequest(`/project-support${qs ? `?${qs}` : ""}`)
      .then((list) => { setRequests(list); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [scope, supportType, status]);

  // a student just submitted a new request -> refresh the list live
  useEffect(() => {
    const socket = liveSocket();
    const onNew = () => load();
    socket.on("project-support:new", onNew);
    return () => socket.off("project-support:new", onNew);
    // eslint-disable-next-line
  }, [scope, supportType, status]);

  async function take(id) {
    setTakingId(id);
    setError("");
    try {
      await apiRequest(`/project-support/${id}/take`, { method: "POST" });
      await load();
      setSelectedId(id); // open it straight away so staff can reply
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setTakingId(null);
    }
  }

  const stats = useMemo(() => {
    const count = (s) => requests.filter((r) => r.status === s).length;
    return { total: requests.length, ...Object.fromEntries(STATUSES.map((s) => [s, count(s)])) };
  }, [requests]);

  if (selectedId) {
    return (
      <StaffRequestDetails
        id={selectedId}
        myId={myId}
        onTake={take}
        onBack={() => { setSelectedId(null); load(); }}
      />
    );
  }

  return (
    <div>
      <h1>Project Support</h1>
      <p className="page-subtitle">Project requests submitted by students. Take a request to review it and reply.</p>

      <div className="ps-stats">
        <div className="ps-stat"><strong>{stats.total}</strong><span>Total</span></div>
        {STATUSES.map((s) => <div className="ps-stat" key={s}><strong>{stats[s]}</strong><span>{s}</span></div>)}
      </div>

      <div className="tab-bar">
        {[["all", "All Requests"], ["unassigned", "Unassigned"], ["mine", "Assigned to me"]].map(([key, label]) => (
          <button key={key} className={`tab-btn ${scope === key ? "tab-btn-active" : ""}`} onClick={() => setScope(key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
        <select value={supportType} onChange={(e) => setSupportType(e.target.value)}>
          <option value="">All support types</option>
          {SUPPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted-text">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>No requests found.</h3>
          <p>When a student submits a project support request, it will appear here.</p>
        </div>
      ) : (
        <div className="ps-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Project</th><th>Support</th><th>Stage</th>
                <th>Status</th><th>Reviewer</th><th>Submitted</th><th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const canTake = r.status === "Pending" && !r.assignedStaffId;
                return (
                  <tr key={r._id} className="ps-clickable" onClick={() => setSelectedId(r._id)}>
                    <td><strong>{r.student?.name || "-"}</strong><br /><small>{r.student?.email}</small></td>
                    <td><strong>{r.title}</strong><br /><small>{r.domain}</small></td>
                    <td><span className="mode-pill">{r.supportType}</span></td>
                    <td>{r.projectStage}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.staff?.name || <small>Unassigned</small>}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canTake ? (
                        <button disabled={takingId === r._id} onClick={() => take(r._id)}>
                          {takingId === r._id ? "Taking…" : "Take"}
                        </button>
                      ) : (
                        <button className="link-btn" onClick={() => setSelectedId(r._id)}>View</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StaffRequestDetails({ id, myId, onBack, onTake }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [guidance, setGuidance] = useState("");
  const [investment, setInvestment] = useState("");
  const [newStatus, setNewStatus] = useState("In Review");
  const [statusNote, setStatusNote] = useState("");

  function fetchDetails() {
    return apiRequest(`/project-support/${id}`)
      .then((data) => {
        setD(data);
        setGuidance(data.guidanceFeedback || "");
        setInvestment(data.investmentNotes || "");
        if (["In Review", "Accepted", "Rejected"].includes(data.status)) setNewStatus(data.status);
      })
      .catch((err) => setError(err.message));
  }
  useEffect(() => { fetchDetails(); /* eslint-disable-next-line */ }, [id]);

  function setMessages(updater) {
    setD((prev) => (prev ? { ...prev, messages: typeof updater === "function" ? updater(prev.messages) : updater } : prev));
  }

  async function run(fn, success) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await fn();
      await fetchDetails();
      if (success) setOk(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const patch = (path, body) =>
    apiRequest(`/project-support/${id}/${path}`, { method: "PATCH", body: JSON.stringify(body) });

  if (!d) {
    return (
      <div>
        <button className="secondary-btn ps-back" onClick={onBack}>← Back to requests</button>
        {error ? <p className="error-text">{error}</p> : <p className="muted-text">Loading…</p>}
      </div>
    );
  }

  const completed = d.status === "Completed";
  const unassigned = !d.assignedStaffId;
  const isMine = d.assignedStaffId === myId;
  const canAct = isMine && !completed;
  const decided = ["Accepted", "Rejected"].includes(d.status);

  return (
    <div>
      <button className="secondary-btn ps-back" onClick={onBack}>← Back to requests</button>

      <div className="ps-title-row">
        <h1>{d.title}</h1>
        <StatusPill status={d.status} />
        <span className="mode-pill">{d.supportType}</span>
      </div>
      <p className="page-subtitle">
        {unassigned ? "Not assigned yet" : isMine ? "Assigned to you" : `Assigned to ${d.staff?.name || "another staff member"}`}
      </p>

      {error && <p className="error-text">{error}</p>}
      {ok && <p className="ps-note-ok">{ok}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {unassigned && !completed && (
          <div className="ps-card">
            <h3>Take this request</h3>
            <p className="ps-text" style={{ marginBottom: 12 }}>
              Take it to become the reviewer. You can then reply to the student and update the status.
            </p>
            <button disabled={busy} onClick={() => onTake(d._id)}>Take Request</button>
          </div>
        )}
        {!unassigned && !isMine && !completed && (
          <div className="ps-card">
            <p className="ps-empty-note">Only {d.staff?.name || "the assigned staff member"} can reply or update this request.</p>
          </div>
        )}

        <div className="ps-card"><ProjectSupportTimeline request={d} history={d.history} /></div>

        <div className="ps-card">
          <h3>Student</h3>
          <div className="ps-kv">
            <div><label>Name</label>{d.student?.name || "-"}</div>
            <div><label>Email</label>{d.student?.email || "-"}</div>
            <div><label>Phone</label>{d.student?.phone || "-"}</div>
            <div><label>University</label>{d.student?.university || "-"}</div>
            <div><label>Course</label>{d.student?.course || "-"}</div>
            <div><label>Year</label>{d.student?.year || "-"}</div>
          </div>
        </div>

        <div className="ps-card">
          <h3>Request Details</h3>
          <div className="ps-kv">
            <div><label>Domain</label>{d.domain}</div>
            <div><label>Project Stage</label>{d.projectStage}</div>
            <div><label>Support Type</label>{d.supportType}</div>
            {d.supportType !== "Guidance" && <div><label>Investment Required</label>{d.investmentRequired || "-"}</div>}
            <div><label>Submitted</label>{formatDate(d.createdAt)}</div>
            {d.demoLink && <div><label>GitHub / Demo</label><a href={d.demoLink} target="_blank" rel="noreferrer">{d.demoLink}</a></div>}
          </div>
          <h3 style={{ marginTop: 16 }}>Description</h3>
          <p className="ps-text">{d.description}</p>
          {d.message && (
            <>
              <h3 style={{ marginTop: 16 }}>Message from student</h3>
              <p className="ps-text">{d.message}</p>
            </>
          )}
        </div>

        {canAct && (
          <div className="ps-card ps-actions">
            <h3>Review &amp; Respond</h3>

            {d.supportType !== "Investment" && (
              <>
                <label>
                  Guidance / Feedback (student can see this)
                  <textarea rows={4} value={guidance} onChange={(e) => setGuidance(e.target.value)} placeholder="Write your guidance for the student…" />
                </label>
                <div>
                  <button disabled={busy} onClick={() => run(() => patch("notes", { guidanceFeedback: guidance }), "Guidance saved and student notified.")}>
                    Save Guidance
                  </button>
                </div>
              </>
            )}

            {d.supportType !== "Guidance" && (
              <>
                <label>
                  Investment Decision / Notes (student can see this)
                  <textarea rows={4} value={investment} onChange={(e) => setInvestment(e.target.value)} placeholder="Write your investment decision or notes…" />
                </label>
                <div>
                  <button disabled={busy} onClick={() => run(() => patch("notes", { investmentNotes: investment }), "Investment notes saved and student notified.")}>
                    Save Investment Notes
                  </button>
                </div>
              </>
            )}

            <div className="ps-action-row">
              <label>
                Status
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {["In Review", "Accepted", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Note (optional)
                <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Reason / comment" />
              </label>
              <button
                disabled={busy || newStatus === d.status}
                onClick={() => run(async () => { await patch("status", { status: newStatus, note: statusNote }); setStatusNote(""); }, `Status changed to ${newStatus}.`)}
              >
                Update Status
              </button>
            </div>

            {decided && (
              <div>
                <button className="btn-success" disabled={busy}
                  onClick={() => run(() => apiRequest(`/project-support/${id}/complete`, { method: "POST" }), "Request marked as completed.")}>
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        )}

        {completed && d.guidanceFeedback && (
          <div className="ps-card"><h3>Guidance / Feedback</h3><p className="ps-text">{d.guidanceFeedback}</p></div>
        )}
        {completed && d.investmentNotes && (
          <div className="ps-card"><h3>Investment Decision / Notes</h3><p className="ps-text">{d.investmentNotes}</p></div>
        )}

        <ProjectSupportThread
          requestId={d._id}
          messages={d.messages || []}
          setMessages={setMessages}
          history={d.history || []}
          canReply={canAct}
          currentUserId={myId}
          placeholder="Reply to the student…"
          replyLabel="Send Reply"
        />
        {completed && <p className="ps-empty-note">This request is completed, so replies are closed.</p>}
      </div>
    </div>
  );
}