// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import ApplicationsTable from "../src/components/dashboard/ApplicationsTable";
import ActivityFeed from "../src/components/dashboard/ActivityFeed";
import { ErrorState } from "../src/components/ui";
import type { Application } from "../src/types";
afterEach(cleanup);
describe("user-facing states", () => {
  it("shows an actionable empty state", () => {
    render(
      <MemoryRouter>
        <ApplicationsTable
          applications={[]}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No applications match/)).toBeVisible();
  });
  it("uses correct application IDs, roles and accessible action labels", () => {
    const a: Application = {
      id: "app1",
      company: "Acme",
      role: "Engineer",
      status: "Final Round",
      appliedDate: "2026-10-01",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };
    render(
      <MemoryRouter>
        <ApplicationsTable
          applications={[a]}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute(
      "href",
      "/applications/app1",
    );
    expect(screen.getByRole("button", { name: "Delete Acme" })).toBeVisible();
    expect(screen.getByText("Final Round")).toBeVisible();
  });
  it("renders structured status transition metadata", () => {
    render(
      <ActivityFeed
        data={[
          {
            id: "event1",
            kind: "STATUS_CHANGED",
            createdAt: "2026-10-01",
            metadata: { to: "Interview" },
            application: { company: "Acme", role: "Engineer" },
          },
        ]}
      />,
    );
    expect(screen.getByText(/status changed → Interview/i)).toBeVisible();
  });
  it("exposes failures to assistive technology", () => {
    render(<ErrorState error={new Error("Try again later")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Try again later");
  });
});
