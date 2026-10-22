import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import type {
  Resume,
  Analysis as SavedAnalysis,
  AnalysisResult,
} from "../types";
import { Loading, ErrorState, Confirm } from "../components/ui";
export default function Analysis() {
  const api = useApi(),
    qc = useQueryClient(),
    [resumeId, setResumeId] = useState(""),
    [description, setDescription] = useState(""),
    [consent, setConsent] = useState(false),
    [selected, setSelected] = useState<SavedAnalysis | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  const config = useQuery({
    queryKey: ["analysis-config", api.userId],
    queryFn: () =>
      api.get<{
        mode: string;
        dailyLimit: number;
        providerOrigin: string;
        model: string;
      }>("/analyses/config"),
  });
  const resumes = useQuery({
    queryKey: ["resumes", api.userId],
    queryFn: () => api.get<Resume[]>("/resumes"),
  });
  const history = useQuery({
    queryKey: ["analyses", api.userId],
    queryFn: () => api.get<SavedAnalysis[]>("/analyses"),
  });
  const analyze = useMutation({
    mutationFn: () =>
      api.post<SavedAnalysis>("/analyses", {
        resumeId,
        jobDescription: description,
        consent,
      }),
    onSuccess: (r) => {
      setSelected(r);
      void qc.invalidateQueries({ queryKey: ["analyses"] });
      toast.success("Analysis ready");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.remove(`/analyses/${id}`),
    onSuccess: () => {
      if (selected?.id === deleting) setSelected(null);
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const demo = config.data?.mode === "demo";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A THOUGHTFUL SECOND LOOK</p>
          <h1>
            Find your fit<span className="heading-dot">.</span>
          </h1>
          <p>Connect the evidence in your resume to the opportunity ahead.</p>
        </div>
        <Sparkles size={28} />
      </div>
      {config.isError ? (
        <ErrorState error={config.error} />
      ) : config.isPending ? (
        <Loading />
      ) : (
        <div className="info-note">
          {demo
            ? "Demo mode · Local keyword comparison. These results are not genuine AI analysis."
            : `AI mode · Resume text and job description are sent to ${config.data.providerOrigin} (${config.data.model}).`}{" "}
          Up to {config.data.dailyLimit} requests per rolling day, including
          failed attempts.
        </div>
      )}
      <div className="detail-grid">
        <section className="card">
          <h2>Compare an opportunity</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              analyze.mutate();
            }}
          >
            <label>
              Resume
              <select
                required
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
              >
                <option value="">Select a resume</option>
                {resumes.data?.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name} · v{r.version}
                  </option>
                ))}
              </select>
            </label>
            {resumes.isError && <ErrorState error={resumes.error} />}
            <label>
              Job description
              <textarea
                rows={10}
                required
                minLength={50}
                maxLength={20000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the role’s responsibilities and requirements…"
              />
            </label>
            {!demo && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                I consent to sharing this resume’s text and job description with
                the configured AI provider.
              </label>
            )}
            <button
              className="primary"
              disabled={
                analyze.isPending || !config.data || (!demo && !consent)
              }
            >
              <Sparkles size={16} />
              {analyze.isPending
                ? "Analyzing…"
                : demo
                  ? "Run demo comparison"
                  : "Analyze resume"}
            </button>
          </form>
        </section>
        <section className="card">
          <h2>Analysis history</h2>
          {history.isPending ? (
            <Loading />
          ) : history.isError ? (
            <ErrorState error={history.error} />
          ) : history.data.length ? (
            history.data.map((r) => (
              <div className="history-item" key={r.id}>
                <button
                  className="history-select"
                  onClick={() => setSelected(r)}
                >
                  {r.resume.name}
                  <small>
                    {new Date(r.createdAt).toLocaleString()} · {r.mode} ·{" "}
                    {r.result ? "Completed" : "Failed / incomplete"}
                  </small>
                </button>
                <button onClick={() => setDeleting(r.id)}>Delete</button>
              </div>
            ))
          ) : (
            <div className="empty">Your comparisons will appear here.</div>
          )}
        </section>
      </div>
      {selected?.result && (
        <Results result={selected.result} demo={selected.mode === "demo"} />
      )}
      {deleting && (
        <Confirm
          title="Delete this analysis?"
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting)}
          busy={remove.isPending}
        />
      )}
    </>
  );
}
function Results({ result, demo }: { result: AnalysisResult; demo: boolean }) {
  return (
    <section className="card analysis-result">
      <div className="section-heading">
        <div>
          <h2>
            {demo ? "Demo comparison" : "AI suggestions — review before use"}
          </h2>
          <p className="fine-print">
            Evidence snippets are checked against your document. Mentions do not
            establish proficiency. Suggestions are unverified coaching advice.
          </p>
        </div>
        <span className="score">{result.heuristicScore}%</span>
      </div>
      <p className="info-note">{result.assessmentLabel}</p>
      <div className="detail-grid">
        <div>
          <h3>Skills evidenced in your resume</h3>
          {result.supportedSkills.length ? (
            result.supportedSkills.map((s) => (
              <blockquote key={s.skill}>
                <strong>{s.skill}</strong>
                <p>“{s.quote}”</p>
              </blockquote>
            ))
          ) : (
            <p>No supported keyword matches found.</p>
          )}
        </div>
        <div>
          <h3>In the job description, not evidenced</h3>
          <div className="skill-list">
            {result.missingSkills.map((s) => (
              <span className="badge" key={s}>
                {s}
              </span>
            ))}
          </div>
          <p className="fine-print">
            This does not mean you lack these skills. Add evidence only if it is
            true.
          </p>
          <h3>Interview preparation topics</h3>
          <ul>
            {result.preparationTopics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <h3>Suggestions for your bullet points</h3>
      {result.improvements.length ? (
        result.improvements.map((i, n) => (
          <blockquote key={n}>
            <p>Original: {i.original}</p>
            <p>Suggestion: {i.suggestion}</p>
          </blockquote>
        ))
      ) : (
        <p className="muted">
          {demo
            ? "The keyword demo does not generate resume writing suggestions. Configure an AI provider for evidence-linked coaching."
            : "No improvements suggested."}
        </p>
      )}
    </section>
  );
}
