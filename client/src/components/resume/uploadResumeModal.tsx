import { useState } from "react";
import { uploadResume } from "../../services/resumeService";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadResumeModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleUpload() {
    if (!file) {
      alert("Please choose a PDF.");

      return;
    }

    if (!name) {
      alert("Please enter a name.");

      return;
    }

    try {
      setLoading(true);

      await uploadResume(
        file,
        name,
        description
      );

      onSuccess();

      onClose();

    } catch (err) {

      console.error(err);

      alert("Upload failed.");

    } finally {

      setLoading(false);

    }
  }

  return (
    <div className="modal-overlay">

      <div className="application-modal">

        <h2>Upload Resume</h2>

        <label>Resume Name</label>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Description</label>

        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label>PDF</label>

        <input
          type="file"
          accept=".pdf"
          onChange={(e) => {
            if (e.target.files?.length) {
              setFile(e.target.files[0]);
            }
          }}
        />

        <div className="modal-buttons">

          <button
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>

        </div>

      </div>

    </div>
  );
}