import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return { id: decoded.sub, role: decoded.role || "user" };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ message: "Please log in to continue" });
  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {return res.status(401).json({ message: "Autentication required" });}
    if (!allowedRoles.includes(user.role)) {return res.status(403).json({ message: "Insufficient permissions" });}
    next();
  };
}