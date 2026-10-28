import { useId } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import { invalidateUserQueries } from "../../services/queryCache";
import type { CalendarEvent } from "../../types";
import { eventQueryGroups, eventWhen } from "./eventTime";
export default function EventList({
  items,
  onEdit,
  empty = "Nothing scheduled yet. Add an event to plan your next step.",
}: {
  items: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  empty?: string;
}) {
  const prefix = useId();
  const api = useApi(),
    qc = useQueryClient();
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/events/${id}`, { status }),
    onSuccess: async () => {
      await invalidateUserQueries(qc, api.userId, eventQueryGroups);
      toast.success("Event updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <div className="event-list">
      {items.map((event) => (
        <article
          className={`event-row event-${event.category.toLowerCase()} ${event.status === "Cancelled" ? "cancelled" : ""}`}
          key={event.id}
        >
          <button
            className="event-open"
            onClick={() => onEdit(event)}
            aria-label={`Edit event ${event.title}`}
          >
            <span className="event-meta">
              <span
                className={`badge category-${event.category.toLowerCase()}`}
              >
                {event.category}
              </span>
              {event.needsAttention && event.status === "Scheduled" && (
                <span
                  className={`badge ${event.overdue ? "overdue" : "category-oa"}`}
                >
                  {event.overdue ? "Overdue" : "Reminder due"}
                </span>
              )}
            </span>
            <strong>{event.title}</strong>
            {event.application && (
              <span>
                {event.application.company} · {event.application.role}
              </span>
            )}
            <time dateTime={event.startsAt}>{eventWhen(event)}</time>
          </button>
          <label
            className="sr-only"
            htmlFor={`${prefix}-event-status-${event.id}`}
          >
            Status for {event.title}
          </label>
          <select
            id={`${prefix}-event-status-${event.id}`}
            value={event.status}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({ id: event.id, status: e.target.value })
            }
          >
            {["Scheduled", "Completed", "Cancelled"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </article>
      ))}
    </div>
  );
}
