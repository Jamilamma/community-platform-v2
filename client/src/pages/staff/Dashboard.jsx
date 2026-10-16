import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

export default function StaffDashboard() {
  const [stats, setStats] = useState({ students: 0, internships: 0, applications: 0 });

  useEffect(() => {
    Promise.all([
      apiRequest("/users/students"),
      apiRequest("/internships"),
      apiRequest("/applications"),
    ]).then(([students, internships, applications]) => {
      setStats({ students: students.length, internships: internships.length, applications: applications.length });
    });
  }, []);

  return (
    <div>
      <h1>Staff Dashboard</h1>
      <div className="stat-row">
        <div className="stat-card"><strong>{stats.students}</strong><span>Total Students</span></div>
        <div className="stat-card"><strong>{stats.internships}</strong><span>Internships</span></div>
        <div className="stat-card"><strong>{stats.applications}</strong><span>Applications</span></div>
      </div>
    </div>
  );
}
