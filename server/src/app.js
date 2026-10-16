const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const internshipRoutes = require("./routes/internshipRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const workshopRoutes = require("./routes/workshopRoutes");
const eventRoutes = require("./routes/eventRoutes");
const hackathonRoutes = require("./routes/hackathonRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const userRoutes = require("./routes/userRoutes");
const channelRoutes = require("./routes/channelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const commentRoutes = require("./routes/commentRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const projectSupportRoutes = require("./routes/projectSupportRoutes");
const xentieRoutes = require("./routes/xentieRoutes");

const app = express();

const allowedOrigins = [process.env.CLIENT_URL];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/workshops", workshopRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/hackathons", hackathonRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/users", userRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/project-support", projectSupportRoutes);
app.use("/api/xentie", xentieRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

module.exports = app;