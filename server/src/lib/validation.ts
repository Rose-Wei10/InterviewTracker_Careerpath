import { z } from "zod";
export const statuses = [
  "Applied",
  "OA",
  "Interview",
  "Final Round",
  "Offer",
  "Reject",
  "Ghosted",
] as const;
const date = z
  .union([z.string().date(), z.string().datetime({ offset: true })])
  .transform((v) => new Date(v));
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
export const applicationSchema = z
  .object({
    company: z.string().trim().min(1).max(200),
    role: z.string().trim().min(1).max(200),
    status: z.enum(statuses).default("Applied"),
    appliedDate: date,
    location: optionalText(200),
    salary: optionalText(100),
    notes: optionalText(20000),
    jobDescription: optionalText(20000),
    jobLink: z
      .union([
        z
          .string()
          .url()
          .max(2000)
          .refine((s) => /^https?:\/\//.test(s), "Use an HTTP or HTTPS URL"),
        z.literal(""),
      ])
      .nullable()
      .optional(),
    followUpAt: date.nullable().optional(),
    resumeId: z.string().min(1).nullable().optional(),
  })
  .strict();
export const updateSchema = applicationSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(200).optional(),
    status: z.enum(statuses).optional(),
    location: z.string().trim().max(200).optional(),
    from: date.optional(),
    to: date.optional(),
    sort: z
      .enum(["appliedDate", "company", "role", "status", "updatedAt"])
      .default("appliedDate"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must precede end date",
  );
export const interviewSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    startsAt: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    timeZone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Use an IANA time zone"),
    type: z.enum(["phone", "video", "technical", "behavioral", "onsite"]),
    notes: optionalText(10000),
    reminderMinutes: z.number().int().min(5).max(10080).nullable().optional(),
  })
  .strict();
export const interviewUpdateSchema = z
  .object({
    status: z.enum(["Scheduled", "Completed", "Cancelled"]),
    notes: optionalText(10000),
  })
  .strict();

export const eventSchema = z
  .object({
    applicationId: z.string().min(1).nullable().optional(),
    category: z.enum(["OA", "Interview", "Other"]).default("Other"),
    title: z.string().trim().min(1).max(200),
    startsAt: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    timeZone: interviewSchema.shape.timeZone,
    allDay: z.boolean().default(false),
    type: z
      .enum(["phone", "video", "technical", "behavioral", "onsite", "other"])
      .default("other"),
    notes: optionalText(10000),
    reminderMinutes: z
      .number()
      .int()
      .min(0)
      .max(10080)
      .nullable()
      .default(1440),
    status: z
      .enum(["Scheduled", "Completed", "Cancelled"])
      .default("Scheduled"),
    updateApplicationStatus: z.boolean().default(false),
  })
  .strict();
export const eventUpdateSchema = eventSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const eventListSchema = z
  .object({
    from: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    to: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(100),
    applicationId: z.string().min(1).optional(),
    category: z.enum(["OA", "Interview", "Other"]).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.from <= v.to && v.to.getTime() - v.from.getTime() <= 370 * 86400000,
    "Choose a range of at most one year",
  );
