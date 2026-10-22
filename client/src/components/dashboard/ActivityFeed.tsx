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
                <strong>{item.application?.company ?? "Application"}</strong>
                <p className="capitalize">
                  {activityLabel(item.kind)}{" "}
                  {typeof item.metadata.to === "string"
                    ? `→ ${item.metadata.to}`
                    : ""}
                </p>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
