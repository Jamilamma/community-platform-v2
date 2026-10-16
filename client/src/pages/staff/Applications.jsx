import { useEffect, useState } from "react";
import { apiRequest, openFileInline } from "../../services/api";
import { resumeDownloadUrl } from "../../utils/resume";

const statuses = ["Applied", "Under Review", "Shortlisted", "Selected", "Rejected"];

export default function StaffApplications() {
  const [applications, setApplications] = useState([]);

  function load() {
    apiRequest("/applications").then(setApplications);
  }
  useEffect(load, []);

  async function updateStatus(id, status) {
    await apiRequest(`/applications/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div>
      <h1>Applications</h1>
      <table>
        <thead><tr><th>Student</th><th>Internship</th><th>Resume</th><th>Status</th></tr></thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a._id}>
              <td>{a.student?.name}<br /><small>{a.student?.email}</small></td>
              <td>{a.internship?.title}</td>
              <td>
                {a.resumeUrl ? (
                  <>
                    <button className="link-btn" onClick={() => openFileInline(a.resumeUrl).catch((err) => alert(err.message))}>View</button>
                    {" | "}
                    <a href={resumeDownloadUrl(a.resumeUrl, a.resumeName)}>Download</a>
                  </>
                ) : "-"}
              </td>
              <td>
                <select value={a.status} onChange={(e) => updateStatus(a._id, e.target.value)}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}