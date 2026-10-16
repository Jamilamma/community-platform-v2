const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (networkErr) {
    throw new Error(
      `Can't reach the server at ${API_URL}. Check that the backend is running and VITE_API_URL is set correctly.`
    );
  }

  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `Server returned an unexpected response (status ${res.status}). It may not be running the expected API.`
      );
    }
  }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (status ${res.status})`);
  }
  return data;
}

export async function uploadFile(path, formData) {
  const token = localStorage.getItem("token");
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}.`);
  }
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Server returned an unexpected response (status ${res.status}).`);
    }
  }
  if (!res.ok) throw new Error(data.message || `Upload failed (status ${res.status})`);
  return data;
}

// Opens a resume in a new tab via our backend proxy, instead of linking to
// Cloudinary directly — Cloudinary always forces raw files to download, so
// this fetches the file with auth, then opens the bytes as a blob URL,
// which the browser renders inline (PDF viewer) instead of saving it.
//
// The tab is opened SYNCHRONOUSLY, before the await, so browsers still
// treat it as a direct result of the click and don't block it as a popup.
export async function openFileInline(cloudinaryUrl) {
  const newTab = window.open("", "_blank");
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/resume/view?url=${encodeURIComponent(cloudinaryUrl)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let message = `Failed to open file (status ${res.status})`;
      try {
        const data = await res.json();
        message = data.message || message;
      } catch {}
      throw new Error(message);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (newTab) {
      newTab.location.href = objectUrl;
    } else {
      window.open(objectUrl, "_blank");
    }
  } catch (err) {
    if (newTab) newTab.close();
    throw err;
  }
}