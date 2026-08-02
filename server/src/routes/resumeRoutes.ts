import express from "express";

import { upload } from "../middleware/upload";

import {
  createResume,
  getResumes,
  deleteResume,
} from "../controllers/resumeController";

const router = express.Router();

router.get("/", getResumes);

router.post(
  "/",
  upload.single("resume"),
  createResume
);

router.delete("/:id", deleteResume);

export default router;