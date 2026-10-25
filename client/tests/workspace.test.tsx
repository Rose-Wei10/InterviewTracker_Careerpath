// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import Applications from "../src/pages/Applications";
import FollowUps from "../src/components/dashboard/FollowUps";
import { invalidateUserQueries } from "../src/services/queryCache";
import type { Application } from "../src/types";
const { api, notify } = vi.hoisted(() => ({
  api: { userId: "alice", get: vi.fn(), patch: vi.fn(), remove: vi.fn() },
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../src/hooks/useApi", () => ({ useApi: () => api }));
vi.mock("react-hot-toast", () => ({ default: notify }));
const application: Application = {
  id: "one",
  company: "Acme",
  role: "Engineer",
  status: "Applied",
  appliedDate: "2026-10-01",
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
};
const clients: QueryClient[] = [];
function mount(path = "/applications") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Applications />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({
    items: [application],
    total: 1,
    page: 1,
    totalPages: 1,
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
describe("application interactions", () => {
  it("removes individual filter chips and resets the search and remaining filters", async () => {
    const user = userEvent.setup();
    mount("/applications?search=Acme&status=Applied&location=Remote");
    await screen.findByRole("button", { name: "Remove status filter" });
    await user.click(
      screen.getByRole("button", { name: "Remove status filter" }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove status filter" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByPlaceholderText("Company or role…")).toHaveValue("");
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/applications",
        expect.objectContaining({
          search: undefined,
          status: undefined,
          location: undefined,
          page: 1,
        }),
      ),
    );
  });
  it("disables the status control while saving and displays the refreshed server value", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    api.patch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    const select = await screen.findByRole("combobox", {
      name: "Status for Acme",
    });
    await user.selectOptions(select, "Interview");
    expect(select).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving status");
    expect(api.patch).toHaveBeenCalledWith("/applications/one", {
      status: "Interview",
    });
    api.get.mockResolvedValue({
      items: [{ ...application, status: "Interview" }],
      total: 1,
      page: 1,
      totalPages: 1,
    });
    finish();
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue("Interview");
  });
  it("keeps the saved status and allows retry after a failed update", async () => {
    api.patch.mockRejectedValueOnce(new Error("Connection lost"));
    const user = userEvent.setup();
    mount();
    const select = await screen.findByRole("combobox", {
      name: "Status for Acme",
    });
    await user.selectOptions(select, "Offer");
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Connection lost"),
    );
    expect(select).toHaveValue("Applied");
    expect(select).toBeEnabled();
  });
});
it("shows a helpful action-center empty state and links overdue follow-ups", () => {
  const view = render(
    <MemoryRouter>
      <FollowUps items={[]} total={0} />
    </MemoryRouter>,
  );
  expect(screen.getByText("You’re all caught up")).toBeVisible();
  view.rerender(
    <MemoryRouter>
      <FollowUps
        items={[
          {
            id: "one",
            company: "Acme",
            role: "Engineer",
            followUpAt: "2000-01-01T09:00:00Z",
          },
        ]}
        total={12}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Overdue")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Manage follow-up for Acme" }),
  ).toHaveAttribute("href", "/applications/one?edit=1");
  expect(
    screen.getByText("Showing the earliest 1 of 12 follow-ups."),
  ).toBeVisible();
});
it("refetches only affected user queries instead of every active query", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  const groups = [
    "applications",
    "application",
    "dashboard",
    "interviews",
    "reminders",
    "resumes",
    "analyses",
    "analysis-config",
  ];
  const calls: string[] = [];
  const subscriptions = [
    ...groups.map((group) => [group, "alice"]),
    ["applications", "bob"],
  ].map((queryKey) => {
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: async () => {
        calls.push(queryKey.join(":"));
        return {};
      },
    });
    return observer.subscribe(() => {});
  });
  try {
    await waitFor(() => expect(calls).toHaveLength(9));
    calls.length = 0;
    await client.invalidateQueries();
    expect(calls).toHaveLength(9);
    calls.length = 0;
    await invalidateUserQueries(client, "alice", [
      "applications",
      "application",
      "dashboard",
    ]);
    expect(calls.sort()).toEqual([
      "application:alice",
      "applications:alice",
      "dashboard:alice",
    ]);
  } finally {
    subscriptions.forEach((unsubscribe) => unsubscribe());
  }
});
