import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
export const requireUser: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};
