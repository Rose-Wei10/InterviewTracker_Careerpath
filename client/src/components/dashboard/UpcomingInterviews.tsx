import { Link } from "react-router-dom";
import type { Interview } from "../../types";
export default function UpcomingInterviews({ data }: { data: Interview[] }) {
  return (
    <section className="card">
      <div className="section-heading">
        <h2>Up next</h2>
        <Link to="/calendar">View calendar ↗</Link>
      </div>
      {data.length === 0 ? (
        <div className="empty">
          Your next conversation is ahead.
          <p>Schedule an interview from an application.</p>
        </div>
      ) : (
        data.map((i) => (
          <Link
            className="interview-item"
            key={i.id}
            to={`/applications/${i.applicationId}`}
          >
            <div className="date-tile">
              <small>
                {new Date(i.startsAt).toLocaleDateString(undefined, {
                  month: "short",
                })}
              </small>
              <strong>{new Date(i.startsAt).getDate()}</strong>
            </div>
            <div>
              <strong>
                {i.application?.company} · {i.title}
              </strong>
              <p>
                {new Date(i.startsAt).toLocaleString(undefined, {
                  timeZone: i.timeZone,
                })}{" "}
                · {i.timeZone}
              </p>
            </div>
            <span className="badge">{i.type}</span>
          </Link>
        ))
      )}
    </section>
  );
}
