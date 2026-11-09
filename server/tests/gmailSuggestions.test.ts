import { expect, test } from "vitest";
import {
  suggestEmailApplication,
  suggestEmailCategory,
} from "../src/services/gmailSuggestions";

test("a rejection takes priority over earlier interview language", () => {
  expect(
    suggestEmailCategory(
      "Interview invitation",
      "Unfortunately, we chose other candidates.",
    ),
  ).toBe("Rejection");
  expect(
    suggestEmailCategory(
      "Next steps",
      "Please complete the online assessment.",
    ),
  ).toBe("OA");
  expect(suggestEmailCategory("Checking in", "Any questions?")).toBe(
    "Needs review",
  );
});

test("application suggestions require a unique company and role", () => {
  const application = { company: "Maple Studio", role: "Software Engineer" };
  const subject = "Maple Studio – Software Engineer";
  expect(suggestEmailApplication([application], subject, "")).toBe(application);
  expect(
    suggestEmailApplication([application, { ...application }], subject, ""),
  ).toBeUndefined();
  expect(
    suggestEmailApplication(
      [application],
      "Software Engineer at Maple Studios",
      "",
    ),
  ).toBeUndefined();
});
