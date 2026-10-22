import "dotenv/config";
import { validateEnv } from "../config/env";
import prisma from "../config/prisma";
import { processReminderBatch } from "./reminders";
validateEnv();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function run() {
  while (!stopping) {
    try {
      await processReminderBatch();
    } catch {
      console.error("Reminder batch failed; retrying on next poll");
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  await prisma.$disconnect();
}
run().catch(() => {
  process.exitCode = 1;
});
