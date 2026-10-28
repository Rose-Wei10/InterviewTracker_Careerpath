import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import { invalidateUserQueries } from "../services/queryCache";
import type { Analysis, Application, CalendarEvent } from "../types";
import { statuses } from "../types";
import { Loading, ErrorState } from "../components/ui";
import AddApplicationModal from "../components/dashboard/AddApplicationModal";
import EventForm from "../components/events/EventForm";
import EventList from "../components/events/EventList";
import ActivityFeed from "../components/dashboard/ActivityFeed";
export default function ApplicationDetail() {
  const { id } = useParams(),
    api = useApi(),
    qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(params.get("edit") === "1"),
    [scheduling, setScheduling] = useState(false);
  const query = useQuery({
    queryKey: ["application", api.userId, id],
    queryFn: () => api.get<Application>(`/applications/${id}`),
  });
  const reviews = useQuery({
    queryKey: ["application-analyses", api.userId, id],
    queryFn: () => api.get<Analysis[]>("/analyses", { applicationId: id }),
  });
  const update = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/applications/${id}`, { status }),
    onSuccess: () => {
      void invalidateUserQueries(qc, api.userId, [
        "application",
        "applications",
        "dashboard",
        "ghost-review",
      ]);
      toast.success("Status updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [eventEditing, setEventEditing] = useState<CalendarEvent | null>(null);
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const a = query.data;
  return (
    <>
      <Link to="/applications" className="back">
        ← All applications
      </Link>
      <div className="page-heading detail-heading">
        <div>
          <span className={`badge status-${a.status.replace(" ", "-")}`}>
            {a.status}
          </span>
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
            <dd>
              {new Date(
                a.appliedDate.slice(0, 10) + "T12:00:00",
              ).toLocaleDateString()}
            </dd>
            <dt>Salary</dt>
            <dd>{a.salary || "Not added"}</dd>
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
          <section className="detail-section">
            <h2>Resume</h2>
            <p className="notes">
              {a.resume?.name ||
                "No resume selected. Choose a version when editing."}
            </p>
          </section>
          <section className="detail-section">
            <h2>Job-specific resume review</h2>
            <Link
              className="button primary"
              to={`/analysis?applicationId=${encodeURIComponent(a.id)}${a.resumeId ? `&resumeId=${encodeURIComponent(a.resumeId)}` : ""}`}
            >
              Review for a job
            </Link>
            <details>
              <summary>Saved job description</summary>
              <p className="notes">
                {a.jobDescription ||
                  "No job description saved. Add one when editing or in Match."}
              </p>
            </details>
          </section>
          <section className="detail-section">
            <h2>Notes</h2>
            <p className="notes">
              {a.notes || "Add notes to keep the important details close."}
            </p>
          </section>
        </section>
        <ActivityFeed data={a.activities ?? []} />
      </div>
      <section className="card">
        <h2>Saved resume reviews</h2>
        {reviews.isPending ? (
          <Loading />
        ) : reviews.isError ? (
          <ErrorState error={reviews.error} retry={() => reviews.refetch()} />
        ) : reviews.data.length ? (
          reviews.data.map((r) => (
            <p key={r.id}>
              <Link to={`/analysis?reportId=${encodeURIComponent(r.id)}`}>
                {r.resume?.name ?? "Pasted resume"} ·{" "}
                {new Date(r.createdAt).toLocaleString()} · {r.status}
              </Link>
            </p>
          ))
        ) : (
          <p className="empty">
            No linked reviews yet. Review your resume against this job to save
            one here.
          </p>
        )}
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>Calendar events</h2>
          <button onClick={() => setScheduling(true)}>+ Schedule event</button>
        </div>
        <EventList items={a.events ?? []} onEdit={setEventEditing} />
      </section>
      {editing && (
        <AddApplicationModal
          application={a}
          onClose={() => {
            setEditing(false);
            const next = new URLSearchParams(params);
            next.delete("edit");
            setParams(next, { replace: true });
          }}
        />
      )}
      {(scheduling || eventEditing) && (
        <EventForm
          event={eventEditing ?? undefined}
          application={a}
          onClose={() => {
            setScheduling(false);
            setEventEditing(null);
          }}
        />
      )}
    </>
  );
}
