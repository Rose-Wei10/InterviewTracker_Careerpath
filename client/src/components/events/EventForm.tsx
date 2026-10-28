import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import { invalidateUserQueries } from "../../services/queryCache";
import { Modal } from "../ui";
import type {
  Application,
  CalendarEvent,
  EventCategory,
  Page,
} from "../../types";
import { eventQueryGroups } from "./eventTime";
export default function EventForm({
  event,
  application,
  date,
  onClose,
}: {
  event?: CalendarEvent;
  application?: Pick<Application, "id" | "company" | "role">;
  date?: string;
  onClose: () => void;
}) {
  const api = useApi(),
    qc = useQueryClient();
  const zone =
    event?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [form, setForm] = useState({
    title: event?.title ?? "",
    category:
      event?.category ??
      ((application ? "Interview" : "Other") as EventCategory),
    applicationId: event?.applicationId ?? application?.id ?? "",
    date: event
      ? formatInTimeZone(event.startsAt, zone, "yyyy-MM-dd")
      : (date ?? formatInTimeZone(new Date(), zone, "yyyy-MM-dd")),
    time: event ? formatInTimeZone(event.startsAt, zone, "HH:mm") : "09:00",
    timeZone: zone,
    allDay: event?.allDay ?? !application,
    notes: event?.notes ?? "",
    type: event?.type ?? "video",
    reminderMinutes: event ? String(event.reminderMinutes ?? "") : "1440",
    status: event?.status ?? "Scheduled",
  });
  const [search, setSearch] = useState(""),
    [sync, setSync] = useState(false);
  const applications = useQuery({
    queryKey: ["event-applications", api.userId, search],
    queryFn: () =>
      api.get<Page<Application>>("/applications", {
        search,
        pageSize: 10,
        page: 1,
      }),
  });
  const [savedApplication, setSavedApplication] = useState(
    event?.application ?? application,
  );
  const choices = [
    ...(savedApplication ? [savedApplication] : []),
    ...(applications.data?.items ?? []),
  ].filter((a, i, all) => all.findIndex((v) => v.id === a.id) === i);
  const save = useMutation({
    mutationFn: () => {
      const wall = `${form.date}T${form.allDay ? "09:00" : form.time}`;
      const unchangedTime =
        event &&
        form.timeZone === event.timeZone &&
        form.allDay === event.allDay &&
        form.date ===
          formatInTimeZone(event.startsAt, event.timeZone, "yyyy-MM-dd") &&
        form.time === formatInTimeZone(event.startsAt, event.timeZone, "HH:mm");
      const instant = unchangedTime
        ? new Date(event.startsAt)
        : fromZonedTime(wall, form.timeZone);
      if (
        !Number.isFinite(instant.getTime()) ||
        formatInTimeZone(instant, form.timeZone, "yyyy-MM-dd'T'HH:mm") !== wall
      )
        throw new Error(
          "Choose a valid date and time. This time may be skipped by daylight saving.",
        );
      const { date: _date, time: _time, ...fields } = form;
      void _date;
      void _time;
      const body = {
        ...fields,
        applicationId: form.applicationId || null,
        startsAt: instant.toISOString(),
        type: form.category === "Interview" ? form.type : "other",
        reminderMinutes: form.reminderMinutes
          ? Number(form.reminderMinutes)
          : null,
        updateApplicationStatus:
          sync && !!form.applicationId && form.category !== "Other",
      };
      return event
        ? api.patch(`/events/${event.id}`, body)
        : api.post("/events", body);
    },
    onSuccess: async () => {
      await invalidateUserQueries(qc, api.userId, eventQueryGroups);
      toast.success(event ? "Event updated" : "Event added");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const change = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <Modal title={event ? "Edit event" : "Add event"} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="form-grid">
          <label className="full-width">
            Title
            <input
              name="title"
              required
              maxLength={200}
              value={form.title}
              onChange={change}
              placeholder="e.g. Coding assessment deadline"
            />
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              name="category"
              value={form.category}
              onChange={change}
            >
              {["OA", "Interview", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              name="status"
              value={form.status}
              onChange={change}
            >
              {["Scheduled", "Completed", "Cancelled"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={change}
              required
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
            />
            All-day event
          </label>
          {!form.allDay && (
            <label>
              Time
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={change}
                required
              />
            </label>
          )}
          <label>
            Time zone
            <input
              name="timeZone"
              value={form.timeZone}
              onChange={change}
              required
              maxLength={100}
              placeholder="America/Los_Angeles"
            />
          </label>
          {form.category === "Interview" && (
            <label>
              Interview format
              <select
                aria-label="Interview format"
                name="type"
                value={form.type}
                onChange={change}
              >
                {[
                  "video",
                  "phone",
                  "technical",
                  "behavioral",
                  "onsite",
                  "other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Dashboard reminder
            <select
              aria-label="Dashboard reminder"
              name="reminderMinutes"
              value={form.reminderMinutes}
              onChange={change}
            >
              <option value="">None</option>
              <option value="15">15 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
              {form.reminderMinutes &&
                !["15", "60", "1440"].includes(form.reminderMinutes) && (
                  <option value={form.reminderMinutes}>
                    {form.reminderMinutes} minutes before (saved)
                  </option>
                )}
            </select>
          </label>
          <label className="full-width">
            Find application (optional)
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or role…"
            />
          </label>
          <label className="full-width">
            Linked application
            <select
              aria-label="Linked application"
              name="applicationId"
              value={form.applicationId}
              onChange={(e) => {
                setSavedApplication(
                  choices.find((a) => a.id === e.target.value),
                );
                change(e);
              }}
            >
              <option value="">No linked application</option>
              {choices.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.role}
                </option>
              ))}
            </select>
          </label>
          {applications.isError && (
            <p role="alert">
              Applications could not load. Retry by searching again.
            </p>
          )}
          {!!form.applicationId && form.category !== "Other" && (
            <label className="full-width check-label">
              <input
                type="checkbox"
                checked={sync}
                onChange={(e) => setSync(e.target.checked)}
              />
              Also update application status to {form.category}
            </label>
          )}
          <label className="full-width">
            Notes
            <textarea
              name="notes"
              maxLength={10000}
              value={form.notes}
              onChange={change}
              rows={3}
            />
          </label>
        </div>
        <p className="fine-print">
          Dashboard reminders appear when you open the app. All-day reminders
          use 9am in the saved time zone. For repeated daylight-saving hours,
          verify the saved time after scheduling.
        </p>
        <div className="actions modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : event ? "Save event" : "Add event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
