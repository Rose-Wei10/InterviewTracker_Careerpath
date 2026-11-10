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
    entry.review ||
    /\b(salary|compensation|pay|wage|eligib\w*|consent|agree|acknowledg\w*|certif\w*|conflict\w*|government official|previous employee|referral|business interest|competes?|related to|relationship|sponsor\w*|visa|work authori[sz]\w*|eligible to work|legally authori[sz]\w*|why\s+(?:do|are|would|this|our)|motivation)\b/i.test(
      `${field.label} ${entry.prompt}`,
    )
  );
}
