import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import { invalidateUserQueries } from "../services/queryCache";
import type { Resume } from "../types";
import { Loading, ErrorState, Empty, Confirm } from "../components/ui";
import UploadResumeModal from "../components/resume/uploadResumeModal";
import ResumeCard from "../components/resume/resumeCard";
export default function ResumeLibrary() {
  const api = useApi(),
    qc = useQueryClient(),
    [uploading, setUploading] = useState(false),
    [deleting, setDeleting] = useState<Resume | null>(null);
  const query = useQuery({
    queryKey: ["resumes", api.userId],
    queryFn: () => api.get<Resume[]>("/resumes"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.remove(`/resumes/${id}`),
    onSuccess: () => {
      void invalidateUserQueries(qc, api.userId, [
        "resumes",
        "application",
        "applications",
        "analyses",
      ]);
      setDeleting(null);
      toast.success("Resume deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PUT YOUR BEST EXPERIENCE FORWARD</p>
          <h1>
            Resume library<span className="heading-dot">.</span>
          </h1>
          <p>
            The right version for the right opportunity. Private, organized,
            ready.
          </p>
        </div>
        <button className="primary" onClick={() => setUploading(true)}>
          <Plus size={17} /> Upload resume
        </button>
      </div>
      <div className="info-note">
        PDF only · Up to 4 MB · Private storage · Download links expire after 60
        seconds
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.data.length ? (
        <div className="resume-grid">
          {query.data.map((r) => (
            <ResumeCard
              key={r.id}
              resume={r}
              handleDelete={() => setDeleting(r)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <h2>Your experience deserves a home.</h2>
          <p>Upload your first PDF to start your library.</p>
          <button onClick={() => setUploading(true)}>Upload a resume</button>
        </Empty>
      )}
      {uploading && <UploadResumeModal onClose={() => setUploading(false)} />}
      {deleting && (
        <Confirm
          title={`Delete ${deleting.name}? Associated analyses will also be deleted.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          busy={remove.isPending}
        />
      )}
    </>
  );
}
