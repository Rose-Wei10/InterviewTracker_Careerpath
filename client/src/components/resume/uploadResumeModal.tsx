import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import { Modal } from "../ui";
export default function UploadResumeModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const api = useApi(),
    qc = useQueryClient();
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [version, setVersion] = useState(1),
    [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a PDF");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("PDF must be 5 MB or smaller");
      const data = new FormData();
      data.append("resume", file);
      data.append("name", name);
      data.append("description", description);
      data.append("version", String(version));
      return api.post("/resumes", data);
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Resume uploaded");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal title="Upload a resume" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Version
          <input
            type="number"
            min={1}
            max={10000}
            required
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
          />
        </label>
        <label>
          PDF file (maximum 5 MB)
          <input
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="fine-print">
          Upload only documents you’re comfortable storing in your private
          library.
        </p>
        <div className="actions modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload PDF"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
