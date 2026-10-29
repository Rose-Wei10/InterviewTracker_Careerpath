import { expect, it } from "vitest";
import { errorMessage } from "../src/services/api";
it("explains plain-text rate limits and preserves detailed server errors", () => {
  expect(
    errorMessage({
      isAxiosError: true,
      response: { status: 429, data: "Too many requests" },
    }),
  ).toBe("Too many requests. Please wait a minute and try again.");
  expect(
    errorMessage({
      isAxiosError: true,
      response: {
        status: 429,
        data: { message: "Daily review limit reached" },
      },
    }),
  ).toBe("Daily review limit reached");
});
