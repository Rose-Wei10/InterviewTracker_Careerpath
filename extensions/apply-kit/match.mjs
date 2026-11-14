const normalize = (text) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const aliases = {
  "first-name": ["first name", "given name", "given-name"],
  "last-name": ["last name", "surname", "family name"],
  "preferred-name": ["preferred name", "nickname"],
  email: ["email address", "e-mail"],
  phone: ["phone number", "mobile number", "telephone"],
  postal: ["zip code", "postcode", "zip"],
  region: ["state", "province"],
  github: ["github url", "github profile", "github profile url"],
  linkedin: [
    "linkedin link",
    "linkedin url",
    "linkedin profile",
    "linkedin profile url",
  ],
  portfolio: ["portfolio url", "personal website", "website link"],
  city: ["location city", "current city"],
};

const stop = new Set(
  "a an the us about tell describe you your of is what did how do and or please".split(
    " ",
  ),
);
const words = (value) =>
  new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word && !stop.has(word)),
  );

export function parseBundle(text) {
  if (text.length > 2_000_000)
    throw new Error("The Apply Kit bundle is too large.");
  const data = JSON.parse(text);
  if (
    data?.format !== "careerpath-apply-kit" ||
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    data.entries.length > 1000 ||
    data.entries.some(
      (entry) =>
        !entry ||
        typeof entry.prompt !== "string" ||
        !entry.prompt.trim() ||
        entry.prompt.length > 300 ||
        typeof entry.answer !== "string" ||
        !entry.answer.trim() ||
        entry.answer.length > 10000 ||
        typeof entry.review !== "boolean" ||
        (entry.starterKey !== null && typeof entry.starterKey !== "string"),
    )
  ) {
    throw new Error("Paste a valid version 1 bundle from Apply Kit.");
  }
  const origin =
    typeof data.careerpathOrigin === "string" &&
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(data.careerpathOrigin)
      ? data.careerpathOrigin
      : "https://interview-tracker-careerpath.vercel.app";
  return { entries: data.entries, origin };
}

export function isDialingCode(field) {
  return (
    field.autocomplete === "tel-country-code" ||
    /^(?:phone )?(?:country|dialing|dialling) code$/.test(
      normalize(field.label),
    )
  );
}

export function suggestions(field, entries) {
  const label = normalize(field.label);
  if (isDialingCode(field)) {
    const choices = entries.flatMap((entry, index) =>
      entry.starterKey === "phone-country-code" &&
      /^\+[1-9]\d{0,2}$/.test(entry.answer?.trim())
        ? [index]
        : [],
    );
    return { choices, suggested: choices.length === 1 ? choices[0] : null };
  }
  if (label === "select date") return { choices: [], suggested: null };
  const topic = (value) =>
    /\b(race|ethnicity|ethnic)\b/i.test(value)
      ? "race"
      : /\bveteran\b/i.test(value)
        ? "veteran"
        : /\bdisabilit/i.test(value)
          ? "disability"
          : /\bgender\b/i.test(value)
            ? "gender"
            : /\bpronouns?\b/i.test(value)
              ? "pronoun"
              : null;
  const demographic = topic(field.label);
  if (demographic) {
    const choices = entries.flatMap((entry, index) =>
      topic(entry.prompt) === demographic ? [index] : [],
    );
    return { choices, suggested: choices.length === 1 ? choices[0] : null };
  }
  const tokens = words(field.label);
  const semantic = {
    "given-name": "first-name",
    "family-name": "last-name",
    nickname: "preferred-name",
    email: "email",
    tel: "phone",
    "postal-code": "postal",
    "address-level1": "region",
    "address-level2": "city",
    "country-name": "country",
  };
  const distinct = {
    country: ["country", "residence country", "country of residence"],
    region: ["state", "province", "state or region"],
    postal: ["postal code", "zip code", "postcode", "zip"],
    phone: ["phone", "phone number", "mobile number", "telephone"],
  };
  const exactKey = Object.entries(distinct).find(([, names]) =>
    names.includes(label),
  )?.[0];
  if (exactKey) {
    const choices = entries.flatMap((entry, index) =>
      entry.starterKey === exactKey ? [index] : [],
    );
    return { choices, suggested: choices.length === 1 ? choices[0] : null };
  }
  const bareLocation = label === "location";
  const ranks = entries
    .map((entry, index) => {
      if (bareLocation)
        return {
          index,
          score: ["city", "locations"].includes(entry.starterKey) ? 0.7 : 0,
        };
      if (Object.hasOwn(semantic, field.autocomplete))
        return {
          index,
          score: semantic[field.autocomplete] === entry.starterKey ? 1 : 0,
        };
      const prompt = normalize(entry.prompt);
      const alias =
        Object.hasOwn(aliases, entry.starterKey) &&
        aliases[entry.starterKey].some((value) => normalize(value) === label);
      if (prompt === label || alias) return { index, score: 1 };
      const other = words(entry.prompt.split(/[.?!]/)[0]);
      const shared = [...tokens].filter((word) => other.has(word)).length;
      return {
        index,
        score: shared < 2 ? 0 : (2 * shared) / (tokens.size + other.size),
      };
    })
    .filter(({ score }) => score >= 0.6)
    .sort((a, b) => b.score - a.score);
  return {
    choices: ranks.map(({ index }) => index),
    suggested:
      !bareLocation &&
      ranks.length &&
      (!ranks[1] || ranks[0].score - ranks[1].score >= 0.15)
        ? ranks[0].index
        : null,
  };
}

export function needsReview(field, entry) {
  return (
    entry?.review ||
    !!(entry && graduationSeason(field, entry.answer || "")) ||
    /\b(salary|compensation|pay|wage|eligib\w*|consent|agree|acknowledg\w*|certif\w*|conflict\w*|government official|previous employee|referral|business interest|competes?|related to|relationship|sponsor\w*|visa|work authori[sz]\w*|eligible to work|legally authori[sz]\w*|why\s+(?:do|are|would|this|our)|motivation)\b/i.test(
      `${field.label} ${entry?.prompt || ""}`,
    )
  );
}

export function graduationSeason(field, answer) {
  if (!/graduat/i.test(field.label)) return null;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const date = answer.trim().match(/^([a-z]+)\s+(\d{4})$/i);
  if (!date) return null;
  const month = months.findIndex((value) => value === date[1].toLowerCase());
  if (month < 0) return null;
  const context = field.context || field.label;
  const definitions = [
    ...context.matchAll(
      /\b(spring|summer|fall|autumn|winter)\s*(?:[:(=]|is|means)\s*([a-z]+)\s*(?:[-–—]|to|through)\s*([a-z]+)/gi,
    ),
  ].flatMap((match) => {
    const first = months.findIndex((value) =>
      value.startsWith(match[2].toLowerCase()),
    );
    const last = months.findIndex((value) =>
      value.startsWith(match[3].toLowerCase()),
    );
    return first >= 0 && last >= first && month >= first && month <= last
      ? [{ season: match[1], definition: match[0] }]
      : [];
  });
  const matches = (field.options || []).flatMap((option) =>
    definitions
      .filter(
        (item) => normalize(option) === normalize(`${item.season} ${date[2]}`),
      )
      .map((item) => ({ option, definition: item.definition })),
  );
  return matches.length === 1 ? matches[0] : null;
}
// Conservative equivalents: compare only within the question's own option list.
export function optionMatch(field, answer) {
  if (field.kind === "text") {
    if (field.inputType === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(answer)) return null;
      const date = new Date(`${answer}T00:00:00Z`);
      return Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === answer
        ? answer
        : null;
    }
    return answer;
  }
  const seasonal = graduationSeason(field, answer);
  if (seasonal) return seasonal.option;
  if (isDialingCode(field)) {
    if (!/^\+[1-9]\d{0,2}$/.test(answer.trim())) return null;
    const matches = (field.options || []).filter(
      (option) =>
        option.trim() === answer.trim() ||
        option.match(/\(?(\+[1-9]\d{0,2})\)?\s*$/)?.[1] === answer.trim(),
    );
    return matches.length === 1 ? matches[0] : null;
  }
  if (
    /\b(gpa|grade point average)\b/i.test(field.label) &&
    /^\d+(?:\.\d+)?$/.test(answer.trim())
  ) {
    const exact = (field.options || []).filter(
      (option) => option.trim() === answer.trim(),
    );
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    const number = Number(answer);
    const candidates = (field.options || []).flatMap((option) => {
      const range = option
        .trim()
        .match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
      if (range)
        return number >= Number(range[1]) && number <= Number(range[2])
          ? [{ option, floor: Number(range[1]), range: true }]
          : [];
      const lower = option
        .trim()
        .match(
          /^(\d+(?:\.\d+)?)\s*(?:\+|or (?:above|higher)|and (?:above|higher))$/i,
        );
      return lower && number >= Number(lower[1])
        ? [{ option, floor: Number(lower[1]), range: false }]
        : [];
    });
    if (candidates.some((candidate) => candidate.range))
      return candidates.length === 1 ? candidates[0].option : null;
    const best = candidates.filter(
      (candidate) =>
        candidate.floor === Math.max(...candidates.map((item) => item.floor)),
    );
    return best.length === 1 ? best[0].option : null;
  }
  const canonical = (value) => {
    const normalized = normalize(value).replace(/^the /, "");
    if (
      /veteran/i.test(field.label) &&
      /^(not a protected veteran|i am not a protected veteran|i am not a veteran|not a veteran)$/.test(
        normalized,
      )
    )
      return "not veteran";
    if (
      /disabilit/i.test(field.label) &&
      /^(no disability|no i do not have a disability|i do not have a disability|no i don t have a disability or a history record of having a disability)$/.test(
        normalized,
      )
    )
      return "no disability";
    return normalized;
  };
  const matches = (field.options || []).filter(
    (option) => canonical(option) === canonical(answer),
  );
  return matches.length === 1 ? matches[0] : null;
}
