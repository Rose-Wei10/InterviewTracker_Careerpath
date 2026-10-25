import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import type { Interview } from "../types";
import { Loading, ErrorState } from "../components/ui";
export default function Calendar() {
  const api = useApi(),
    [month, setMonth] = useState(
      new Date().toLocaleDateString("en-CA").slice(0, 7),
    );
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
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
  const selectedDate = `${month}-${String(selectedDay).padStart(2, "0")}`;
  const selectedItems =
    query.data?.filter(
      (v) => new Date(v.startsAt).toLocaleDateString("en-CA") === selectedDate,
    ) ?? [];
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
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setSelectedDay(1);
              }
            }}
          />
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <>
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
                  <div
                    className={`calendar-day ${day === selectedDay ? "selected" : ""}`}
                    key={day}
                  >
                    <button
                      className="calendar-date"
                      aria-label={`Show interviews for ${month}-${String(day).padStart(2, "0")}`}
                      aria-pressed={day === selectedDay}
                      aria-current={
                        `${month}-${String(day).padStart(2, "0")}` ===
                        new Date().toLocaleDateString("en-CA")
                          ? "date"
                          : undefined
                      }
                      onClick={() => setSelectedDay(day)}
                    >
                      {day}
                    </button>
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
          <section className="card agenda" aria-label="Selected day agenda">
            <h2>
              {new Date(
                `${month}-${String(selectedDay).padStart(2, "0")}T12:00:00`,
              ).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {selectedItems.map((v) => (
              <Link
                className="interview-item"
                key={v.id}
                to={`/applications/${v.applicationId}`}
              >
                <div>
                  <strong>
                    {v.application?.company} · {v.title}
                  </strong>
                  <p>
                    {new Date(v.startsAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {v.type}
                  </p>
                </div>
                <span className="badge">{v.status}</span>
              </Link>
            ))}
            {selectedItems.length === 0 && (
              <p className="empty">
                No interviews on this day. Choose another date or schedule a
                round from an application.
              </p>
            )}
          </section>
        </>
      )}
      <section className="card">
        <h2>Reminder delivery</h2>
        <p className="fine-print">
          Check your scheduled reminders here. “Previewed” means no email was
          sent. If a delivery is marked “uncertain,” contact support before
          trying again.
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
