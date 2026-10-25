import "dotenv/config";
import { validateEnv } from "./config/env";
import app from "./app";
import prisma from "./config/prisma";
const env = validateEnv();
const server = app.listen(env.PORT, () =>
  console.info(`Interview Tracker API listening on port ${env.PORT}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
