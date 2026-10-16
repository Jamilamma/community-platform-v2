import { useEffect, useState } from "react";
import { apiRequest, openFileInline } from "../../services/api";
import { resumeDownloadUrl } from "../../utils/resume";

export default function Students() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    apiRequest("/users/students").then(setStudents);
  }, []);

  return (
    <div>
      <h1>Students</h1>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>University</th><th>Resume</th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s._id}>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.university || "-"}</td>
              <td>
                {s.resumeUrl ? (
                  <>
                    <button className="link-btn" onClick={() => openFileInline(s.resumeUrl).catch((err) => alert(err.message))}>View</button>
                    {" | "}
                    <a href={resumeDownloadUrl(s.resumeUrl, s.resumeName)}>Download</a>
                  </>
                ) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}