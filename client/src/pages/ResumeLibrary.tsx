import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import {
  getResumes,
  deleteResume,
  setResumeAuthToken,
  type Resume,
} from "../services/resumeService";

import UploadResumeModal from "../components/resume/uploadResumeModal";
import ResumeCard from "../components/resume/resumeCard";
import "../styles/resume.css";

export default function ResumeLibrary() {
    const { getToken } = useAuth();

    const [showModal, setShowModal] = useState(false);

    const [resumes, setResumes] = useState<Resume[]>([]);

    async function loadResumes() {
        try {
        const data = await getResumes();
        setResumes(data);
        } catch (err) {
        console.error(err);
        }
    }

    useEffect(() => {
        async function initialize() {
            const token = await getToken();

            setResumeAuthToken(token);

            await loadResumes();
        }

        initialize();
    }, []);

    async function handleDelete(id: string) {
        if (!confirm("Delete this resume?")) return;

        await deleteResume(id);

        loadResumes();
    }

    return (
    <div className="dashboard">

        <DashboardHeader />

        <div className="resume-header">

        <div>
            <h2>Resume Library</h2>

            <p>
            Store multiple resumes for different job applications.
            </p>
        </div>

        <div className="resume-actions">

            <Link
            to="/dashboard"
            className="secondary-btn"
            >
            ← Dashboard
            </Link>

            <button
            className="primary-btn"
            onClick={() => setShowModal(true)}
            >
            + Upload Resume
            </button>

        </div>

        </div>

        <div className="resume-grid">

        {resumes.map((resume) => (

            <ResumeCard
            key={resume.id}
            resume={resume}
            handleDelete={handleDelete}
            />

        ))}

        </div>

        <UploadResumeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={async () => {
            setShowModal(false);
            await loadResumes();
        }}
        />

    </div>
    );
}