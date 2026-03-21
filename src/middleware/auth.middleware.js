import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.sendStatus(401);

  try {
    const token = header.split(" ")[1];
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.sendStatus(401);
  }
};

// Helper to check if user is admin
export const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.isAdmin) {
      return res.sendStatus(403);
    }
    next();
  } catch {
    res.sendStatus(401);
  }
};
