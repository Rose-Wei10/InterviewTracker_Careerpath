import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileCheck2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { invalidateUserQueries } from "../services/queryCache";
import type {
  Resume,
  Application,
  Page,
  Requirement,
  Analysis as SavedAnalysis,
} from "../types";
import { Loading, ErrorState, Confirm } from "../components/ui";
import ReviewReport from "../components/match/ReviewReport";
export default function Analysis() {
  const api = useApi(),
    qc = useQueryClient(),
    [params, setParams] = useSearchParams();
  const [source, setSource] = useState<"pdf" | "text">(
    params.get("resumeId") ? "pdf" : "text",
  );
  const [resumeId, setResumeId] = useState(params.get("resumeId") ?? ""),
    [text, setText] = useState(""),
    [description, setDescription] = useState("");
  const [applicationId, setApplicationId] = useState(
      params.get("applicationId") ?? "",
    ),
    [loadedApp, setLoadedApp] = useState<string | null>(null),
    [appSearch, setAppSearch] = useState("");
  const [requirements, setRequirements] = useState<Requirement[]>([]),
    [requirementsReady, setRequirementsReady] = useState(false),
    [custom, setCustom] = useState(""),
    [customKind, setCustomKind] = useState<Requirement["kind"]>("keyword");
  const [selected, setSelected] = useState<SavedAnalysis | null>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [stale, setStale] = useState(false);
  const resumes = useQuery({
    queryKey: ["resumes", api.userId],
    queryFn: () => api.get<Resume[]>("/resumes"),
  });
  const applications = useQuery({
    queryKey: ["review-applications", api.userId, appSearch],
    queryFn: () =>
      api.get<Page<Application>>("/applications", {
        search: appSearch,
        pageSize: 10,
      }),
  });
  const application = useQuery({
    queryKey: ["application", api.userId, applicationId],
    queryFn: () => api.get<Application>(`/applications/${applicationId}`),
    enabled: !!applicationId,
  });
  useEffect(() => {
    if (application.data && loadedApp !== applicationId) {
      setDescription(application.data.jobDescription ?? "");
      if (application.data.resumeId && !params.get("resumeId")) {
        setResumeId(application.data.resumeId);
        setSource("pdf");
      }
      setRequirementsReady(false);
      setLoadedApp(applicationId);
    }
  }, [application.data, applicationId, loadedApp, params]);
  const history = useQuery({
    queryKey: ["analyses", api.userId],
    queryFn: () => api.get<SavedAnalysis[]>("/analyses"),
  });
  const reportQuery = useQuery({
    queryKey: ["analysis", api.userId, params.get("reportId")],
    queryFn: () =>
      api.get<SavedAnalysis>(`/analyses/${params.get("reportId")}`),
    enabled: !!params.get("reportId"),
  });
  const displayed = selected ?? reportQuery.data;
  const preview = useMutation({
    mutationFn: (id: string) =>
      api.get<{ text: string; pages: number; truncated: boolean }>(
        `/resumes/${id}/text`,
      ),
  });
  const detect = useMutation({
    mutationFn: () =>
      api.post<Requirement[]>("/analyses/requirements", {
        jobDescription: description,
      }),
    onSuccess: (r) => {
      setRequirements(r);
      setRequirementsReady(true);
      setStale(true);
    },
  });
  const review = useMutation({
    mutationFn: () =>
      api.post<SavedAnalysis>("/analyses", {
        ...(source === "pdf" ? { resumeId } : { resumeText: text }),
        applicationId: applicationId || null,
        jobDescription: description,
        requirements,
      }),
    onSuccess: async (r) => {
      setSelected(r);
      if (params.has("reportId")) {
        const next = new URLSearchParams(params);
        next.delete("reportId");
        setParams(next, { replace: true });
      }
      setStale(false);
      await invalidateUserQueries(qc, api.userId, [
        "analyses",
        "application-analyses",
      ]);
      toast.success("Review ready");
    },
    onError: () => {
      void invalidateUserQueries(qc, api.userId, [
        "analyses",
        "application-analyses",
      ]);
    },
  });
  const saveJob = useMutation({
    mutationFn: () =>
      api.patch(`/applications/${applicationId}`, {
        jobDescription: description,
      }),
    onSuccess: async () => {
      await invalidateUserQueries(qc, api.userId, [
        "application",
        "applications",
      ]);
      toast.success("Job description saved to application");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.remove(`/analyses/${id}`),
    onSuccess: async () => {
      if (displayed?.id === deleting) {
        setSelected(null);
        if (params.has("reportId")) {
          const next = new URLSearchParams(params);
          next.delete("reportId");
          setParams(next, { replace: true });
        }
        qc.removeQueries({ queryKey: ["analysis", api.userId, displayed.id] });
      }
      setDeleting(null);
      await invalidateUserQueries(qc, api.userId, [
        "analyses",
        "application-analyses",
      ]);
    },
  });
  function dirty() {
    setStale(true);
    review.reset();
  }
  function changeDescription(value: string) {
    setDescription(value);
    setRequirementsReady(false);
    detect.reset();
    dirty();
  }
  const choices = [
    ...(application.data ? [application.data] : []),
    ...(applications.data?.items ?? []),
  ].filter((a, i, all) => all.findIndex((v) => v.id === a.id) === i);
  const busy = review.isPending || preview.isPending || detect.isPending;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A THOUGHTFUL SECOND LOOK</p>
          <h1>
            Find your fit<span className="heading-dot">.</span>
          </h1>
          <p>Review your resume against a job, with evidence you can check.</p>
        </div>
        <FileCheck2 size={28} />
      </div>
      <div className="info-note">
        <strong>Free resume review</strong> · Processed on this app’s backend;
        no AI-provider calls. Up to 10 completed or processing reviews per
        rolling day. Failed attempts do not count. Pasted resume text is not
        saved in full; reports retain supporting excerpts.
      </div>
      <div className="detail-grid review-workspace">
        <section className="card">
          <h2>Compare an opportunity</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              review.mutate();
            }}
          >
            <fieldset disabled={busy} className="review-fields">
              <legend>1. Choose your resume source</legend>
              <div className="segmented">
                <button
                  type="button"
                  aria-pressed={source === "text"}
                  onClick={() => {
                    setSource("text");
                    dirty();
                  }}
                >
                  Paste resume text
                </button>
                <button
                  type="button"
                  aria-pressed={source === "pdf"}
                  onClick={() => {
                    setSource("pdf");
                    dirty();
                  }}
                >
                  Uploaded PDF
                </button>
              </div>
              {source === "text" ? (
                <label>
                  Resume text
                  <textarea
                    rows={8}
                    minLength={20}
                    maxLength={40000}
                    required
                    aria-label="Resume text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      dirty();
                    }}
                    placeholder="Paste your resume text here. Include the bullet points you want reviewed."
                  />
                </label>
              ) : (
                <>
                  <label>
                    Resume
                    <select
                      aria-label="Resume"
                      required
                      value={resumeId}
                      onChange={(e) => {
                        setResumeId(e.target.value);
                        preview.reset();
                        dirty();
                      }}
                    >
                      <option value="">Select a resume</option>
                      {resumes.data?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · v{r.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  {resumes.isPending ? (
                    <Loading />
                  ) : resumes.isError ? (
                    <ErrorState error={resumes.error} />
                  ) : (
                    !resumes.data.length && (
                      <p className="empty">
                        No PDFs yet. <Link to="/resumes">Upload a resume</Link>{" "}
                        or use pasted text.
                      </p>
                    )
                  )}
                  <button
                    type="button"
                    disabled={!resumeId}
                    onClick={() => preview.mutate(resumeId)}
                  >
                    Preview extracted text
                  </button>
                  {preview.isError && (
                    <ErrorState
                      error={preview.error}
                      retry={() => preview.mutate(resumeId)}
                    />
                  )}
                  {preview.data && preview.variables === resumeId && (
                    <div className="stack">
                      <p className="fine-print">
                        {preview.data.pages} pages ·{" "}
                        {preview.data.truncated
                          ? "Extraction limit reached (20 pages / 40,000 characters). Review may be incomplete."
                          : "Check this text before reviewing."}
                      </p>
                      <label>
                        Extracted resume text
                        <textarea
                          aria-label="Extracted resume text"
                          readOnly
                          rows={8}
                          value={preview.data.text}
                        />
                      </label>
                      <p className="fine-print">
                        If extraction missed content, choose pasted text and
                        supply the corrected text.
                      </p>
                    </div>
                  )}
                </>
              )}
            </fieldset>
            <fieldset className="review-fields" disabled={busy}>
              <legend>2. Choose the opportunity</legend>
              <label>
                Find application (optional)
                <input
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  placeholder="Search company or role…"
                />
              </label>
              <label>
                Linked application
                <select
                  aria-label="Linked application"
                  value={applicationId}
                  onChange={(e) => {
                    setApplicationId(e.target.value);
                    setLoadedApp(null);
                    changeDescription("");
                  }}
                >
                  <option value="">Standalone review</option>
                  {choices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.company} · {a.role}
                    </option>
                  ))}
                </select>
              </label>
              {application.isError && <ErrorState error={application.error} />}
              {applications.isError && (
                <ErrorState error={applications.error} />
              )}
              <label>
                Job description
                <textarea
                  rows={8}
                  minLength={50}
                  maxLength={20000}
                  required
                  aria-label="Job description"
                  value={description}
                  onChange={(e) => changeDescription(e.target.value)}
                  placeholder="Paste the responsibilities and requirements…"
                />
              </label>
              {applicationId && (
                <>
                  <button
                    type="button"
                    disabled={
                      !description.trim() ||
                      description.length > 20000 ||
                      application.isPending ||
                      saveJob.isPending
                    }
                    onClick={() => saveJob.mutate()}
                  >
                    Save job description to application
                  </button>
                  {saveJob.isError && <ErrorState error={saveJob.error} />}
                </>
              )}
              <p className="fine-print">
                Use 50–20,000 characters for the job description.
              </p>
              <button
                type="button"
                disabled={
                  description.trim().length < 50 || description.length > 20000
                }
                onClick={() => detect.mutate()}
              >
                Find requirements
              </button>
              {detect.isError && <ErrorState error={detect.error} />}
            </fieldset>
            {requirementsReady && (
              <fieldset className="review-fields" disabled={busy}>
                <legend>3. Review the checklist</legend>
                <p className="fine-print">
                  Detected terms are suggestions. Edit or remove them, then add
                  anything missing. Use manual review for experience, seniority
                  or other requirements needing judgment.
                </p>
                {!requirements.length && (
                  <p className="empty">
                    No requirements selected. Add custom terms below; a review
                    with no keywords will not receive a score.
                  </p>
                )}
                {requirements.map((r, i) => (
                  <div className="requirement-edit" key={i}>
                    <input
                      aria-label={`Requirement ${i + 1}`}
                      required
                      maxLength={200}
                      value={r.term}
                      onChange={(e) => {
                        setRequirements(
                          requirements.map((v, n) =>
                            n === i ? { ...v, term: e.target.value } : v,
                          ),
                        );
                        dirty();
                      }}
                    />
                    <select
                      aria-label={`Check type ${i + 1}`}
                      value={r.kind}
                      onChange={(e) => {
                        setRequirements(
                          requirements.map((v, n) =>
                            n === i
                              ? {
                                  ...v,
                                  kind: e.target.value as Requirement["kind"],
                                }
                              : v,
                          ),
                        );
                        dirty();
                      }}
                    >
                      <option value="keyword">Keyword</option>
                      <option value="manual">Manual review</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove requirement ${i + 1}`}
                      onClick={() => {
                        setRequirements(requirements.filter((_, n) => n !== i));
                        dirty();
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label>
                  Custom requirement
                  <input
                    maxLength={200}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                  />
                </label>
                <label>
                  Custom check type
                  <select
                    aria-label="Custom check type"
                    value={customKind}
                    onChange={(e) =>
                      setCustomKind(e.target.value as Requirement["kind"])
                    }
                  >
                    <option value="keyword">Keyword</option>
                    <option value="manual">Manual review</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!custom.trim() || requirements.length >= 50}
                  onClick={() => {
                    setRequirements([
                      ...requirements,
                      { term: custom.trim(), kind: customKind },
                    ]);
                    setCustom("");
                    dirty();
                  }}
                >
                  Add requirement
                </button>
                <button
                  className="primary"
                  disabled={
                    (!!applicationId && application.isPending) ||
                    (source === "pdf" &&
                      (!preview.data ||
                        preview.isError ||
                        preview.variables !== resumeId))
                  }
                >
                  {review.isPending ? "Reviewing…" : "Run free review"}
                </button>
              </fieldset>
            )}
            {review.isPending && <p role="status">Reviewing your resume…</p>}
            {review.isError && <ErrorState error={review.error} />}
          </form>
        </section>
        <section className="card">
          <h2>Review history</h2>
          {history.isPending ? (
            <Loading />
          ) : history.isError ? (
            <ErrorState error={history.error} retry={() => history.refetch()} />
          ) : history.data.length ? (
            history.data.map((r) => (
              <div className="history-item" key={r.id}>
                <button
                  className="history-select"
                  onClick={() => {
                    setSelected(r);
                    setStale(true);
                  }}
                >
                  {r.resume?.name ?? "Pasted resume"}
                  {r.application && ` · ${r.application.company}`}
                  <small>
                    {new Date(r.createdAt).toLocaleString()} ·{" "}
                    {r.status ?? (r.result ? "completed" : "failed")}
                    {r.mode !== "rules" ? " · Historical report" : ""}
                  </small>
                </button>
                <button onClick={() => setDeleting(r.id)}>Delete</button>
              </div>
            ))
          ) : (
            <p className="empty">
              Your saved reviews will appear here. Start with pasted text or an
              uploaded PDF.
            </p>
          )}
          {remove.isError && <ErrorState error={remove.error} />}
        </section>
      </div>
      {reportQuery.isError && <ErrorState error={reportQuery.error} />}
      {displayed && (
        <ReviewReport
          report={displayed}
          stale={stale || !!params.get("reportId")}
        />
      )}
      {deleting && (
        <Confirm
          title="Delete this review?"
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting)}
          busy={remove.isPending}
        />
      )}
    </>
  );
}
