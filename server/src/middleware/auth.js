const jwt = require("jsonwebtoken");
const { supabase, toDoc, USER_PUBLIC } = require("../utils/db");

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = header.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select(`${USER_PUBLIC}, is_owner, is_active`)
      .eq("id", decoded.id)
      .maybeSingle();

    // 22P02 = id in the token isn't a uuid, i.e. a token issued before the Supabase migration
    if (error && error.code === "22P02") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    if (error) throw error;
    if (!data) return res.status(401).json({ message: "User not found" });

    if (data.is_active === false) {
      return res.status(401).json({ message: "This account has been disabled. Contact your administrator." });
    }

    req.user = toDoc(data);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;