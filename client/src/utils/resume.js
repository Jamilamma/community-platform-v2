// Builds a Cloudinary URL that forces a real file download with the
// correct filename, instead of the browser guessing what the raw bytes
// are. Cloudinary's transformation syntax breaks on spaces, parentheses,
// and other special characters inside fl_attachment, so the filename is
// sanitized down to letters/digits/underscore/hyphen first.
export function resumeDownloadUrl(url, filename) {
  if (!url) return url;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const cleanName = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60)
    : "resume";

  return url.slice(0, idx + marker.length) + `fl_attachment:${cleanName}/` + url.slice(idx + marker.length);
}