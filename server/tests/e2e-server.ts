import { createApp } from "../src/app";
if (
  process.env.NODE_ENV !== "test" ||
  !process.env.DATABASE_URL?.includes("interview_tracker_test")
)
  throw new Error("E2E server requires an isolated test DB");
createApp({
  origin: "http://127.0.0.1:5179",
  auth: (req, res, next) => {
    if (req.header("authorization") !== "Bearer browser-test-token") {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.locals.userId = "e2e-user";
    next();
  },
}).listen(5019, "127.0.0.1");
