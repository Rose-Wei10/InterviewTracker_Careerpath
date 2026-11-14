import { Link } from "react-router-dom";
import type { Activity } from "../../types";
export function activityLabel(kind: string) {
  return kind.toLowerCase().replaceAll("_", " ");
}
export default function ActivityFeed({ data }: { data: Activity[] }) {
  return (
    <section className="card">
      <div className="section-heading">
        <h2>Recent activity</h2>
        <span className="muted">Your search, in motion</span>
      </div>
      {data.length === 0 ? (
        <div className="empty">New activity will appear here.</div>
      ) : (
        <ol className="timeline">
          {data.map((item) => (
            <li key={item.id}>
              <span className="timeline-dot" />
              <div>
                {item.application?.id || item.applicationId ? (
                  <Link
                    to={`/applications/${item.application?.id ?? item.applicationId}`}
                  >
                    <strong>
                      {item.application?.company ?? "Application"}
                    </strong>
                  </Link>
                ) : (
                  <strong>{item.application?.company ?? "Application"}</strong>
                )}
                <p className="capitalize">
                  {activityLabel(item.kind)}{" "}
                  {typeof item.metadata.to === "string"
                    ? `→ ${item.metadata.to}`
                    : ""}
                </p>
                {item.kind === "SUBMISSION_CONFIRMED" && (
                  <details>
                    <summary>Submission evidence</summary>
                    <p>
                      {typeof item.metadata.excerpt === "string"
                        ? item.metadata.excerpt
                        : ""}
                    </p>
                    <p>
                      {typeof item.metadata.confirmedAt === "string"
                        ? item.metadata.confirmedAt
                        : ""}
                    </p>
                    {typeof item.metadata.sourceUrl === "string" &&
                      /^https?:\/\//.test(item.metadata.sourceUrl) && (
                        <a
                          href={item.metadata.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Receipt source
                        </a>
                      )}
                    {typeof item.metadata.emailUpdateId === "string" && (
                      <p>Email reference: {item.metadata.emailUpdateId}</p>
                    )}
                  </details>
                )}
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
