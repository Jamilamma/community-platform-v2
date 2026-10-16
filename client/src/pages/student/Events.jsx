import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import OpportunityCard from "../../components/OpportunityCard";

export default function StudentEvents() {
  const [events, setEvents] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [message, setMessage] = useState("");

  function load() {
    apiRequest("/events").then(setEvents).catch(() => {});
    apiRequest("/events/mine").then(setMyRegs).catch(() => {});
  }
  useEffect(load, []);

  const registeredIds = new Set(myRegs.map((r) => r.event?._id));

  async function register(id) {
    setMessage("");
    try {
      await apiRequest(`/events/${id}/register`, { method: "POST" });
      setMessage("Registration confirmed!");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div>
      <h1>Events</h1>
      <p className="page-subtitle">Organized by GenAura Technologies.</p>
      {message && <p className="inline-message">{message}</p>}

      {events.length === 0 ? (
        <div className="empty-state">
          <h3>No events available right now.</h3>
          <p>Check back soon for new events.</p>
        </div>
      ) : (
        <div className="card-grid">
          {events.map((ev) => (
            <OpportunityCard
              key={ev._id}
              item={{
                id: ev._id,
                type: "event",
                title: ev.title,
                orgLabel: ev.orgLabel,
                description: ev.description,
                mode: ev.mode,
                date: ev.date,
                location: ev.location,
                deadline: ev.registrationDeadline,
                posterUrl: ev.posterUrl,
              }}
              actionLabel="Register"
              actionDisabled={registeredIds.has(ev._id)}
              onAction={() => register(ev._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}