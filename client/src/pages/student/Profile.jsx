import { useEffect, useState } from "react";
import { apiRequest, openFileInline } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { resumeDownloadUrl } from "../../utils/resume";

const API_URL = import.meta.env.VITE_API_URL;

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "", phone: "", university: "", course: "", year: "", skills: "",
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeInfo, setResumeInfo] = useState({ resumeUrl: null, resumeName: null });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiRequest("/auth/me").then(({ user: u }) => {
      setForm({
        name: u.name || "",
        phone: u.phone || "",
        university: u.university || "",
        course: u.course || "",
        year: u.year || "",
        skills: (u.skills || []).join(", "),
      });
      setResumeInfo({ resumeUrl: u.resumeUrl, resumeName: u.resumeName });
    }).catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setMessage("");
    try {
      await apiRequest("/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function uploadResume() {
    if (!resumeFile) return;
    setUploading(true);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const body = new FormData();
      body.append("resume", resumeFile);
      const res = await fetch(`${API_URL}/upload/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setResumeInfo(data);
      setResumeFile(null);
      setMessage("Resume uploaded.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1>Profile</h1>
      <p className="page-subtitle">{user?.email}</p>
      {message && <p className="inline-message">{message}</p>}

      <form onSubmit={saveProfile} className="profile-form">
        <label>Full name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>University
          <input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
        </label>
        <label>Course
          <input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
        </label>
        <label>Year
          <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        </label>
        <label>Skills (comma separated)
          <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Python, SQL" />
        </label>
        <button type="submit">Save Profile</button>
      </form>

      <h2>Resume</h2>
      {resumeInfo.resumeUrl ? (
        <p>
          Current resume:{" "}
          <button className="link-btn" onClick={() => openFileInline(resumeInfo.resumeUrl).catch((err) => alert(err.message))}>
            {resumeInfo.resumeName || "View"}
          </button>
          {" | "}
          <a href={resumeDownloadUrl(resumeInfo.resumeUrl, resumeInfo.resumeName)}>Download</a>
        </p>
      ) : (
        <p>No resume uploaded yet.</p>
      )}
      <div className="inline-form">
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files[0])} />
        <button onClick={uploadResume} disabled={!resumeFile || uploading}>
          {uploading ? "Uploading…" : resumeInfo.resumeUrl ? "Replace Resume" : "Upload Resume"}
        </button>
      </div>
      <p><small>PDF or Word documents only, up to 5MB.</small></p>
    </div>
  );
}