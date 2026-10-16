import { useEffect, useRef, useState } from "react";
import { apiRequest, uploadFile } from "../../services/api";
import { TrashIcon, UploadIcon } from "../../components/icons";

const MODES = ["Online", "Offline", "Hybrid"];
const LEGACY_MODES = { Remote: "Online", "On-site": "Offline" };
const normalizeMode = (m) => LEGACY_MODES[m] || (MODES.includes(m) ? m : "Online");

// Same rules the backend enforces on /upload/poster.
const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POSTER_MAX_BYTES = 5 * 1024 * 1024;

const empty = { name: "", theme: "", description: "", date: "", teamSize: "", mode: "Online", venue: "", meetingLink: "", prizeInfo: "", rules: "", eligibility: "", registrationDeadline: "", posterUrl: "" };

// Dates are stored as UTC midnight. Formatting in UTC keeps the same
// locale format as before but stops the day shifting for users west of UTC.
function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" });
}

function byDate(a, b) {
  return new Date(a.date) - new Date(b.date); // same order as the backend (date asc)
}

/* ------------------------------------------------------------------ */
/* Delete confirmation dialog (styled, replaces window.confirm)        */
/* ------------------------------------------------------------------ */
function ConfirmDeleteDialog({ hackathon, deleting, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  // Focus Cancel first (safe default for a destructive prompt), lock page
  // scroll, and hand focus back when the dialog closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else document.getElementById("hk-page-title")?.focus();
    };
  }, []);

  // While the request runs the buttons are disabled; keep focus inside the dialog.
  useEffect(() => {
    if (deleting) dialogRef.current?.focus();
  }, [deleting]);

  // Escape closes (unless deleting); Tab is trapped inside the dialog.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && !deleting) {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button:not([disabled])");
        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleting, onCancel]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="modal-box hk-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hk-confirm-title"
        aria-describedby="hk-confirm-desc"
        tabIndex={-1}
      >
        <div className="hk-confirm-icon" aria-hidden="true"><TrashIcon size={22} /></div>
        <h2 id="hk-confirm-title">Delete Hackathon?</h2>
        <p id="hk-confirm-desc">
          Are you sure you want to delete this hackathon? This action cannot be undone.
        </p>
        <p className="hk-confirm-target">{hackathon.name}</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" ref={cancelRef} className="secondary-btn" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger-solid" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function StaffHackathons() {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const [viewingRegsFor, setViewingRegsFor] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [posterName, setPosterName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0); // remounts the file input to clear it
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const formCardRef = useRef(null);
  const nameInputRef = useRef(null);
  const posterInputRef = useRef(null);
  const submittingRef = useRef(false); // blocks double-submits before state re-renders
  const regsRequestRef = useRef(0);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      setHackathons(await apiRequest("/hackathons"));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Success messages dismiss themselves; errors stay until replaced.
  useEffect(() => {
    if (notice?.type !== "success") return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function setField(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function resetForm() {
    setForm(empty);
    setEditingId(null);
    setFormError("");
    setPosterError("");
    setPosterName("");
    setFileInputKey((k) => k + 1);
  }

  function scrollToForm() {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    formCardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    nameInputRef.current?.focus({ preventScroll: true });
  }

  async function handlePosterChange(e) {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be picked again after Remove
    if (!file) return;
    setPosterError("");
    if (!POSTER_TYPES.includes(file.type)) {
      setPosterError("Only JPG, PNG or WEBP images are allowed.");
      return;
    }
    if (file.size > POSTER_MAX_BYTES) {
      setPosterError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("poster", file);
      const { posterUrl } = await uploadFile("/upload/poster", fd);
      setForm((f) => ({ ...f, posterUrl }));
      setPosterName(file.name);
    } catch (err) {
      setPosterError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removePoster() {
    setForm((f) => ({ ...f, posterUrl: "" }));
    setPosterName("");
    setPosterError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submittingRef.current || uploading) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    setNotice(null);

    const wasEditing = Boolean(editingId);
    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      // Clear whichever field doesn't apply, so switching mode never leaves stale data behind.
      venue: form.mode === "Online" ? "" : form.venue.trim(),
      meetingLink: form.mode === "Offline" ? "" : form.meetingLink.trim(),
    };
    try {
      const saved = wasEditing
        ? await apiRequest(`/hackathons/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiRequest("/hackathons", { method: "POST", body: JSON.stringify(payload) });

      // Update the list in place — no reload, no extra request.
      setHackathons((prev) => {
        const next = wasEditing ? prev.map((h) => (h._id === saved._id ? saved : h)) : [...prev, saved];
        return next.sort(byDate);
      });
      resetForm();
      setNotice({ type: "success", text: wasEditing ? "Hackathon updated." : "Hackathon created." });
    } catch (err) {
      setFormError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function edit(h) {
    setEditingId(h._id);
    setFormError("");
    setNotice(null);
    setForm({
      name: h.name, theme: h.theme || "", description: h.description, date: h.date?.slice(0, 10) || "",
      teamSize: h.teamSize || "", mode: normalizeMode(h.mode), venue: h.venue || "", meetingLink: h.meetingLink || "", prizeInfo: h.prizeInfo || "",
      rules: h.rules || "", eligibility: h.eligibility || "", registrationDeadline: h.registrationDeadline?.slice(0, 10) || "",
      posterUrl: h.posterUrl || "",
    });
    setPosterName("");
    setPosterError("");
    setFileInputKey((k) => k + 1);
    scrollToForm();
  }

  /* ---- delete flow: open dialog -> confirm -> call existing API ---- */
  function askDelete(h) {
    setDeleteError("");
    setPendingDelete(h);
  }

  function cancelDelete() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const id = pendingDelete._id;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/hackathons/${id}`, { method: "DELETE" });
      setHackathons((prev) => prev.filter((h) => h._id !== id)); // removed immediately
      if (editingId === id) resetForm();
      if (viewingRegsFor === id) setViewingRegsFor(null);
      setPendingDelete(null);
      setNotice({ type: "success", text: "Hackathon deleted." });
    } catch (err) {
      // Keep the hackathon in the list and the dialog open so the error is visible.
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function viewRegistrations(id) {
    const requestId = ++regsRequestRef.current;
    setViewingRegsFor(id);
    setRegistrations([]);
    setRegsLoading(true);
    try {
      const regs = await apiRequest(`/hackathons/${id}/registrations`);
      if (requestId === regsRequestRef.current) setRegistrations(regs);
    } catch (err) {
      if (requestId === regsRequestRef.current) {
        setViewingRegsFor(null);
        setNotice({ type: "error", text: `Couldn't load registrations: ${err.message}` });
      }
    } finally {
      if (requestId === regsRequestRef.current) setRegsLoading(false);
    }
  }

  const viewingHackathon = hackathons.find((h) => h._id === viewingRegsFor);
  const busy = submitting || uploading;

  return (
    <div className="hk-page">
      <header className="hk-header">
        <h1 id="hk-page-title" tabIndex={-1}>Manage Hackathons</h1>
        <p className="page-subtitle">Create and manage hackathons, registrations, and deadlines.</p>
      </header>

      {notice && (
        <p
          className={notice.type === "success" ? "hk-notice-success" : "error-text"}
          role={notice.type === "success" ? "status" : "alert"}
        >
          {notice.text}
        </p>
      )}

      {/* ------------------------- Create / edit form ------------------------- */}
      <section className="panel hk-form-card" ref={formCardRef} aria-labelledby="hk-form-title">
        <div className="hk-form-head">
          <h2 id="hk-form-title">{editingId ? "Edit Hackathon" : "Create Hackathon"}</h2>
          {editingId && (
            <button type="button" className="btn-outline" onClick={resetForm} disabled={submitting}>
              Cancel editing
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="hk-form-grid">
          <div className="hk-field">
            <label htmlFor="hk-name">Hackathon Name <span className="hk-req" aria-hidden="true">*</span></label>
            <input id="hk-name" ref={nameInputRef} placeholder="e.g. CodeSprint 2026" value={form.name} onChange={setField("name")} required />
          </div>
          <div className="hk-field">
            <label htmlFor="hk-theme">Theme</label>
            <input id="hk-theme" placeholder="e.g. AI for social good" value={form.theme} onChange={setField("theme")} />
          </div>

          <div className="hk-field hk-full">
            <label htmlFor="hk-desc">Description <span className="hk-req" aria-hidden="true">*</span></label>
            <textarea id="hk-desc" rows={4} placeholder="Describe the hackathon..." value={form.description} onChange={setField("description")} required />
          </div>

          <div className="hk-field">
            <label htmlFor="hk-date">Hackathon Date <span className="hk-req" aria-hidden="true">*</span></label>
            <input id="hk-date" type="date" value={form.date} onChange={setField("date")} required />
          </div>
          <div className="hk-field">
            <label htmlFor="hk-deadline">Registration Deadline <span className="hk-req" aria-hidden="true">*</span></label>
            <input id="hk-deadline" type="date" value={form.registrationDeadline} onChange={setField("registrationDeadline")} required />
          </div>

          <div className="hk-field">
            <label htmlFor="hk-team">Team Size</label>
            <input id="hk-team" placeholder="e.g. 2-4" value={form.teamSize} onChange={setField("teamSize")} />
          </div>
          <div className="hk-field">
            <label htmlFor="hk-mode">Participation Mode</label>
            <select id="hk-mode" value={form.mode} onChange={setField("mode")}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Location fields depend on the participation mode */}
          {form.mode !== "Online" && (
            <div className={`hk-field ${form.mode === "Offline" ? "hk-full" : ""}`}>
              <label htmlFor="hk-venue">Venue / Location <span className="hk-req" aria-hidden="true">*</span></label>
              <input id="hk-venue" placeholder="e.g. Main Auditorium, ABC College, Chennai" value={form.venue} onChange={setField("venue")} required />
            </div>
          )}
          {form.mode !== "Offline" && (
            <div className={`hk-field ${form.mode === "Online" ? "hk-full" : ""}`}>
              <label htmlFor="hk-link">Online Meeting / Platform Link</label>
              <input id="hk-link" type="url" placeholder="https://meet.google.com/… or Devfolio / Zoom link" value={form.meetingLink} onChange={setField("meetingLink")} />
            </div>
          )}

          <div className="hk-field hk-full">
            <label htmlFor="hk-prize">Prize Information</label>
            <input id="hk-prize" placeholder="e.g. ₹50,000 for the winning team" value={form.prizeInfo} onChange={setField("prizeInfo")} />
          </div>

          <div className="hk-field hk-full">
            <label htmlFor="hk-poster">Poster Image</label>
            <input
              key={fileInputKey}
              ref={posterInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePosterChange}
              className="hk-file-hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            {form.posterUrl ? (
              <div className="hk-upload hk-upload-filled">
                <img className="hk-upload-thumb" src={form.posterUrl} alt="Poster preview" />
                <div className="hk-upload-meta">
                  <span className="hk-upload-name">{posterName || "Current poster"}</span>
                  <span className="hk-upload-hint">{uploading ? "Uploading…" : "Poster ready"}</span>
                </div>
                <div className="hk-upload-actions">
                  <button id="hk-poster" type="button" className="btn-outline" onClick={() => posterInputRef.current?.click()} disabled={uploading}>Change</button>
                  <button type="button" className="btn-danger" onClick={removePoster} disabled={uploading}>Remove</button>
                </div>
              </div>
            ) : (
              <button id="hk-poster" type="button" className="hk-upload hk-upload-empty" onClick={() => posterInputRef.current?.click()} disabled={uploading}>
                <span className="hk-upload-icon" aria-hidden="true"><UploadIcon size={20} /></span>
                <span className="hk-upload-cta">{uploading ? "Uploading poster…" : "Click to upload a poster"}</span>
                <span className="hk-upload-hint">JPG, PNG or WEBP · up to 5MB</span>
              </button>
            )}
            {uploading && form.posterUrl && <span className="muted-text" role="status">Uploading poster…</span>}
            {posterError && <span className="error-text" role="alert">{posterError}</span>}
          </div>

          {formError && <p className="error-text hk-full" role="alert">{formError}</p>}

          <div className="hk-full hk-form-actions">
            <button type="submit" disabled={busy} aria-busy={submitting}>
              {submitting
                ? (editingId ? "Updating..." : "Creating...")
                : (editingId ? "Update Hackathon" : "Create Hackathon")}
            </button>
          </div>
        </form>
      </section>

      {/* ------------------------------ List ------------------------------ */}
      {loading ? (
        <p className="muted-text" role="status">Loading hackathons…</p>
      ) : loadError ? (
        <div className="hk-load-error" role="alert">
          <p className="error-text">Couldn't load hackathons: {loadError}</p>
          <button type="button" className="btn-outline" onClick={load}>Try again</button>
        </div>
      ) : hackathons.length === 0 ? (
        <div className="empty-state hk-empty">
          <div className="hk-empty-emoji" aria-hidden="true">🚀</div>
          <h3>No hackathons yet</h3>
          <p>Create your first hackathon to start sharing opportunities with students.</p>
          <button type="button" onClick={scrollToForm}>Create Hackathon</button>
        </div>
      ) : (
        <div className="hk-table-wrap">
          <table className="hk-table">
            <thead>
              <tr><th>Poster</th><th>Name</th><th>Org</th><th>Date</th><th>Deadline</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {hackathons.map((h) => (
                <tr key={h._id}>
                  <td data-label="Poster">
                    {h.posterUrl
                      ? <img className="hk-thumb" src={h.posterUrl} alt={`Poster for ${h.name}`} />
                      : <span className="hk-thumb hk-thumb-empty" aria-label="No poster">-</span>}
                  </td>
                  <td data-label="Name">
                    <div className="hk-name">{h.name}</div>
                    {h.theme && <div className="hk-theme">{h.theme}</div>}
                  </td>
                  <td data-label="Org">{h.orgLabel}</td>
                  <td data-label="Date">{fmtDate(h.date)}</td>
                  <td data-label="Deadline">{fmtDate(h.registrationDeadline)}</td>
                  <td data-label="Actions">
                    <div className="hk-actions">
                      <button type="button" className="btn-outline" onClick={() => edit(h)} aria-label={`Edit ${h.name}`}>Edit</button>
                      <button type="button" className="btn-outline" onClick={() => viewRegistrations(h._id)} aria-label={`View registrations for ${h.name}`}>Registrations</button>
                      <button type="button" className="btn-danger hk-delete-btn" onClick={() => askDelete(h)} aria-label={`Delete ${h.name}`}>
                        <TrashIcon size={14} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --------------------------- Registrations --------------------------- */}
      {viewingRegsFor && (
        <div className="panel">
          <h2>
            Registrations{viewingHackathon ? ` — ${viewingHackathon.name}` : ""}{" "}
            <button type="button" className="link-btn" onClick={() => setViewingRegsFor(null)}>Close</button>
          </h2>
          {regsLoading ? (
            <p className="muted-text" role="status">Loading registrations…</p>
          ) : registrations.length === 0 ? (
            <p>No registrations yet.</p>
          ) : (
            <div className="hk-table-wrap hk-regs-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Team</th><th>Leader</th><th>Email</th><th>Phone</th>
                    <th>Members</th><th>College</th><th>Project</th><th>GitHub</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Student">{r.student?.name}</td>
                      <td data-label="Team">{r.teamName || "-"}</td>
                      <td data-label="Leader">{r.leaderName || "-"}</td>
                      <td data-label="Email">{r.leaderEmail || r.student?.email}</td>
                      <td data-label="Phone">{r.phone || "-"}</td>
                      <td data-label="Members">{r.teamMembers || "-"}</td>
                      <td data-label="College">{r.college || "-"}</td>
                      <td data-label="Project">{r.projectTitle || "-"}</td>
                      <td data-label="GitHub">
                        {r.githubLink ? <a href={r.githubLink} target="_blank" rel="noreferrer">Link</a> : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDeleteDialog
          hackathon={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}