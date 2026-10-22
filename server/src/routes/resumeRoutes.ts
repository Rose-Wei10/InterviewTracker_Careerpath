import { Router } from "express";
import { upload } from "../middleware/upload";
import {
  createResume,
  getResumes,
  deleteResume,
  downloadResume,
} from "../controllers/resumeController";
const router = Router();
router.get("/", getResumes);
router.post("/", upload.single("resume"), createResume);
router.get("/:id/download", downloadResume);
router.delete("/:id", deleteResume);
export default router;
