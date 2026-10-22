import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fromZonedTime } from "date-fns-tz";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import type { Application } from "../types";
import { statuses } from "../types";
import { Loading, ErrorState, Modal } from "../components/ui";
import AddApplicationModal from "../components/dashboard/AddApplicationModal";
import ActivityFeed from "../components/dashboard/ActivityFeed";
export default function ApplicationDetail() {
  const { id } = useParams(),
    api = useApi(),
    qc = useQueryClient();
  const [editing, setEditing] = useState(false),
    [scheduling, setScheduling] = useState(false);
  const query = useQuery({
    queryKey: ["application", api.userId, id],
    queryFn: () => api.get<Application>(`/applications/${id}`),
  });
  const update = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/applications/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const interviewUpdate = useMutation({
    mutationFn: ({
      interviewId,
      status,
    }: {
      interviewId: string;
      status: string;
    }) =>
      api.patch(`/applications/${id}/interviews/${interviewId}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Interview updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const a = query.data;
  return (
    <>
      <Link to="/applications" className="back">
        ← All applications
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">APPLICATION DETAILS</p>
          <h1>{a.company}</h1>
          <p>
            {a.role} · {a.location || "Location not added"}
          </p>
        </div>
        <button className="primary" onClick={() => setEditing(true)}>
          Edit application
        </button>
      </div>
      <div className="detail-grid">
        <section className="card">
          <h2>The opportunity</h2>
          <dl>
            <dt>Status</dt>
            <dd>
              <select
                aria-label="Application status"
                value={a.status}
                disabled={update.isPending}
                onChange={(e) => update.mutate(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </dd>
            <dt>Applied</dt>
            <dd>{new Date(a.appliedDate).toLocaleDateString()}</dd>
            <dt>Salary</dt>
            <dd>{a.salary || "Not added"}</dd>
            <dt>Resume</dt>
            <dd>{a.resume?.name || "Not selected"}</dd>
            <dt>Follow up</dt>
            <dd>
              {a.followUpAt
                ? new Date(a.followUpAt).toLocaleString()
                : "Not scheduled"}
            </dd>
            <dt>Job posting</dt>
            <dd>
              {a.jobLink ? (
                <a href={a.jobLink} target="_blank" rel="noreferrer">
                  Open job posting ↗
                </a>
              ) : (
                "Not added"
              )}
            </dd>
          </dl>
          <h2>Notes</h2>
          <p className="notes">
            {a.notes || "Add notes to keep the important details close."}
          </p>
        </section>
        <ActivityFeed data={a.activities ?? []} />
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>Interview rounds</h2>
          <button onClick={() => setScheduling(true)}>+ Schedule round</button>
        </div>
        {a.interviews?.length ? (
          a.interviews.map((i) => (
            <div className="interview-item" key={i.id}>
              <div>
                <strong>{i.title}</strong>
                <p>
                  {new Date(i.startsAt).toLocaleString(undefined, {
                    timeZone: i.timeZone,
                  })}{" "}
                  · {i.timeZone} · {i.type}
                </p>
                <p className="notes">{i.notes}</p>
              </div>
              <select
                aria-label={`Status for ${i.title}`}
                value={i.status}
                disabled={interviewUpdate.isPending}
                onChange={(e) =>
                  interviewUpdate.mutate({
                    interviewId: i.id,
                    status: e.target.value,
                  })
                }
              >
                <option>Scheduled</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </div>
          ))
        ) : (
          <div className="empty">
            A new conversation is a step forward. Add your first interview
            round.
          </div>
        )}
      </section>
      {editing && (
        <AddApplicationModal
          application={a}
          onClose={() => setEditing(false)}
        />
      )}
      {scheduling && (
        <InterviewForm id={a.id} onClose={() => setScheduling(false)} />
      )}
    </>
  );
}
function InterviewForm({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useApi(),
    qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    startsAt: "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    type: "video",
    notes: "",
    reminderMinutes: "60",
  });
  const save = useMutation({
    mutationFn: () => {
      const date = fromZonedTime(form.startsAt, form.timeZone);
      if (!Number.isFinite(date.getTime()))
        throw new Error("Enter a valid date and time zone");
      return api.post(`/applications/${id}/interviews`, {
        ...form,
        startsAt: date.toISOString(),
        reminderMinutes: form.reminderMinutes
          ? Number(form.reminderMinutes)
          : null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Interview scheduled");
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
    <Modal title="Schedule an interview" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="stack"
      >
        <label>
          Round name
          <input
            name="title"
            required
            maxLength={200}
            value={form.title}
            onChange={change}
          />
        </label>
        <label>
          Date and time in selected zone
          <input
            type="datetime-local"
            name="startsAt"
            required
            value={form.startsAt}
            onChange={change}
          />
        </label>
        <label>
          IANA time zone
          <input
            name="timeZone"
            required
            placeholder="America/Los_Angeles"
            value={form.timeZone}
            onChange={change}
          />
        </label>
        <p className="fine-print">
          For daylight-saving transitions, check the saved instant after
          scheduling. Use a time outside the repeated or skipped hour.
        </p>
        <label>
          Interview type
          <select name="type" value={form.type} onChange={change}>
            {["phone", "video", "technical", "behavioral", "onsite"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Email reminder
          <select
            name="reminderMinutes"
            value={form.reminderMinutes}
            onChange={change}
          >
            <option value="">No email reminder</option>
            <option value="15">15 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            value={form.notes}
            onChange={change}
            maxLength={10000}
          />
        </label>
        <div className="actions modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? "Scheduling…" : "Schedule interview"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
