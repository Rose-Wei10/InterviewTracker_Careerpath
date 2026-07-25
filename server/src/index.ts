import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";

import applicationRoutes from "./routes/applicationRoutes";
import dashboardRoutes from "./routes/dashboard";

dotenv.config();
console.log("PK:", process.env.CLERK_PUBLISHABLE_KEY);
console.log("SK:", process.env.CLERK_SECRET_KEY);

const app = express();

app.use(cors());
app.use(express.json());

// Clerk MUST come before any routes
app.use(clerkMiddleware());

app.get("/", (req, res) => {
  res.json({
    message: "Interview Tracker API Running",
  });
});

app.use("/api/applications", applicationRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});