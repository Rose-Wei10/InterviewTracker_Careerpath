import express from "express";
import prisma from "../config/prisma";
import { getAuth } from "@clerk/express";

const router = express.Router();

// router.get("/", async (req: any, res) => {
//   console.log(req.auth);

//   // ...
// });

// GET all applications for current user
router.get("/", async (req: any, res) => {
  console.log(getAuth(req));
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const applications = await prisma.jobApplication.findMany({
    where: {
      userId,
    },
    orderBy: {
      appliedDate: "desc",
    },
  });

  res.json(applications);
});

// CREATE
router.post("/", async (req: any, res) => {
  console.log("===== POST =====");

  const { userId } = getAuth(req);
  console.log("userId:", userId);

  console.log("Before upsert");

  await prisma.user.upsert({
    where: {
      id: userId!,
    },
    update: {},
    create: {
      id: userId!,
      email: "",
    },
  });

  console.log("After upsert");

  console.log("Before create");

  const app = await prisma.jobApplication.create({
    data: {
      company: req.body.company,
      role: req.body.role,
      location: req.body.location,
      salary: req.body.salary,
      status: req.body.status,
      appliedDate: new Date(req.body.appliedDate),
      notes: req.body.notes,
      jobLink: req.body.jobLink,
      userId: userId!,
    },
  });

  console.log("After create");

  res.json(app);
});


// UPDATE
router.put("/:id", async (req: any, res) => {
 const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const existing = await prisma.jobApplication.findFirst({
    where: {
      id: req.params.id,
      userId,
    },
  });

  if (!existing) {
    return res.status(404).json({
      message: "Application not found",
    });
  }

  const app = await prisma.jobApplication.update({
    where: {
      id: req.params.id,
    },
    data: req.body,
  });

  res.json(app);
});

// DELETE
router.delete("/:id", async (req: any, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const existing = await prisma.jobApplication.findFirst({
    where: {
      id: req.params.id,
      userId,
    },
  });

  if (!existing) {
    return res.status(404).json({
      message: "Application not found",
    });
  }

  await prisma.jobApplication.delete({
    where: {
      id: req.params.id,
    },
  });

  res.json({
    success: true,
  });
});

export default router;