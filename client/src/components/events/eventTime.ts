import { formatInTimeZone } from "date-fns-tz";
import type { CalendarEvent } from "../../types";
export function eventDate(event: CalendarEvent) {
  return event.allDay
    ? formatInTimeZone(event.startsAt, event.timeZone, "yyyy-MM-dd")
    : formatInTimeZone(
        event.startsAt,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "yyyy-MM-dd",
      );
}
export function eventWhen(event: CalendarEvent) {
  if (event.allDay)
    return `${new Date(eventDate(event) + "T12:00:00").toLocaleDateString()} · All day`;
  return new Date(event.startsAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
export const eventQueryGroups = [
  "events",
  "application",
  "applications",
  "dashboard",
  "interviews",
  "ghost-review",
];
