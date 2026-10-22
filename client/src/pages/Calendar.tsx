import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import type { Interview } from "../types";
import { Loading, ErrorState } from "../components/ui";
export default function Calendar() {
  const api = useApi(),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const query = useQuery({
    queryKey: ["interviews", api.userId],
    queryFn: () => api.get<Interview[]>("/interviews"),
  });
  const reminders = useQuery({
    queryKey: ["reminders", api.userId],
    queryFn: () =>
      api.get<{ id: string; kind: string; dueAt: string; status: string }[]>(
        "/reminders",
      ),
  });
  const start = new Date(`${month}-01T12:00:00`),
    offset = (start.getDay() + 6) % 7,
    days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</p>
          <h1>
            Interview calendar<span className="heading-dot">.</span>
          </h1>
          <p>
            Your conversations, organized. Times on this calendar use your
            device’s time zone.
          </p>
        </div>
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <section className="card calendar-scroll">
          <div className="calendar">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <strong className="day-label" key={d}>
                {d}
              </strong>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const items = query.data.filter((v) => {
                const dt = new Date(v.startsAt);
                return (
                  dt.getFullYear() === start.getFullYear() &&
                  dt.getMonth() === start.getMonth() &&
                  dt.getDate() === day
                );
              });
              return (
                <div className="calendar-day" key={day}>
                  <time>{day}</time>
                  {items.map((v) => (
                    <Link
                      key={v.id}
                      className={`calendar-event ${v.status === "Cancelled" ? "cancelled" : ""}`}
                      to={`/applications/${v.applicationId}`}
                    >
                      <strong>{v.application?.company}</strong>
                      <span>
                        {v.title} ·{" "}
                        {new Date(v.startsAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <small>{v.status}</small>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
          {!query.data.length && (
            <p className="empty">
              No interviews yet. Schedule a round from an application’s detail
              page.
            </p>
          )}
        </section>
      )}
      <section className="card">
        <h2>Reminder delivery</h2>
        <p className="fine-print">
          Local console delivery marks reminders “previewed” without sending
          email. SES requires a verified sender and a verified primary Clerk
          email. “Uncertain” deliveries require operator review before retrying
          to avoid duplicate email.
        </p>
        {reminders.isError ? (
          <ErrorState error={reminders.error} />
        ) : reminders.data?.length ? (
          <ul className="reminder-list">
            {reminders.data.map((r) => (
              <li key={r.id}>
                {r.kind} · {new Date(r.dueAt).toLocaleString()}{" "}
                <span className="badge">{r.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No reminders configured.</p>
        )}
      </section>
    </>
  );
}
