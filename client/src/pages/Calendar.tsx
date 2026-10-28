import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "../hooks/useApi";
import type { CalendarEvent, Page } from "../types";
import { Loading, ErrorState } from "../components/ui";
import EventForm from "../components/events/EventForm";
import EventList from "../components/events/EventList";
import { eventDate } from "../components/events/eventTime";
export default function Calendar() {
  const api = useApi(),
    [params, setParams] = useSearchParams();
  const today = formatInTimeZone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "yyyy-MM-dd",
  );
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selectedDate, setSelectedDate] = useState(today),
    [editing, setEditing] = useState<CalendarEvent | null | undefined>(
      undefined,
    );
  const attention = params.get("view") === "attention";
  const start = new Date(`${month}-01T12:00:00`),
    days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
    offset = (start.getDay() + 6) % 7;
  const from = new Date(
      start.getFullYear(),
      start.getMonth(),
      -1,
    ).toISOString(),
    to = new Date(start.getFullYear(), start.getMonth() + 1, 3).toISOString();
  const query = useInfiniteQuery({
    queryKey: ["events", api.userId, month, attention],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Page<CalendarEvent>>(
        attention ? "/events/attention" : "/events",
        attention
          ? { page: pageParam }
          : { from, to, page: pageParam, pageSize: 100 },
      ),
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    refetchInterval: 60000,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  function chooseMonth(value: string) {
    if (!value) return;
    setMonth(value);
    setSelectedDate(value + "-01");
  }
  function shiftMonth(delta: number) {
    const date = new Date(start.getFullYear(), start.getMonth() + delta, 1, 12);
    chooseMonth(
      formatInTimeZone(
        date,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "yyyy-MM",
      ),
    );
  }
  const selected = items.filter((event) => eventDate(event) === selectedDate);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT'S NEXT</p>
          <h1>
            Calendar<span className="heading-dot">.</span>
          </h1>
          <p>OA deadlines, interviews and everything else worth remembering.</p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add event
        </button>
      </div>
      <div className="calendar-toolbar">
        <div className="segmented" aria-label="Calendar view">
          <button aria-pressed={!attention} onClick={() => setParams({})}>
            Calendar
          </button>
          <button
            aria-pressed={attention}
            onClick={() => setParams({ view: "attention" })}
          >
            Needs attention
          </button>
        </div>
        {!attention && (
          <div className="actions">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={17} />
            </button>
            <label className="sr-only" htmlFor="calendar-month">
              Month
            </label>
            <input
              id="calendar-month"
              type="month"
              value={month}
              onChange={(e) => chooseMonth(e.target.value)}
            />
            <button aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelectedDate(today);
              }}
            >
              Today
            </button>
          </div>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : attention ? (
        <section className="card">
          <h2>Needs attention</h2>
          <p className="muted">
            Due reminders and unfinished past events. Complete or cancel an
            event to clear it.
          </p>
          <EventList
            items={items}
            onEdit={setEditing}
            empty="You're all caught up. No event reminders need attention."
          />
        </section>
      ) : (
        <>
          <p className="fine-print">
            Timed events use your device's time zone. All-day events keep their
            saved date.
          </p>
          <section className="card calendar-scroll">
            <div className="calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <strong className="day-label" key={day}>
                  {day}
                </strong>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`,
                  events = items.filter((event) => eventDate(event) === date);
                return (
                  <div
                    className={`calendar-day ${selectedDate === date ? "selected" : ""} ${date === today ? "today" : ""}`}
                    key={date}
                  >
                    <div className="calendar-day-heading">
                      <button
                        className="calendar-date"
                        aria-label={`Show events for ${date}`}
                        aria-pressed={selectedDate === date}
                        aria-current={date === today ? "date" : undefined}
                        onClick={() => setSelectedDate(date)}
                      >
                        {i + 1}
                      </button>
                      <button
                        className="day-add"
                        aria-label={`Add event on ${date}`}
                        onClick={() => {
                          setSelectedDate(date);
                          setEditing(null);
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {events.map((event) => (
                      <button
                        key={event.id}
                        className={`calendar-event category-${event.category.toLowerCase()} ${event.status === "Cancelled" ? "cancelled" : ""}`}
                        aria-label={`Edit event ${event.title}`}
                        onClick={() => setEditing(event)}
                      >
                        <strong>{event.title}</strong>
                        <span>
                          {event.allDay
                            ? "All day"
                            : new Date(event.startsAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                          {event.application
                            ? ` · ${event.application.company}`
                            : ""}
                        </span>
                        {event.status !== "Scheduled" && (
                          <small>{event.status}</small>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card agenda" aria-label="Selected day agenda">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR DAY</p>
                <h2>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
              </div>
              <button onClick={() => setEditing(null)}>
                + Add event on this date
              </button>
            </div>
            <EventList
              items={selected}
              onEdit={setEditing}
              empty="Nothing planned for this date. Add an event to get started."
            />
          </section>
        </>
      )}
      {query.hasNextPage && (
        <div className="load-events">
          <p>
            Showing {items.length} of {query.data?.pages[0].total} events. Load
            more to include the remaining events in this view.
          </p>
          <button
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more events"}
          </button>
        </div>
      )}
      {editing !== undefined && (
        <EventForm
          event={editing ?? undefined}
          date={selectedDate}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
