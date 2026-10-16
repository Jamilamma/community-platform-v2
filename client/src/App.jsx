import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import ForgotPassword from "./pages/public/ForgotPassword";
import SetPassword from "./pages/public/SetPassword";

import StudentLayout from "./layouts/StudentLayout";
import StudentDashboard from "./pages/student/Dashboard";
import StudentProfile from "./pages/student/Profile";
import StudentOpportunities from "./pages/student/Opportunities";
import StudentInternships from "./pages/student/Internships";
import StudentWorkshops from "./pages/student/Workshops";
import StudentEvents from "./pages/student/Events";
import StudentHackathons from "./pages/student/Hackathons";
import MyApplications from "./pages/student/MyApplications";
import Community from "./pages/student/Community";
import Notifications from "./pages/student/Notifications";
import StudentProjectSupport from "./pages/student/ProjectSupport";

import StaffLayout from "./layouts/StaffLayout";
import StaffDashboard from "./pages/staff/Dashboard";
import Students from "./pages/staff/Students";
import StaffInternships from "./pages/staff/Internships";
import StaffWorkshops from "./pages/staff/Workshops";
import StaffEvents from "./pages/staff/Events";
import StaffHackathons from "./pages/staff/Hackathons";
import StaffApplications from "./pages/staff/Applications";
import StaffAnnouncements from "./pages/staff/Announcements";
import StaffCommunity from "./pages/staff/Community";
import StaffAnalytics from "./pages/staff/Analytics";
import StaffProjectSupport from "./pages/staff/ProjectSupport";
import StaffAccounts from "./pages/staff/StaffAccounts";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/set-password" element={<SetPassword />} />

        <Route path="/student" element={
          <RoleRoute role="student"><StudentLayout /></RoleRoute>
        }>
          <Route index element={<StudentDashboard />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="opportunities" element={<StudentOpportunities />} />
          <Route path="internships" element={<StudentInternships />} />
          <Route path="workshops" element={<StudentWorkshops />} />
          <Route path="events" element={<StudentEvents />} />
          <Route path="hackathons" element={<StudentHackathons />} />
          <Route path="applications" element={<MyApplications />} />
          <Route path="community" element={<Community />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="project-support" element={<StudentProjectSupport />} />
        </Route>

        <Route path="/staff" element={
          <RoleRoute role="staff"><StaffLayout /></RoleRoute>
        }>
          <Route index element={<StaffDashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="internships" element={<StaffInternships />} />
          <Route path="workshops" element={<StaffWorkshops />} />
          <Route path="events" element={<StaffEvents />} />
          <Route path="hackathons" element={<StaffHackathons />} />
          <Route path="applications" element={<StaffApplications />} />
          <Route path="announcements" element={<StaffAnnouncements />} />
          <Route path="community" element={<StaffCommunity />} />
          <Route path="analytics" element={<StaffAnalytics />} />
          <Route path="project-support" element={<StaffProjectSupport />} />
          <Route path="staff-accounts" element={<StaffAccounts />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}