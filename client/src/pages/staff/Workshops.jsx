import { useEffect, useState } from "react";
import { apiRequest, uploadFile } from "../../services/api";

const empty = { title: "", description: "", date: "", time: "", instructor: "", mode: "Online", seats: "", registrationDeadline: "", posterUrl: "" };

export default function StaffWorkshops() {
  const [workshops, setWorkshops] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [viewingRegsFor, setViewingRegsFor] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posterError, setPosterError] = useState("");

  function load() {
    apiRequest("/workshops").then(setWorkshops);
  }
  useEffect(load, []);

  async function handlePosterChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPosterError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("poster", file);
      const { posterUrl } = await uploadFile("/upload/poster", fd);
      setForm((f) => ({ ...f, posterUrl }));
    } catch (err) {
      setPosterError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, seats: form.seats ? Number(form.seats) : undefined };
    if (editingId) {
      await apiRequest(`/workshops/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiRequest("/workshops", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm(empty);
    setEditingId(null);
    load();
  }

  function edit(w) {
    setEditingId(w._id);
    setForm({
      title: w.title, description: w.description, date: w.date?.slice(0, 10), time: w.time || "",
      instructor: w.instructor || "", mode: w.mode || "Online", seats: w.seats || "",
      registrationDeadline: w.registrationDeadline?.slice(0, 10), posterUrl: w.posterUrl || "",
    });
  }

  async function remove(id) {
    await apiRequest(`/workshops/${id}`, { method: "DELETE" });
    load();
  }

  async function viewRegistrations(id) {
    setViewingRegsFor(id);
    const regs = await apiRequest(`/workshops/${id}/registrations`);
    setRegistrations(regs);
  }

  return (
    <div>
      <h1>Manage Workshops</h1>
      <form onSubmit={handleSubmit} className="inline-form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <input placeholder="Time (e.g. 3:00 PM)" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <input placeholder="Instructor" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          <option value="Remote">Remote</option>
          <option value="On-site">On-site</option>
          <option value="Hybrid">Hybrid</option>
        </select>
        <input type="number" placeholder="Seats" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        <input type="date" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} required />

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
          Poster image
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePosterChange} />
        </label>

        <button type="submit" disabled={uploading}>{editingId ? "Update" : "Create"}</button>
      </form>

      {uploading && <p className="muted-text">Uploading poster…</p>}
      {posterError && <p className="error-text">{posterError}</p>}
      {form.posterUrl && (
        <div style={{ marginBottom: 18 }}>
          <img src={form.posterUrl} alt="Poster preview" style={{ maxWidth: 240, borderRadius: 12, border: "1px solid var(--border)" }} />
          <button type="button" className="link-btn" style={{ display: "block", marginTop: 6 }} onClick={() => setForm({ ...form, posterUrl: "" })}>Remove poster</button>
        </div>
      )}

      <table>
        <thead><tr><th>Poster</th><th>Title</th><th>Org</th><th>Date</th><th>Deadline</th><th>Actions</th></tr></thead>
        <tbody>
          {workshops.map((w) => (
            <tr key={w._id}>
              <td data-label="Poster">{w.posterUrl ? <img src={w.posterUrl} alt="" style={{ width: 56, height: 34, objectFit: "cover", borderRadius: 6 }} /> : "-"}</td>
              <td data-label="Title">{w.title}</td>
              <td data-label="Org">{w.orgLabel}</td>
              <td data-label="Date">{new Date(w.date).toLocaleDateString()}</td>
              <td data-label="Deadline">{new Date(w.registrationDeadline).toLocaleDateString()}</td>
              <td data-label="Actions">
                <button className="btn-outline" onClick={() => edit(w)}>Edit</button>
                <button className="btn-danger" onClick={() => remove(w._id)}>Delete</button>
                <button className="btn-outline" onClick={() => viewRegistrations(w._id)}>Registrations</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {viewingRegsFor && (
        <div className="panel">
          <h2>Registrations <button className="link-btn" onClick={() => setViewingRegsFor(null)}>Close</button></h2>
          {registrations.length === 0 ? (
            <p>No registrations yet.</p>
          ) : (
            <table>
              <thead><tr><th>Student</th><th>Email</th><th>University</th></tr></thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r._id}>
                    <td data-label="Student">{r.student?.name}</td>
                    <td data-label="Email">{r.student?.email}</td>
                    <td data-label="University">{r.student?.university}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}