export function suggestEmailCategory(subject: string, excerpt: string) {
  const content = `${subject}\n${excerpt}`;
  if (
    /\b(unfortunately|not moving forward|other candidates|unable to offer)\b/i.test(
      content,
    )
  )
    return "Rejection";
  if (/\b(offer letter|pleased to offer|employment offer)\b/i.test(content))
    return "Offer";
  if (
    /\b(online assessment|coding assessment|coding challenge)\b/i.test(content)
  )
    return "OA";
  if (
    /\b(interview invitation|schedule an interview|invite you to interview)\b/i.test(
      content,
    )
  )
    return "Interview";
  if (
    /\b(application received|received your application|thank you for applying)\b/i.test(
      content,
    )
  )
    return "Application received";
  return "Needs review";
}

export function suggestEmailApplication<
  T extends { company: string; role: string },
>(applications: T[], subject: string, excerpt: string): T | undefined {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const content = ` ${normalize(`${subject} ${excerpt}`)} `;
  const matches = applications.filter(({ company, role }) => {
    const companyName = normalize(company);
    const roleName = normalize(role);
    return (
      companyName &&
      roleName &&
      content.includes(` ${companyName} `) &&
      content.includes(` ${roleName} `)
    );
  });
  return matches.length === 1 ? matches[0] : undefined;
}
