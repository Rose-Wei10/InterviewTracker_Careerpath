import type { Analysis as SavedAnalysis, AnalysisResult } from "../../types";
function LegacyResults({
  result,
  demo,
}: {
  result: AnalysisResult;
  demo: boolean;
}) {
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
            ? "This historical report did not include writing guidance. Run a free review for current editing prompts."
            : "No improvements suggested."}
        </p>
      )}
    </section>
  );
}

export default function ReviewReport({
  report,
  stale = false,
}: {
  report: SavedAnalysis;
  stale?: boolean;
}) {
  const result = report.result;
  return (
    <section className="card review-report" aria-label="Resume review report">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAVED REVIEW</p>
          <h2>
            {report.resume?.name ?? "Pasted resume"}
            {report.application ? ` · ${report.application.company}` : ""}
          </h2>
          <p className="fine-print">
            {new Date(report.createdAt).toLocaleString()} ·{" "}
            {report.status ?? (result ? "completed" : "failed")}
          </p>
        </div>
        {result && (
          <button className="no-print" onClick={() => window.print()}>
            Print report
          </button>
        )}
      </div>
      {stale && (
        <p className="info-note" role="status">
          This report belongs to previous inputs. Run a new review for your
          current form.
        </p>
      )}
      {report.status === "pending" ? (
        <p role="status">
          Review is processing. Reopen history shortly. If it was interrupted,
          start a new review after five minutes.
        </p>
      ) : report.status === "failed" || !result ? (
        <p role="alert">
          {report.failureReason ??
            "This review did not finish. Run a new review to try again."}
        </p>
      ) : "schemaVersion" in result && result.schemaVersion === 2 ? (
        <>
          <div className="review-summary">
            <strong>
              {result.keywordCount
                ? `${result.foundCount} of ${result.keywordCount} reviewed keywords found`
                : "No keyword assessment available"}
            </strong>
            <p>
              Free rule-based review. Keyword mentions do not prove proficiency.
              This is not an ATS score or hiring prediction.
            </p>
          </div>
          {result.warnings.map((w) => (
            <p className="info-note" key={w}>
              {w}
            </p>
          ))}
          <h3>Requirement checklist</h3>
          <p className="fine-print">
            “Not found” means no matching mention was detected, not that you
            lack the skill. Semantic requirements need your judgment.
          </p>
          {!result.checks.length && (
            <p className="empty">
              No requirements were selected. Add custom terms or manual
              requirements and run another review.
            </p>
          )}
          <div className="requirement-results">
            {result.checks.map((r, i) => (
              <article key={i}>
                <div className="section-heading">
                  <strong>{r.term}</strong>
                  <span
                    className={`badge ${r.found ? "category-other" : "category-oa"}`}
                  >
                    {r.kind === "manual"
                      ? "Review manually"
                      : r.found
                        ? "Found in resume"
                        : "Not found—review manually"}
                  </span>
                </div>
                {r.quote && <blockquote>{r.quote}</blockquote>}
              </article>
            ))}
          </div>
          <h3>Improve your existing bullets</h3>
          <p className="fine-print">
            These are editing prompts, not generated achievements. Use only
            facts you can verify.
          </p>
          {result.improvements.length ? (
            result.improvements.map((r, i) => (
              <blockquote key={i}>
                <p>
                  <strong>Original:</strong> {r.original}
                </p>
                <ul>
                  {r.suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </blockquote>
            ))
          ) : (
            <p className="empty">
              No common wording issues were flagged. Review the requirements
              above for missing evidence.
            </p>
          )}
          <h3>Prepare truthful examples</h3>
          {result.preparationTopics.length ? (
            <ul>
              {result.preparationTopics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <p>
              No additional prompts. Confirm the depth and relevance of each
              example yourself.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="info-note">
            Historical report · Generated by the previous {report.mode}{" "}
            workflow.
          </p>
          <LegacyResults
            result={result as AnalysisResult}
            demo={report.mode === "demo"}
          />
        </>
      )}
      <details>
        <summary>Job description used for this report</summary>
        <p className="notes">{report.jobDescription}</p>
      </details>
    </section>
  );
}
