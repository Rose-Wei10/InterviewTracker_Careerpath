import { z } from "zod";
const aliases: Record<string, string[]> = {
  JavaScript: ["JavaScript", "JS"],
  TypeScript: ["TypeScript", "TS"],
  Python: ["Python"],
  Java: ["Java"],
  React: ["React", "React.js", "ReactJS"],
  "Node.js": ["Node.js", "NodeJS", "Node JS"],
  "C++": ["C++"],
  "C#": ["C#"],
  ".NET": [".NET", "dotnet"],
  Express: ["Express", "Express.js"],
  SQL: ["SQL"],
  PostgreSQL: ["PostgreSQL", "Postgres"],
  MongoDB: ["MongoDB"],
  AWS: ["AWS", "Amazon Web Services"],
  Azure: ["Azure"],
  Docker: ["Docker"],
  Kubernetes: ["Kubernetes", "K8s"],
  Git: ["Git"],
  REST: ["REST", "RESTful"],
  GraphQL: ["GraphQL"],
  HTML: ["HTML", "HTML5"],
  CSS: ["CSS", "CSS3"],
  Prisma: ["Prisma"],
  Redis: ["Redis"],
  "CI/CD": ["CI/CD", "continuous integration"],
  testing: ["testing", "unit tests", "automated tests"],
  Excel: ["Excel"],
  "Customer service": ["customer service"],
  Sales: ["sales"],
  Communication: ["communication"],
  Leadership: ["leadership"],
  "Project management": ["project management"],
};
export const requirementSchema = z
  .object({
    term: z.string().trim().min(1).max(200),
    kind: z.enum(["keyword", "manual"]).default("keyword"),
  })
  .strict();
export type Requirement = z.infer<typeof requirementSchema>;
function canonicalTerm(term: string) {
  return (
    Object.keys(aliases).find((k) =>
      aliases[k].some((a) => a.toLowerCase() === term.toLowerCase()),
    ) ?? term
  );
}
export function keywordPattern(term: string) {
  const variants = aliases[canonicalTerm(term)] ?? [term];
  const escaped = variants.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
  );
  return new RegExp(`(?<![\\w+#.])(?:${escaped.join("|")})(?![\\w+#])`, "i");
}
export function detectRequirements(jd: string): Requirement[] {
  const detected: Requirement[] = Object.keys(aliases)
    .filter((term) => keywordPattern(term).test(jd))
    .map((term) => ({ term, kind: "keyword" }));
  for (const raw of jd.split(/\n|[.!?]\s+/)) {
    const line = raw.replace(/^\s*[-•*]\s*/, "").trim();
    if (
      line.length &&
      /\b(\d+\+?\s*(years?|yrs?)|senior|seniority|degree|bachelor|master|work authorization|visa|clearance)\b/i.test(
        line,
      )
    )
      detected.push({ term: line.slice(0, 200), kind: "manual" });
  }
  return detected.slice(0, 50);
}
export function reviewResume(text: string, requirements: Requirement[]) {
  const unique = requirements.filter(
    (r, i, all) =>
      all.findIndex(
        (v) =>
          canonicalTerm(v.term).toLowerCase() ===
          canonicalTerm(r.term).toLowerCase(),
      ) === i,
  );
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const checks = unique.map((r) => {
    const pattern = keywordPattern(r.term);
    // Semantic requirements and negated mentions need human judgment, even when words occur.
    const found =
      r.kind === "keyword"
        ? lines.find(
            (line) =>
              pattern.test(line) &&
              !/\b(no experience|not experienced|not proficient|unfamiliar|without experience|do not know|don't know)\b/i.test(
                line,
              ),
          )
        : undefined;
    const match = found ? pattern.exec(found) : null;
    const start = Math.max(0, (match?.index ?? 0) - 200);
    return {
      ...r,
      found: !!found,
      quote: found?.slice(start, start + 1000) ?? null,
    };
  });
  const bullets = lines.filter(
    (s) =>
      /^[-•*]\s+/.test(s) ||
      /^(built|developed|created|led|designed|implemented|worked|helped|responsible|managed|supported|improved|collaborated|assisted|delivered)\b/i.test(
        s,
      ),
  );
  const opening = (line: string) =>
    line
      .replace(/^[-•*]\s*/, "")
      .split(/\s+/)[0]
      .toLowerCase();
  const openings = new Map<string, number>();
  for (const bullet of bullets) {
    const word = opening(bullet);
    openings.set(word, (openings.get(word) ?? 0) + 1);
  }
  const improvements = bullets
    .flatMap((original) => {
      const prompts: string[] = [];
      if (
        /^(?:[-•*]\s*)?(?:worked on|helped|responsible for|assisted with)\b/i.test(
          original,
        )
      )
        prompts.push(
          "Clarify your own action: what did you build, change or deliver? Use only work you actually did.",
        );
      if (original.split(/\s+/).length > 35)
        prompts.push(
          "Consider splitting this long bullet so the action and outcome are easier to read.",
        );
      if ((openings.get(opening(original)) ?? 0) >= 3)
        prompts.push(
          "This opening repeats across several bullets. If accurate, choose a more specific action verb.",
        );
      if (
        !/\b(result|improv|reduc|increas|sav|deliver|achiev|enable|support)\w*\b|\d/i.test(
          original,
        )
      )
        prompts.push(
          "If you can verify it, describe the outcome or who benefited. Add numbers only when you have evidence.",
        );
      return prompts.length
        ? [{ original: original.slice(0, 2000), suggestions: prompts }]
        : [];
    })
    .slice(0, 10);
  const keywords = checks.filter((r) => r.kind === "keyword");
  return {
    schemaVersion: 2 as const,
    checks,
    foundCount: keywords.filter((r) => r.found).length,
    keywordCount: keywords.length,
    improvements,
    preparationTopics: checks
      .filter((r) => !r.found)
      .slice(0, 10)
      .map((r) =>
        r.kind === "manual"
          ? `Verify this requirement yourself: ${r.term}`
          : `If you have relevant experience with ${r.term}, prepare a truthful example and consider adding evidence.`,
      ),
  };
}
