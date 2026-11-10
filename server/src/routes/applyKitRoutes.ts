import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
import { HttpError } from "../lib/errors";

const categories = [
  "Profile",
  "General",
  "Software Engineering",
  "Mentoring",
] as const;
const groups = [
  [
    "Profile",
    "Contact & links",
    [
      ["first-name", "Legal first name"],
      ["last-name", "Legal last name"],
      ["preferred-name", "Preferred name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["phone-country-code", "Phone country code"],
      ["city", "City"],
      ["region", "State or region"],
      ["postal", "Postal code"],
      ["country", "Country"],
      ["linkedin", "LinkedIn"],
      ["github", "GitHub"],
      ["portfolio", "Portfolio"],
    ],
  ],
  [
    "Profile",
    "Education & experience",
    [
      ["school", "School"],
      ["degree", "Degree"],
      ["major", "Major"],
      ["graduation", "Graduation month and year"],
      ["enrollment", "Current enrollment"],
      ["gpa", "GPA (optional)"],
      ["employment", "Recent employer, role and dates"],
      ["skills", "Skills and programming languages"],
      ["project-links", "Project or demo links"],
    ],
  ],
  [
    "Profile",
    "Availability & work preferences",
    [
      ["start", "Earliest start date"],
      ["internship", "Internship dates"],
      ["hours", "Weekly hours"],
      ["zone", "Time zone"],
      ["locations", "Preferred locations"],
      ["workplace", "Remote, hybrid or onsite preference"],
      ["relocation", "Willingness to relocate"],
      ["pay", "Pay expectations (optional)", true],
      [
        "authorization",
        "Are you currently authorized to work in the United States?",
        true,
      ],
      [
        "sponsorship",
        "Will you now or in the future need employer sponsorship to work in the United States?",
        true,
      ],
    ],
  ],
  [
    "General",
    "General answers",
    [
      ["intro", "Tell us about yourself."],
      ["interest", "Why are you interested in this role?", true],
      ["fit", "What makes you a good fit?"],
      ["disagreement", "Describe a time you worked through a disagreement."],
      ["learn", "Describe a time you learned something quickly."],
    ],
  ],
  [
    "Software Engineering",
    "Software Engineering",
    [
      [
        "project",
        "Describe a project you’re proud of. What did you personally build? Include a link and results if available.",
      ],
      ["debug", "How did you debug a difficult issue?"],
      ["testing", "How did you test a solution?"],
      ["tradeoff", "Describe a technical tradeoff you made."],
    ],
  ],
  [
    "Mentoring",
    "Mentoring & teaching",
    [
      ["teach-interest", "Why do you want to teach?", true],
      ["teach-example", "Describe a time you helped someone learn."],
      [
        "teach-tools",
        "Which languages, tools and age groups are you comfortable teaching?",
      ],
      ["teach-beginner", "How would you help a frustrated beginner?"],
      [
        "teach-hours",
        "What days and times can you teach, online or in person?",
      ],
    ],
  ],
] as const satisfies ReadonlyArray<
  readonly [
    (typeof categories)[number],
    string,
    ReadonlyArray<readonly [string, string, boolean?]>,
  ]
>;
const starters = groups.flatMap(([category, group, questions]) =>
  questions.map(([starterKey, prompt, review = false]) => ({
    starterKey,
    prompt,
    category,
    group,
    review,
  })),
);
const answer = z.string().trim().min(1).max(10000);
const custom = z.object({
  category: z.enum(categories),
  prompt: z.string().trim().min(1).max(300),
  answer,
});
const revision = z.number().int().positive();
const entryFields = {
  id: true,
  starterKey: true,
  category: true,
  prompt: true,
  answer: true,
  revision: true,
  updatedAt: true,
} satisfies Prisma.ApplyKitEntrySelect;
const router = Router();
router.get("/", async (_req, res) => {
  const entries = await prisma.applyKitEntry.findMany({
    where: { userId: res.locals.userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: entryFields,
  });
  res.json({ categories, starters, entries });
});
router.post("/", async (req, res) => {
  const input = z
    .union([
      z.object({ starterKey: z.string(), answer }).strict(),
      custom.strict(),
    ])
    .parse(req.body);
  const starter =
    "starterKey" in input
      ? starters.find((item) => item.starterKey === input.starterKey)
      : undefined;
  if ("starterKey" in input && !starter)
    throw new HttpError(400, "Unknown starter question.");
  const data = starter
    ? {
        starterKey: starter.starterKey,
        category: starter.category,
        prompt: starter.prompt,
        answer: input.answer,
      }
    : custom.parse(input);
  const userId = String(res.locals.userId);
  try {
    const entry = await prisma.applyKitEntry.create({
      data: {
        ...data,
        user: {
          connectOrCreate: { where: { id: userId }, create: { id: userId } },
        },
      },
      select: entryFields,
    });
    res.status(201).json(entry);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(
        409,
        "Another session saved this question. Reload Apply Kit before trying again.",
      );
    throw error;
  }
});
router.patch("/:id", async (req, res) => {
  const input = custom
    .partial()
    .extend({ answer, revision })
    .strict()
    .parse(req.body);
  const where = {
    id: String(req.params.id),
    userId: String(res.locals.userId),
  };
  const existing = await prisma.applyKitEntry.findFirst({
    where,
    select: { starterKey: true },
  });
  if (!existing) throw new HttpError(404, "Answer not found.");
  const { revision: expected, ...changes } = input;
  const result = await prisma.applyKitEntry.updateMany({
    where: { ...where, revision: expected },
    data: {
      ...(existing.starterKey ? { answer: changes.answer } : changes),
      revision: { increment: 1 },
    },
  });
  if (!result.count)
    throw new HttpError(
      409,
      "This answer changed in another session. Reload Apply Kit before overwriting it.",
    );
  res.sendStatus(204);
});
router.delete("/:id", async (req, res) => {
  const expected = z.coerce.number().int().positive().parse(req.query.revision);
  const where = {
    id: String(req.params.id),
    userId: String(res.locals.userId),
  };
  if (
    !(
      await prisma.applyKitEntry.deleteMany({
        where: { ...where, revision: expected },
      })
    ).count
  ) {
    if (await prisma.applyKitEntry.count({ where }))
      throw new HttpError(
        409,
        "This answer changed in another session. Reload Apply Kit before clearing it.",
      );
    throw new HttpError(404, "Answer not found.");
  }
  res.sendStatus(204);
});
export default router;
