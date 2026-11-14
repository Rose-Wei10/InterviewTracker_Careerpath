import { JSDOM } from "jsdom";
import { test, expect, vi, afterEach } from "vitest";
import { scanFrames, frameInfo, directForm, cancelFrameScan } from "./scan.mjs";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const frames = [1, 2, 3].map((id) => ({
  documentId: String(id),
  result: { url: `https://employer.test/${id}`, embeds: [] },
}));
test("direct links require exact provider hosts and application paths", () => {
  expect(
    directForm("https://job-boards.greenhouse.io/embed/job_app?token=123"),
  ).toContain("token=123");
  expect(
    directForm(
      "https://jobs.ashbyhq.com/demo/79fdda46-4ff5-42c7-b208-55f2084cdb8c/application",
    ),
  ).toBeTruthy();
  for (const url of [
    "https://job-boards.greenhouse.io.evil.test/embed/job_app",
    "https://user:secret@boards.greenhouse.io/acme/jobs/1",
    "http://boards.greenhouse.io/acme/jobs/1",
    "https://jobs.ashbyhq.com/login",
    "https://boards.greenhouse.io/other/embed/job_app",
  ])
    expect(directForm(url)).toBeNull();
});
test("partial frame results survive a timeout and the worker queue is bounded", async () => {
  vi.useFakeTimers();
  const progress = [];
  let pending = 0,
    maxPending = 0;
  const func = () => {};
  const executeScript = vi.fn(async (request) => {
    if (request.func === frameInfo) return frames;
    if (request.func === cancelFrameScan) return [];
    pending++;
    maxPending = Math.max(maxPending, pending);
    if (request.target.documentIds[0] === "2") return new Promise(() => {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    pending--;
    return [
      {
        documentId: request.target.documentIds[0],
        result: { fields: [], revision: 0 },
      },
    ];
  });
  const run = scanFrames(
    { scripting: { executeScript } },
    {
      tabId: 1,
      func,
      runId: "run",
      isCurrent: () => true,
      onProgress: (rows) => progress.push(rows.map((row) => ({ ...row }))),
    },
  );
  await vi.advanceTimersByTimeAsync(11000);
  const result = await run;
  expect(result.results).toHaveLength(2);
  expect(maxPending).toBeLessThanOrEqual(2);
  expect(result.progress.find((row) => row.documentId === "2").state).toBe(
    "timed out",
  );
  expect(
    progress.some((rows) => rows.some((row) => row.state === "scanning")),
  ).toBe(true);
});
test("obsolete runs return no late results and cancellation cannot stop a newer run", async () => {
  vi.stubGlobal("careerpathScanRun", "new");
  cancelFrameScan("old");
  expect(globalThis.careerpathScanRun).toBe("new");
  let current = true;
  const executeScript = vi.fn(async (request) => {
    if (request.func === frameInfo) return frames.slice(0, 1);
    if (request.func === cancelFrameScan) return [];
    current = false;
    return [{ documentId: "1", result: { fields: [] } }];
  });
  const result = await scanFrames(
    { scripting: { executeScript } },
    {
      tabId: 1,
      func: () => {},
      runId: "old",
      isCurrent: () => current,
      onProgress: () => {},
    },
  );
  expect(result.results).toHaveLength(0);
});

test("form observation detects delayed iframe controls including open shadow roots", async () => {
  const { window } = new JSDOM('<div id="host"></div>', {
    url: "https://employer.test/apply",
  });
  window.HTMLElement.prototype.getClientRects = () => [{ width: 20 }];
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("location", window.location);
  vi.stubGlobal("MutationObserver", window.MutationObserver);
  vi.stubGlobal("careerpathFormObserver", undefined);
  vi.stubGlobal("careerpathFormRevision", 0);
  const root = window.document
    .querySelector("#host")
    .attachShadow({ mode: "open" });
  const before = frameInfo();
  root.innerHTML =
    '<iframe src="https://job-boards.greenhouse.io/embed/job_app?token=1"></iframe>';
  await Promise.resolve();
  const after = frameInfo();
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.embeds).toHaveLength(1);
  globalThis.careerpathFormObserver.disconnect();
  window.close();
});
