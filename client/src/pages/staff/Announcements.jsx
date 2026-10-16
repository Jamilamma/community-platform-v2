import { useEffect, useState } from "react";
import { apiRequest, uploadFile } from "../../services/api";

export default function StaffAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", imageUrl: "" });
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");

  function load() {
    apiRequest("/announcements").then(setAnnouncements);
  }
  useEffect(load, []);

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("poster", file);
      const { posterUrl } = await uploadFile("/upload/poster", fd);
      setForm((f) => ({ ...f, imageUrl: posterUrl }));
    } catch (err) {
      setImageError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await apiRequest("/announcements", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", body: "", imageUrl: "" });
    load();
  }

  async function remove(id) {
    await apiRequest(`/announcements/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1>Announcements</h1>
      <form onSubmit={handleSubmit} className="inline-form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
          Image (optional)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
        </label>
        <button type="submit" disabled={uploading}>Post</button>
      </form>

      {uploading && <p className="muted-text">Uploading image…</p>}
      {imageError && <p className="error-text">{imageError}</p>}
      {form.imageUrl && (
        <div style={{ marginBottom: 18 }}>
          <img src={form.imageUrl} alt="Preview" style={{ maxWidth: 240, borderRadius: 12, border: "1px solid var(--border)" }} />
          <button type="button" className="link-btn" style={{ display: "block", marginTop: 6 }} onClick={() => setForm({ ...form, imageUrl: "" })}>Remove image</button>
        </div>
      )}

      <div className="dashboard-list">
        {announcements.map((a) => (
          <div key={a._id} className="panel">
            {a.imageUrl && <img src={a.imageUrl} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />}
            <strong>{a.title}</strong>
            <p>{a.body}</p>
            <button onClick={() => remove(a._id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}