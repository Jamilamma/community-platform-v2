import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import TopBar from "../components/TopBar";
import XentieChat from "../components/XentieChat";

const links = [
  { to: "/staff", label: "Dashboard" },
  { to: "/staff/students", label: "Students" },
  { to: "/staff/internships", label: "Internships" },
  { to: "/staff/project-support", label: "Project Support" },
  { to: "/staff/workshops", label: "Workshops" },
  { to: "/staff/events", label: "Events" },
  { to: "/staff/hackathons", label: "Hackathons" },
  { to: "/staff/applications", label: "Applications" },
  { to: "/staff/announcements", label: "Announcements" },
  { to: "/staff/community", label: "Community" },
  { to: "/staff/analytics", label: "Analytics" },
];

export default function StaffLayout() {
  return (
    <div className="portal-layout">
      <Navbar links={links} />
      <div className="portal-body">
        <TopBar />
        <main className="portal-main"><Outlet /></main>
      </div>
      <XentieChat />
    </div>
  );
}