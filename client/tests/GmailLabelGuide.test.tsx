// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import GmailLabelGuide from "../src/components/GmailLabelGuide";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("sender recipes require a real address and do not mutate mailbox settings", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<GmailLabelGuide account="synthetic@example.test" />);
  const input = screen.getByLabelText("Exact recruiting email address");
  const button = screen.getByRole("button", { name: "Copy search" });
  fireEvent.change(input, { target: { value: "@ats.example" } });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, {
    target: { value: "recruiter@example.test OR from:other@example.test" },
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, { target: { value: "recruiter@example.test" } });
  fireEvent.click(button);
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith('from:"recruiter@example.test"'),
  );
  fireEvent.change(screen.getByLabelText("Recipe"), {
    target: { value: "phrases" },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'from:"recruiter@example.test" {"application received"',
      ),
    ),
  );
  expect(screen.getByText(/No mailbox setting is changed here/)).toBeTruthy();
});
