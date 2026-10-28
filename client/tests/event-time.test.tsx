import { afterEach, expect, it, vi } from "vitest";
import { eventDate, eventWhen } from "../src/components/events/eventTime";
import type { CalendarEvent } from "../src/types";
afterEach(() => vi.restoreAllMocks());
it("keeps all-day dates in their saved zone while timed events use the viewer zone", () => {
  const options = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...options,
    timeZone: "Asia/Tokyo",
  });
  const event: CalendarEvent = {
    id: "date",
    applicationId: null,
    category: "OA",
    title: "Deadline",
    startsAt: "2030-03-10T16:00:00.000Z",
    timeZone: "America/Los_Angeles",
    allDay: true,
    type: "other",
    status: "Scheduled",
    reminderMinutes: 1440,
    notes: null,
  };
  expect(eventDate(event)).toBe("2030-03-10");
  expect(eventWhen(event)).toContain("All day");
  expect(eventDate({ ...event, allDay: false })).toBe("2030-03-11");
  expect(eventDate({ ...event, startsAt: "2030-11-03T17:00:00.000Z" })).toBe(
    "2030-11-03",
  );
});
