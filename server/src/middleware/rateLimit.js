// Tiny in-memory rate limiter (per IP). Good enough for a single server instance.
module.exports = function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = "Too many attempts. Please try again later." } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || "unknown";
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message });
    }
    next();
  };
};