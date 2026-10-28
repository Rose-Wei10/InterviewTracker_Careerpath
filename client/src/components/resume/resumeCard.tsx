import { Link } from "react-router-dom";
import { FileText, Download, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import type { Resume } from "../../types";
export default function ResumeCard({
  resume,
  handleDelete,
}: {
  resume: Resume;
  handleDelete: () => void;
}) {
  const api = useApi();
  async function download() {
    try {
      const { url } = await api.get<{ url: string }>(
        `/resumes/${resume.id}/download`,
      );
      window.location.assign(url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <article className="card resume-card">
      <div className="section-heading">
        <span className="file-icon">
          <FileText size={26} />
        </span>
        <span className="badge">Version {resume.version}</span>
      </div>
      <h2>{resume.name}</h2>
      <p>{resume.description || "Ready for your next opportunity."}</p>
      <p className="fine-print">
        {new Date(resume.createdAt).toLocaleDateString()}
        {resume.size ? ` · ${Math.round(resume.size / 1024)} KB` : ""}
      </p>
      <div className="actions">
        <Link
          className="button primary"
          to={`/analysis?resumeId=${encodeURIComponent(resume.id)}`}
        >
          Review for a job
        </Link>
        <button onClick={download}>
          <Download size={15} /> Download
        </button>
        <button onClick={handleDelete} aria-label={`Delete ${resume.name}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
