import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import { invalidateUserQueries } from "../../services/queryCache";
import { statuses } from "../../types";
import type { Application, Resume } from "../../types";
import { Modal } from "../ui";
export default function AddApplicationModal({
  application,
  onClose,
}: {
  application?: Application | null;
  onClose: () => void;
}) {
  const api = useApi(),
    qc = useQueryClient();
  const [form, setForm] = useState({
    company: application?.company ?? "",
    role: application?.role ?? "",
    status: application?.status ?? "Applied",
    appliedDate:
      application?.appliedDate.slice(0, 10) ??
      new Date().toLocaleDateString("en-CA"),
    location: application?.location ?? "",
    salary: application?.salary ?? "",
    jobLink: application?.jobLink ?? "",
    notes: application?.notes ?? "",
    resumeId: application?.resumeId ?? "",
  });
  const resumes = useQuery({
    queryKey: ["resumes", api.userId],
    queryFn: () => api.get<Resume[]>("/resumes"),
  });
  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        ...form,
        resumeId: form.resumeId || null,
        appliedDate:
          application &&
          form.appliedDate === application.appliedDate.slice(0, 10)
            ? application.appliedDate
            : new Date(form.appliedDate).toISOString(),
      };
      return application
        ? api.patch(`/applications/${application.id}`, data)
        : api.post("/applications", data);
    },
    onSuccess: async () => {
      await invalidateUserQueries(qc, api.userId, [
        "application",
        "applications",
        "dashboard",
      ]);
      toast.success(application ? "Application updated" : "Application added");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const change = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <Modal
      title={application ? "Edit application" : "Add an application"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="form-grid">
          {(["company", "role", "location", "salary"] as const).map((k) => (
            <label key={k} className="capitalize">
              {k}
              {["company", "role"].includes(k) ? " *" : ""}
              <input
                name={k}
                value={form[k]}
                onChange={change}
                required={["company", "role"].includes(k)}
                maxLength={k === "salary" ? 100 : 200}
              />
            </label>
          ))}
          <label>
            Applied date
            <input
              type="date"
              name="appliedDate"
              value={form.appliedDate}
              required
              onChange={change}
            />
          </label>
          <label>
            Status
            <select name="status" value={form.status} onChange={change}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Job URL
            <input
              type="url"
              name="jobLink"
              value={form.jobLink}
              onChange={change}
              maxLength={2000}
            />
          </label>
          <label>
            Resume version
            <select name="resumeId" value={form.resumeId} onChange={change}>
              <option value="">None selected</option>
              {resumes.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · v{r.version}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={change}
              rows={4}
              maxLength={20000}
            />
          </label>
        </div>
        <div className="actions modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save application"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
