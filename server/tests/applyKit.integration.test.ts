import { afterAll, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import prisma from "../src/config/prisma";

const app = request(
  createApp({
    auth: (req, res, next) => {
      res.locals.userId = req.get("x-kit-owner") ?? "kit-owner";
      next();
    },
  }),
);
const base = "/api/apply-kit";
afterAll(() => prisma.$disconnect());

test("Apply Kit stores private answers and rejects stale edits", async () => {
  if (!process.env.DATABASE_URL?.includes("interview_tracker_test"))
    throw Error("Isolated database required");

  const initial = await app.get(base);
  expect(initial.status).toBe(200);
  expect(initial.headers["cache-control"]).toBe("no-store");
  expect(initial.body.entries).toEqual([]);
  expect(initial.body.starters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        starterKey: "first-name",
        prompt: "Legal first name",
      }),
    ]),
  );

  const added = await app
    .post(base)
    .send({ starterKey: "first-name", answer: "Sample" });
  expect(added.status).toBe(201);
  const id = added.body.id;
  expect(
    (
      await app
        .post(base)
        .send({ starterKey: "first-name", answer: "Duplicate" })
    ).status,
  ).toBe(409);
  expect(
    (await app.get(base).set("x-kit-owner", "kit-other")).body.entries,
  ).toEqual([]);
  expect(
    (
      await app
        .patch(`${base}/${id}`)
        .set("x-kit-owner", "kit-other")
        .send({ answer: "Intruder", revision: 1 })
    ).status,
  ).toBe(404);
  expect(
    (
      await app
        .delete(`${base}/${id}?revision=1`)
        .set("x-kit-owner", "kit-other")
    ).status,
  ).toBe(404);

  expect(
    (await app.patch(`${base}/${id}`).send({ answer: "Updated", revision: 1 }))
      .status,
  ).toBe(204);
  expect(
    (await app.patch(`${base}/${id}`).send({ answer: "Outdated", revision: 1 }))
      .status,
  ).toBe(409);
  expect((await app.delete(`${base}/${id}?revision=1`)).status).toBe(409);
  expect((await app.get(base)).body.entries[0].answer).toBe("Updated");
  expect((await app.delete(`${base}/${id}?revision=2`)).status).toBe(204);
  expect((await app.get(base)).body.entries).toEqual([]);
  expect(
    (
      await app
        .post(base)
        .send({ category: "General", prompt: "Custom?", answer: " " })
    ).status,
  ).toBe(400);
});
