import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import prisma from "../config/prisma";
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string; preview?: boolean }>;
}
export const consoleProvider: EmailProvider = {
  async send() {
    return { id: `preview-${randomUUID()}`, preview: true };
  },
};
const ses = new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
export const sesProvider: EmailProvider = {
  async send(message) {
    const result = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.EMAIL_FROM,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject },
            Body: { Text: { Data: message.text } },
          },
        },
      }),
    );
    return { id: result.MessageId ?? randomUUID() };
  },
};
export function retryDelay(attempts: number) {
  return Math.min(3600000, 60000 * 2 ** Math.max(0, attempts - 1));
}
export async function processReminderBatch(
  provider: EmailProvider = process.env.EMAIL_PROVIDER === "ses"
    ? sesProvider
    : consoleProvider,
) {
  // SES does not offer an idempotency key. Expired in-flight deliveries are uncertain,
  // never automatically resent: an operator must reconcile them before retrying.
  await prisma.reminder.updateMany({
    where: { status: "processing", lockedUntil: { lt: new Date() } },
    data: { status: "uncertain" },
  });
  for (let i = 0; i < 20; i++) {
    const claimed = await prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Reminder" WHERE status = 'pending' AND "dueAt" <= NOW() ORDER BY "dueAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!ids[0]) return null;
      return tx.reminder.update({
        where: { id: ids[0].id },
        data: {
          status: "processing",
          attempts: { increment: 1 },
          lockedUntil: new Date(Date.now() + 120000),
        },
        include: { application: true, interview: true },
      });
    });
    if (!claimed) return;
    try {
      const current = await prisma.reminder.findUnique({
        where: { id: claimed.id },
      });
      if (!current || current.status !== "processing") continue;
      if (claimed.interview && claimed.interview.status !== "Scheduled") {
        await prisma.reminder.update({
          where: { id: claimed.id },
          data: { status: "cancelled", lockedUntil: null },
        });
        continue;
      }
      let to = "local-preview";
      if (provider !== consoleProvider) {
        const user = await clerkClient.users.getUser(
          claimed.application.userId,
        );
        const email = user.emailAddresses.find(
          (e) =>
            e.id === user.primaryEmailAddressId &&
            e.verification?.status === "verified",
        );
        if (!email) {
          await prisma.reminder.update({
            where: { id: claimed.id },
            data: { status: "failed", lockedUntil: null },
          });
          continue;
        }
        to = email.emailAddress;
      }
      const text = claimed.interview
        ? `${claimed.interview.title}: ${claimed.interview.startsAt.toLocaleString("en-US", { timeZone: claimed.interview.timeZone })} (${claimed.interview.timeZone}).`
        : "Your configured application follow-up is due.";
      const receipt = await provider.send({
        to,
        subject: `Interview Tracker: ${claimed.kind} reminder`,
        text,
      });
      await prisma.reminder.update({
        where: { id: claimed.id },
        data: {
          status: receipt.preview ? "previewed" : "sent",
          sentAt: new Date(),
          providerId: receipt.id,
          lockedUntil: null,
        },
      });
    } catch (error) {
      // Retry only explicit throttling/service rejection. Network ambiguity needs reconciliation.
      const name = error instanceof Error ? error.name : "";
      const retryable = [
        "TooManyRequestsException",
        "ThrottlingException",
        "ServiceUnavailableException",
      ].includes(name);
      await prisma.reminder.updateMany({
        where: { id: claimed.id, status: "processing" },
        data: {
          status:
            retryable && claimed.attempts < 5
              ? "pending"
              : retryable
                ? "failed"
                : "uncertain",
          dueAt: new Date(Date.now() + retryDelay(claimed.attempts)),
          lockedUntil: null,
        },
      });
    }
  }
}
