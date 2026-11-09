import { afterAll, afterEach, expect, test, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import prisma from "../src/config/prisma";

const api = request(
  createApp({
    auth: (req, res, next) => {
      res.locals.userId = req.get("x-test-owner") ?? "gmail-owner";
      next();
    },
  }),
);
const base = "/api/email-updates";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => prisma.$disconnect());

test("Gmail imports only labeled messages and reviews them with owner and status checks", async () => {
  if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
    throw Error("Isolated database required");
  vi.stubEnv("GMAIL_CLIENT_ID", "test-client");
  vi.stubEnv("GMAIL_CLIENT_SECRET", "test-secret");
  vi.stubEnv("GMAIL_REDIRECT_URI", "https://example.test/email-updates");
  vi.stubEnv("GMAIL_ENCRYPTION_KEY", "aa".repeat(32));
  let hasLabel = false;
  let expired = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      const path = url.pathname;
      if (path === "/token")
        return Response.json(
          expired
            ? { error: "invalid_grant" }
            : { access_token: "access", refresh_token: "refresh" },
        );
      if (path === "/revoke") return new Response(null, { status: 200 });
      if (path.endsWith("/profile"))
        return Response.json({ emailAddress: "jobs@example.test" });
      if (path.endsWith("/labels"))
        return Response.json({
          labels: hasLabel ? [{ id: "L1", name: "Careerpath" }] : [],
        });
      if (path.endsWith("/messages")) {
        expect(url.searchParams.get("labelIds")).toBe("L1");
        return Response.json({
          messages: ["first", "reply", "unlabeled"].map((id) => ({ id })),
        });
      }
      const id = path.split("/").at(-1);
      return Response.json({
        id,
        threadId: "same-thread",
        labelIds: id === "unlabeled" ? [] : ["L1"],
        internalDate: String(Date.now()),
        snippet: "Please schedule an interview. Private body.",
        payload: {
          headers: [
            { name: "Subject", value: "Maple Studio Software Engineer" },
          ],
        },
      });
    }),
  );
  const started = await api.post(`${base}/connect`);
  expect(started.status).toBe(200);
  const state = new URL(started.body.url).searchParams.get("state");
  expect(
    (
      await api
        .post(`${base}/callback`)
        .set("x-test-owner", "other")
        .send({ state, code: "code" })
    ).status,
  ).toBe(400);
  expect(
    (await api.post(`${base}/callback`).send({ state, code: "code" })).status,
  ).toBe(204);
  const connection = await prisma.gmailConnection.findUniqueOrThrow({
    where: { userId: "gmail-owner" },
  });
  expect(connection.encryptedRefreshToken).not.toContain("refresh");
  const application = await prisma.jobApplication.create({
    data: {
      userId: "gmail-owner",
      company: "Maple Studio",
      role: "Software Engineer",
      status: "OA",
    },
  });
  expect((await api.post(`${base}/sync`)).status).toBe(409);
  hasLabel = true;
  expect((await api.post(`${base}/sync`)).body).toEqual({
    imported: 2,
    hasMore: false,
  });
  expect(
    await prisma.activity.count({ where: { applicationId: application.id } }),
  ).toBe(0);
  expect(
    await prisma.interview.count({ where: { applicationId: application.id } }),
  ).toBe(0);
  const list = await api.get(base);
  expect(list.body.pending).toBe(2);
  expect(JSON.stringify(list.body)).not.toContain("Private body");
  expect(
    list.body.items.every(
      (item: { applicationId: string }) =>
        item.applicationId === application.id,
    ),
  ).toBe(true);
  const [first, reply] = list.body.items;
  const link = {
    action: "link",
    applicationId: application.id,
    statusChange: { from: "Applied", to: "Interview" },
  };
  expect(
    (
      await api
        .patch(`${base}/${first.id}`)
        .set("x-test-owner", "other")
        .send(link)
    ).status,
  ).toBe(404);
  expect((await api.patch(`${base}/${first.id}`).send(link)).status).toBe(409);
  link.statusChange.from = "OA";
  expect((await api.patch(`${base}/${first.id}`).send(link)).status).toBe(204);
  expect(
    await prisma.activity.count({
      where: { applicationId: application.id, kind: "EMAIL_LINKED" },
    }),
  ).toBe(1);
  expect(
    (await api.patch(`${base}/${reply.id}`).send({ action: "dismiss" })).status,
  ).toBe(204);
  expect((await api.post(`${base}/sync`)).body.imported).toBe(0);
  expect((await api.get(`${base}/count`)).body.pending).toBe(0);
  expired = true;
  expect((await api.post(`${base}/sync`)).status).toBe(409);
  expect((await api.delete(`${base}/connection`)).status).toBe(204);
  expect(
    await prisma.gmailConnection.count({ where: { userId: "gmail-owner" } }),
  ).toBe(0);
});
