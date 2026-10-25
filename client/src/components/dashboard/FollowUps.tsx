import { Link } from "react-router-dom";
import type { DashboardData } from "../../types";
export default function FollowUps({
  items,
  total,
}: {
  items: DashboardData["followUps"];
  total: number;
}) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>
            Follow-ups <span className="count">{total}</span>
          </h2>
          <p className="muted">Overdue and due in the next 7 days</p>
        </div>
      </div>
      {items.length ? (
        items.map((item) => {
          const overdue = new Date(item.followUpAt).getTime() < Date.now();
          return (
            <div className="follow-up-item" key={item.id}>
              <div>
                <Link className="company-link" to={`/applications/${item.id}`}>
                  {item.company}
                </Link>
                <p>{item.role}</p>
                <time dateTime={item.followUpAt}>
                  {new Date(item.followUpAt).toLocaleString()}
                </time>
              </div>
              <span className={`badge ${overdue ? "overdue" : ""}`}>
                {overdue ? "Overdue" : "Upcoming"}
              </span>
              <Link
                className="button"
                aria-label={`Manage follow-up for ${item.company}`}
                to={`/applications/${item.id}?edit=1`}
              >
                Manage
                <span className="sr-only"> follow-up for {item.company}</span>
              </Link>
            </div>
          );
        })
      ) : (
        <div className="empty">
          <h3>You’re all caught up</h3>
          <p>No follow-ups due. Set a date when editing an application.</p>
        </div>
      )}
      {total > items.length && (
        <p className="fine-print">
          Showing the earliest {items.length} of {total} follow-ups.
        </p>
      )}
    </section>
  );
}
