const { supabase, unwrap } = require("../utils/db");

// Cloudinary won't let a resume open inline on its own — "raw" always
// forces a download, and "image" delivery of PDFs is blocked by their
// security policy. So we fetch the bytes ourselves and re-send them with
// an explicit "inline" disposition, which makes the browser open it in
// its built-in PDF viewer instead of saving it to disk.
async function viewResume(req, res, next) {
  try {
    const { url } = req.query;
    if (!url || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/(raw|image)\/upload\/.+\/resumes\//.test(url)) {
      return res.status(400).json({ message: "Invalid resume URL" });
    }

    // Staff can view any student's resume. Students can only view their
    // own current resume, or a resume snapshot attached to one of their
    // own applications.
    if (req.user.role !== "staff") {
      const isOwnProfile = req.user.resumeUrl === url;
      if (!isOwnProfile) {
        const owned = unwrap(
          await supabase.from("applications").select("id")
            .eq("student_id", req.user._id).eq("resume_url", url).limit(1)
        );
        if (!owned.length) return res.status(403).json({ message: "Forbidden" });
      }
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ message: "Could not fetch the resume file" });
    }

    const filename = decodeURIComponent(url.split("/").pop() || "resume.pdf");
    const contentType = filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream";

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { viewResume };
