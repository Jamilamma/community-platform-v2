import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import OpportunityCard from "../../components/OpportunityCard";

export default function StudentWorkshops() {
  const [workshops, setWorkshops] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [message, setMessage] = useState("");

  function load() {
    apiRequest("/workshops").then(setWorkshops).catch(() => {});
    apiRequest("/workshops/mine").then(setMyRegs).catch(() => {});
  }
  useEffect(load, []);

  const registeredIds = new Set(myRegs.map((r) => r.workshop?._id));

  async function register(id) {
    setMessage("");
    try {
      await apiRequest(`/workshops/${id}/register`, { method: "POST" });
      setMessage("Registration confirmed!");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div>
      <h1>Workshops</h1>
      <p className="page-subtitle">Conducted by Xentwin Technologies.</p>
      {message && <p className="inline-message">{message}</p>}

      {workshops.length === 0 ? (
        <div className="empty-state">
          <h3>No workshops available right now.</h3>
          <p>Check back soon for new sessions.</p>
        </div>
      ) : (
        <div className="card-grid">
          {workshops.map((w) => (
            <OpportunityCard
              key={w._id}
              item={{
                id: w._id,
                type: "workshop",
                title: w.title,
                orgLabel: w.orgLabel,
                description: w.description,
                mode: w.mode,
                date: w.date,
                deadline: w.registrationDeadline,
                posterUrl: w.posterUrl,
              }}
              actionLabel="Register"
              actionDisabled={registeredIds.has(w._id)}
              onAction={() => register(w._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}