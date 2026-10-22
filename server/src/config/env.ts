import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  DATABASE_URL: z.string().url(),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_BUCKET_NAME: z.string().optional(),
  AI_MODE: z.enum(["demo", "openai-compatible"]).default("demo"),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4.1-mini"),
  EMAIL_PROVIDER: z.enum(["console", "ses"]).default("console"),
  EMAIL_FROM: z.string().email().optional(),
});
export function validateEnv(input: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  if (result.data.AI_MODE !== "demo" && !result.data.AI_API_KEY)
    throw new Error("AI_API_KEY required");
  if (result.data.EMAIL_PROVIDER === "ses" && !result.data.EMAIL_FROM)
    throw new Error("EMAIL_FROM required");
  if (
    result.data.NODE_ENV === "production" &&
    !result.data.CLIENT_ORIGIN.startsWith("https://")
  )
    throw new Error("Production CLIENT_ORIGIN must use HTTPS");
  return result.data;
}
