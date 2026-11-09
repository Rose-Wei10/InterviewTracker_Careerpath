import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import prisma from "../config/prisma";
import { HttpError } from "../lib/errors";
import {
  gmailConfig,
  gmailGet,
  gmailToken,
  seal,
  unseal,
} from "../services/gmail";
import { statuses } from "../lib/validation";
import {
  suggestEmailApplication,
  suggestEmailCategory,
} from "../services/gmailSuggestions";

const router = Router();

router.get("/count", async (_req, res) => {
  res.json({
    pending: await prisma.emailUpdate.count({
      where: { userId: String(res.locals.userId), state: "pending" },
    }),
  });
});

router.get("/", async (_req, res) => {
  const userId = String(res.locals.userId);
  const [connection, pending, items] = await Promise.all([
    prisma.gmailConnection.findUnique({
      where: { userId },
      select: { account: true, lastSyncedAt: true },
    }),
    prisma.emailUpdate.count({ where: { userId, state: "pending" } }),
    prisma.emailUpdate.findMany({
      where: { userId, state: "pending" },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);
  res.json({ connection, pending, items });
});

router.post("/connect", (_req, res) => {
  const { client_id, redirect_uri } = gmailConfig();
  const state = seal(
    String(Date.now() + 10 * 60_000),
    `state:${res.locals.userId}`,
  );
  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    state,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

router.post("/callback", async (req, res) => {
  const { code, state } = z
    .object({
      code: z.string().min(1).max(2048),
      state: z.string().min(1).max(512),
    })
    .parse(req.body);
  const userId = String(res.locals.userId);
  let expires = 0;
  try {
    expires = Number(unseal(state, `state:${userId}`));
  } catch {
    /* Invalid state. */
  }
  if (!(expires > Date.now()))
    throw new HttpError(
      400,
      "Gmail connection expired. Start again in Careerpath.",
    );
  const token = await gmailToken({ grant_type: "authorization_code", code });
  if (!token.refresh_token)
    throw new HttpError(
      409,
      "Google did not grant offline access. Reconnect and approve Gmail access.",
    );
  const { emailAddress: account } = await gmailGet<{ emailAddress: string }>(
    token.access_token,
    "profile",
  );
  const encryptedRefreshToken = seal(
    token.refresh_token,
    `refresh:${userId}:${account}`,
  );
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  });
  await prisma.gmailConnection.upsert({
    where: { userId },
    create: { userId, account, encryptedRefreshToken },
    update: { account, encryptedRefreshToken, lastSyncedAt: null },
  });
  res.sendStatus(204);
});

router.delete("/connection", async (_req, res) => {
  const userId = String(res.locals.userId);
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });
  if (connection) {
    const result = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        token: unseal(
          connection.encryptedRefreshToken,
          `refresh:${userId}:${connection.account}`,
        ),
      }),
    });
    const alreadyRevoked =
      result.status === 400 &&
      ((await result.json()) as { error?: string }).error === "invalid_token";
    if (!result.ok && !alreadyRevoked)
      throw new HttpError(502, "Google could not revoke access. Try again.");
    await prisma.gmailConnection.deleteMany({
      where: {
        userId,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      },
    });
  }
  res.sendStatus(204);
});

type Message = {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds?: string[];
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

router.post("/sync", async (_req, res) => {
  const userId = String(res.locals.userId);
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });
  if (!connection) throw new HttpError(409, "Connect Gmail first.");
  const { account, encryptedRefreshToken } = connection;
  const { access_token: access } = await gmailToken({
    grant_type: "refresh_token",
    refresh_token: unseal(
      encryptedRefreshToken,
      `refresh:${userId}:${account}`,
    ),
  });
  const { labels } = await gmailGet<{
    labels?: { id: string; name: string }[];
  }>(access, "labels");
  const label = labels?.find(({ name }) => name === "Careerpath");
  if (!label)
    throw new HttpError(
      409,
      'Create a Gmail label named "Careerpath", then sync again.',
    );
  const since = Date.now() - 30 * 86400_000;
  const unseen: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      labelIds: label.id,
      q: `after:${Math.floor(since / 1000)}`,
      maxResults: "500",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const result: { messages?: { id: string }[]; nextPageToken?: string } =
      await gmailGet(access, "messages", params);
    const ids = [...new Set(result.messages?.map(({ id }) => id))];
    const known = new Set(
      (
        await prisma.emailUpdate.findMany({
          where: { userId, account, messageId: { in: ids } },
          select: { messageId: true },
        })
      ).map(({ messageId }) => messageId),
    );
    for (const id of ids)
      if (!known.has(id) && !unseen.includes(id)) unseen.push(id);
    pageToken = result.nextPageToken;
  } while (unseen.length <= 100 && pageToken);

  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    select: { id: true, company: true, role: true },
  });
  const rows: Prisma.EmailUpdateCreateManyInput[] = [];
  for (let i = 0; i < Math.min(unseen.length, 100); i += 10) {
    const messages = await Promise.all(
      unseen.slice(i, Math.min(i + 10, 100)).map((id) =>
        gmailGet<Message>(
          access,
          `messages/${encodeURIComponent(id)}`,
          new URLSearchParams({
            format: "full",
            fields:
              "id,threadId,internalDate,labelIds,snippet,payload(headers)",
          }),
        ),
      ),
    );
    for (const message of messages) {
      const time = Number(message.internalDate);
      if (!message.labelIds?.includes(label.id)) continue;
      if (!Number.isFinite(time) || time < since) continue;
      const header = (name: string) =>
        message.payload?.headers
          ?.find((h) => h.name.toLowerCase() === name)
          ?.value.slice(0, 1000) ?? "";
      const subject = header("subject");
      rows.push({
        userId,
        account,
        messageId: message.id,
        threadId: message.threadId,
        sender: header("from"),
        subject,
        receivedAt: new Date(time),
        category: suggestEmailCategory(subject, message.snippet ?? ""),
        applicationId: suggestEmailApplication(
          applications,
          subject,
          message.snippet ?? "",
        )?.id,
      });
    }
  }
  const imported = await prisma.$transaction(async (tx) => {
    const updated = await tx.gmailConnection.updateMany({
      where: { userId, encryptedRefreshToken },
      data: { lastSyncedAt: new Date() },
    });
    if (!updated.count)
      throw new HttpError(409, "Gmail connection changed. Sync again.");
    return rows.length
      ? (await tx.emailUpdate.createMany({ data: rows, skipDuplicates: true }))
          .count
      : 0;
  });
  res.json({ imported, hasMore: unseen.length > 100 || Boolean(pageToken) });
});

const reviewInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismiss") }),
  z.object({
    action: z.literal("link"),
    applicationId: z.string().min(1),
    statusChange: z
      .object({ from: z.enum(statuses), to: z.enum(statuses) })
      .optional(),
  }),
]);

router.patch("/:id", async (req, res) => {
  const userId = String(res.locals.userId);
  const input = reviewInput.parse(req.body);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const application =
      input.action === "link"
        ? await tx.jobApplication.findFirst({
            where: { id: input.applicationId, userId },
          })
        : null;
    if (input.action === "link" && !application)
      throw new HttpError(404, "Application not found.");
    const reviewed = await tx.emailUpdate.updateMany({
      where: { id, userId, state: "pending" },
      data: {
        state: input.action === "link" ? "linked" : "dismissed",
        applicationId: application?.id ?? null,
      },
    });
    if (!reviewed.count)
      throw new HttpError(
        409,
        "Email has already been reviewed or is unavailable.",
      );
    if (input.action !== "link" || !application) return;
    if (input.statusChange) {
      const { from, to } = input.statusChange;
      const updated = await tx.jobApplication.updateMany({
        where: { id: application.id, userId, status: from },
        data: { status: to },
      });
      if (!updated.count) {
        const current = await tx.jobApplication.findFirst({
          where: { id: application.id, userId },
        });
        throw new HttpError(
          409,
          `Application status changed to ${current?.status ?? "unavailable"}. Refresh and confirm again.`,
        );
      }
      if (from !== to)
        await tx.activity.create({
          data: {
            applicationId: application.id,
            kind: "STATUS_CHANGED",
            metadata: { from, to },
          },
        });
    }
    await tx.activity.create({
      data: {
        applicationId: application.id,
        kind: "EMAIL_LINKED",
        metadata: { emailUpdateId: id },
      },
    });
  });
  res.sendStatus(204);
});

export default router;
