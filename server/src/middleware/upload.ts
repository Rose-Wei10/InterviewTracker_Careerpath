import multer from "multer";
import { HttpError } from "../lib/errors";
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 4 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf")
      return cb(new HttpError(400, "Only PDF uploads are accepted"));
    cb(null, true);
  },
});
