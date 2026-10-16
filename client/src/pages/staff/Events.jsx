import { useEffect, useState } from "react";
import { apiRequest, uploadFile } from "../../services/api";

const empty = { title: "", description: "", date: "", time: "", location: "", mode: "Online", capacity: "", registrationDeadline: "", posterUrl: "" };

export default function StaffEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [viewingRegsFor, setViewingRegsFor] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posterError, setPosterError] = useState("");

  function load() {
    apiRequest("/events").then(setEvents);
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
    const payload = { ...form, capacity: form.capacity ? Number(form.capacity) : undefined };
    if (editingId) {
      await apiRequest(`/events/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiRequest("/events", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm(empty);
    setEditingId(null);
    load();
  }

  function edit(ev) {
    setEditingId(ev._id);
    setForm({
      title: ev.title, description: ev.description, date: ev.date?.slice(0, 10), time: ev.time || "",
      location: ev.location || "", mode: ev.mode || "Online", capacity: ev.capacity || "",
      registrationDeadline: ev.registrationDeadline?.slice(0, 10), posterUrl: ev.posterUrl || "",
    });
  }

  async function remove(id) {
    await apiRequest(`/events/${id}`, { method: "DELETE" });
    load();
  }

  async function viewRegistrations(id) {
    setViewingRegsFor(id);
    const regs = await apiRequest(`/events/${id}/registrations`);
    setRegistrations(regs);
  }

  return (
    <div>
      <h1>Manage Events</h1>
      <form onSubmit={handleSubmit} className="inline-form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <input placeholder="Time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          <option value="Remote">Remote</option>
          <option value="On-site">On-site</option>
          <option value="Hybrid">Hybrid</option>
        </select>
        <input type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
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
          {events.map((ev) => (
            <tr key={ev._id}>
              <td data-label="Poster">{ev.posterUrl ? <img src={ev.posterUrl} alt="" style={{ width: 56, height: 34, objectFit: "cover", borderRadius: 6 }} /> : "-"}</td>
              <td data-label="Title">{ev.title}</td>
              <td data-label="Org">{ev.orgLabel}</td>
              <td data-label="Date">{new Date(ev.date).toLocaleDateString()}</td>
              <td data-label="Deadline">{new Date(ev.registrationDeadline).toLocaleDateString()}</td>
              <td data-label="Actions">
                         <button className="btn-outline" onClick={() => edit(ev)}>Edit</button>
                <button className="btn-danger" onClick={() => remove(ev._id)}>Delete</button>
                <button className="btn-outline" onClick={() => viewRegistrations(ev._id)}>Registrations</button>
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