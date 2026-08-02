import type { Resume } from "../../services/resumeService";
import "../../styles/resume.css";

interface Props {
  resume: Resume;
  handleDelete: (id: string) => void;
}

export default function ResumeCard({
  resume,
  handleDelete,
}: Props) {
  return (
    <div className="resume-card">

        <div className="resume-icon">
            📄
        </div>

        <h3>{resume.name}</h3>

        <p>
            {resume.description || "No description"}
        </p>

        <small>
            Uploaded{" "}
            {new Date(resume.createdAt).toLocaleDateString()}
        </small>

        <div className="resume-buttons">

            <button
                className="view-btn"
                onClick={() => window.open(resume.fileUrl, "_blank")}
            >
                View
            </button>

            <button
                className="delete-btn"
                onClick={() => handleDelete(resume.id)}
            >
                Delete
            </button>

        </div>

    </div>
  );
}