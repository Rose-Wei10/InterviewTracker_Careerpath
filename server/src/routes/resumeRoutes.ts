import { Router } from "express";
import { resumeTextPreview } from "../services/analysis";
import rateLimit from "express-rate-limit";
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
router.get(
  "/:id/text",
  rateLimit({
    windowMs: 60000,
    limit: 6,
    keyGenerator: (_req, res) => res.locals.userId,
  }),
  async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .json(await resumeTextPreview(res.locals.userId, String(req.params.id)));
  },
);
router.delete("/:id", deleteResume);
export default router;
