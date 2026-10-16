import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";

const empty = { title: "", description: "", deadline: "", openings: 1, mode: "Remote" };

export default function StaffInternships() {
  const [internships, setInternships] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  function load() {
    apiRequest("/internships").then(setInternships);
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    return internships.filter((i) => {
      const matchesSearch = !search.trim() || i.title?.toLowerCase().includes(search.toLowerCase());
      const matchesMode = modeFilter === "all" || i.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [internships, search, modeFilter]);

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, openings: form.openings ? Number(form.openings) : 1 };
    if (editingId) {
      await apiRequest(`/internships/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiRequest("/internships", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm(empty);
    setEditingId(null);
    load();
  }

  function edit(i) {
    setEditingId(i._id);
    setForm({
      title: i.title, description: i.description, deadline: i.deadline?.slice(0, 10),
      openings: i.openings || 1, mode: i.mode || "Remote",
    });
  }

  async function remove(id) {
    await apiRequest(`/internships/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1>Manage Internships</h1>
      <form onSubmit={handleSubmit} className="inline-form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input type="number" min="1" placeholder="Students needed" value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          <option value="Remote">Remote</option>
          <option value="On-site">On-site</option>
          <option value="Hybrid">Hybrid</option>
        </select>
        <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
        <button type="submit">{editingId ? "Update" : "Create"}</button>
      </form>

      <div className="filter-bar">
        <input placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">All modes</option>
          <option value="Remote">Remote</option>
          <option value="On-site">On-site</option>
          <option value="Hybrid">Hybrid</option>
        </select>
      </div>

      <table>
        <thead><tr><th>Title</th><th>Org</th><th>Mode</th><th>Needed</th><th>Deadline</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i._id}>
              <td data-label="Title">{i.title}</td>
              <td data-label="Org">{i.orgLabel}</td>
              <td data-label="Mode">{i.mode || "-"}</td>
              <td data-label="Needed">{i.openings ?? 1}</td>
              <td data-label="Deadline">{new Date(i.deadline).toLocaleDateString()}</td>
              <td data-label="Actions">
                <button className="btn-outline" onClick={() => edit(i)}>Edit</button>
                <button className="btn-danger" onClick={() => remove(i._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}