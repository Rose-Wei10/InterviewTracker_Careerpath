import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import prisma from "../src/config/prisma";
import {
  eventAttention,
  eventDeadline,
  eventPanels,
} from "../src/services/events";
import { ghostReview, markGhosted } from "../src/services/ghostReview";
const app = createApp({
  auth: (_req, res, next) => {
    res.locals.userId = "calendar-owner";
    next();
  },
});
const api = (method: "get" | "post" | "patch", path: string) =>
  request(app)[method](path);
const day = 86400000;
afterAll(() => prisma.$disconnect());
describe("shared calendar and manual ghost review", () => {
  it("paginates 21 applications and enforces exact age, owner and status with concurrent reviews", async () => {
    if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
      throw Error("Isolated database required");
    const now = new Date("2030-01-31T12:00:00Z");
    await prisma.user.createMany({
      data: [{ id: "calendar-owner" }, { id: "calendar-other" }],
    });
    await prisma.jobApplication.createMany({
      data: Array.from({ length: 21 }, (_, i) => ({
        id: `page-${i}`,
        userId: "calendar-owner",
        company: `Page ${String(i).padStart(2, "0")}`,
        role: "Engineer",
        appliedDate: new Date(now.getTime() - 30 * day),
      })),
    });
    for (const [page, length] of [
      [1, 10],
      [2, 10],
      [3, 1],
    ]) {
      const r = await api("get", `/api/applications?page=${page}`);
      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(length);
      expect(r.body.total).toBe(21);
    }
    await prisma.jobApplication.createMany({
      data: [
        { id: "fresh", appliedDate: new Date(now.getTime() - 30 * day + 1) },
        { id: "mixed", appliedDate: new Date(0), status: "Interview" },
        { id: "foreign", appliedDate: new Date(0), userId: "calendar-other" },
      ].map((v) => ({
        company: v.id,
        role: "Engineer",
        userId: "calendar-owner",
        ...v,
      })),
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      const review = await ghostReview("calendar-owner", { page: 1 });
      expect(review.total).toBe(21);
      expect(review.items).toHaveLength(10);
      expect(
        (await ghostReview("calendar-owner", { page: 3 })).items,
      ).toHaveLength(1);
      await expect(
        markGhosted("calendar-owner", { ids: ["page-0", "foreign"] }),
      ).rejects.toThrow("Application not found");
      expect(
        (
          await prisma.jobApplication.findUniqueOrThrow({
            where: { id: "page-0" },
          })
        ).status,
      ).toBe("Applied");
      const result = await markGhosted("calendar-owner", {
        ids: ["page-0", "fresh", "mixed"],
      });
      expect(result.updatedIds).toEqual(["page-0"]);
      expect(result.skippedIds).toEqual(["fresh", "mixed"]);
      const concurrent = await Promise.all([
        markGhosted("calendar-owner", { ids: ["page-1"] }),
        markGhosted("calendar-owner", { ids: ["page-1"] }),
      ]);
      expect(concurrent.flatMap((v) => v.updatedIds)).toEqual(["page-1"]);
      expect(
        await prisma.activity.count({
          where: { applicationId: "page-1", kind: "STATUS_CHANGED" },
        }),
      ).toBe(1);
      // A status changed after the dialog loaded must be skipped.
      await prisma.jobApplication.update({
        where: { id: "page-2" },
        data: { status: "Offer" },
      });
      expect(
        (await markGhosted("calendar-owner", { ids: ["page-2"] })).skippedIds,
      ).toEqual(["page-2"]);
      const dashboard = await api("get", "/api/dashboard?from=2040-01-01");
      expect(dashboard.body.total).toBe(0);
      expect(dashboard.body.ghostCount).toBe(18);
    } finally {
      vi.useRealTimers();
    }
  });
  it("creates, links, reschedules, completes and cancels owned events without implicit stage changes or delivery jobs", async () => {
    const body = {
      title: "OA deadline",
      category: "OA",
      applicationId: "page-3",
      startsAt: "2030-03-10T16:00:00Z",
      timeZone: "America/Los_Angeles",
      allDay: true,
    };
    const created = await api("post", "/api/events").send(body);
    expect(created.status).toBe(201);
    expect(created.body.reminderMinutes).toBe(1440);
    expect(created.body.startsAt).toBe("2030-03-10T16:00:00.000Z");
    expect(
      (
        await prisma.jobApplication.findUniqueOrThrow({
          where: { id: "page-3" },
        })
      ).status,
    ).toBe("Applied");
    const changed = await api("patch", `/api/events/${created.body.id}`).send({
      updateApplicationStatus: true,
      startsAt: "2030-03-11T16:00:00Z",
    });
    expect(changed.status).toBe(200);
    expect(
      (
        await prisma.jobApplication.findUniqueOrThrow({
          where: { id: "page-3" },
        })
      ).status,
    ).toBe("OA");
    expect(
      (await api("get", "/api/applications/page-3")).body.events[0].id,
    ).toBe(created.body.id);
    expect((await api("get", "/api/interviews")).body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );
    expect(
      (
        await api("post", "/api/events").send({
          ...body,
          applicationId: "foreign",
        })
      ).status,
    ).toBe(404);
    const foreign = await prisma.interview.create({
      data: {
        userId: "calendar-other",
        title: "Private",
        startsAt: new Date(),
        timeZone: "UTC",
      },
    });
    expect((await api("get", `/api/events/${foreign.id}`)).status).toBe(404);
    expect(
      (
        await api("patch", `/api/events/${foreign.id}`).send({
          status: "Completed",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api("patch", `/api/events/${created.body.id}`).send({
          applicationId: "foreign",
        })
      ).status,
    ).toBe(404);
    for (const status of ["Completed", "Cancelled"]) {
      expect(
        (await api("patch", `/api/events/${created.body.id}`).send({ status }))
          .body.status,
      ).toBe(status);
    }
    const solo = await api("post", "/api/events").send({
      ...body,
      category: "Other",
      applicationId: null,
      title: "Portfolio deadline",
    });
    expect(solo.status).toBe(201);
    expect(
      (
        await api("patch", `/api/events/${solo.body.id}`).send({
          updateApplicationStatus: true,
        })
      ).status,
    ).toBe(400);
    expect(
      await prisma.reminder.count({
        where: { interviewId: { in: [solo.body.id, created.body.id] } },
      }),
    ).toBe(0);
    expect((await api("get", "/api/events")).status).toBe(400);
    expect(
      (await api("get", "/api/events?from=2030-01-01&to=2032-01-01")).status,
    ).toBe(400);
    const listed = await api(
      "get",
      "/api/events?from=2030-03-01T00:00:00Z&to=2030-03-31T23:59:59Z&pageSize=1&page=2",
    );
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(2);
    expect(listed.body.items).toHaveLength(1);
  });
  it("handles exact reminder/seven-day boundaries, no-reminder overdue events and all-day DST dates", async () => {
    const now = new Date("2030-03-10T17:00:00Z");
    const owner = "calendar-panels";
    await prisma.user.create({ data: { id: owner } });
    const rows = [
      {
        id: "due",
        startsAt: new Date(now.getTime() + 60 * 60000),
        reminderMinutes: 60,
      },
      {
        id: "not-yet",
        startsAt: new Date(now.getTime() + 60 * 60000 + 1),
        reminderMinutes: 60,
      },
      {
        id: "overdue",
        startsAt: new Date(now.getTime() - 1),
        reminderMinutes: null,
      },
      { id: "seven", startsAt: new Date(now.getTime() + 7 * day) },
      { id: "beyond", startsAt: new Date(now.getTime() + 7 * day + 1) },
      { id: "done", startsAt: new Date(0), status: "Completed" },
      { id: "cancelled", startsAt: new Date(0), status: "Cancelled" },
      {
        id: "all-day",
        startsAt: new Date("2030-03-10T16:00:00Z"),
        allDay: true,
        reminderMinutes: null,
        timeZone: "America/Los_Angeles",
      },
    ];
    await prisma.interview.createMany({
      data: rows.map((v) => ({
        userId: owner,
        title: v.id,
        timeZone: "UTC",
        ...v,
      })),
    });
    const panel = await eventPanels(owner, now);
    expect(panel.attention.map((v) => v.id).sort()).toEqual(["due", "overdue"]);
    expect(panel.upcoming.map((v) => v.id).sort()).toEqual([
      "all-day",
      "due",
      "not-yet",
      "seven",
    ]);
    const allDay = await prisma.interview.findUniqueOrThrow({
      where: { id: "all-day" },
    });
    expect(eventDeadline(allDay).toISOString()).toBe(
      "2030-03-11T07:00:00.000Z",
    );
    expect(
      eventAttention(allDay, new Date("2030-03-11T06:59:59Z")).overdue,
    ).toBe(false);
    expect(
      eventAttention(allDay, new Date("2030-03-11T07:00:00Z")).overdue,
    ).toBe(true);
    expect(
      (
        await eventPanels(owner, new Date("2030-03-11T07:00:00Z"))
      ).attention.map((v) => v.id),
    ).toContain("all-day");
    const fall = { ...allDay, startsAt: new Date("2030-11-03T17:00:00Z") };
    expect(eventDeadline(fall).toISOString()).toBe("2030-11-04T08:00:00.000Z");
    const attention = await api("get", "/api/events/attention");
    expect(attention.status).toBe(200);
    expect(attention.body.pageSize).toBe(10);
  });
  it("paginates independent dashboard attention and removes completed/cancelled events", async () => {
    await prisma.interview.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        id: `attention-${i}`,
        userId: "calendar-owner",
        title: `Attention ${i}`,
        timeZone: "UTC",
        startsAt: new Date(0),
        reminderMinutes: null,
      })),
    });
    const dashboard = await api("get", "/api/dashboard?from=2040-01-01");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.total).toBe(0);
    expect(dashboard.body.attentionCount).toBe(12);
    expect(dashboard.body.attention).toHaveLength(10);
    const second = await api("get", "/api/events/attention?page=2");
    expect(second.body.total).toBe(12);
    expect(second.body.items).toHaveLength(2);
    await api("patch", "/api/events/attention-0").send({ status: "Completed" });
    await api("patch", "/api/events/attention-1").send({ status: "Cancelled" });
    expect((await api("get", "/api/dashboard")).body.attentionCount).toBe(10);
    expect((await api("get", "/api/events/attention?page=3")).body.total).toBe(
      10,
    );
  });
});
