import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import OpportunityCard from "../../components/OpportunityCard";

export default function StudentInternships() {
  const [internships, setInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState("");

  function load() {
    apiRequest("/internships").then(setInternships).catch(() => {});
    apiRequest("/applications/mine").then(setApplications).catch(() => {});
  }
  useEffect(load, []);

  const appliedIds = new Set(applications.map((a) => a.internship?._id));

  async function apply(id) {
    setMessage("");
    try {
      await apiRequest(`/internships/${id}/apply`, { method: "POST" });
      setMessage("Applied successfully!");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div>
      <h1>Internships</h1>
      <p className="page-subtitle">Offered by Xentwin Technologies.</p>
      {message && <p className="inline-message">{message}</p>}

      {internships.length === 0 ? (
        <div className="empty-state">
          <h3>No internships available right now.</h3>
          <p>Check back soon for new openings.</p>
        </div>
      ) : (
        <div className="card-grid">
          {internships.map((i) => (
            <OpportunityCard
              key={i._id}
              item={{
                id: i._id,
                type: "internship",
                title: i.title,
                orgLabel: i.orgLabel,
                description: i.description,
                mode: i.mode,
                location: i.location,
                skills: i.requiredSkills,
                deadline: i.deadline,
              }}
              actionLabel="Apply"
              actionDisabled={appliedIds.has(i._id)}
              onAction={() => apply(i._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
