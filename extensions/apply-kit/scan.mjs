export function frameInfo() {
  const roots = [document];
  for (let i = 0; i < roots.length; i++)
    for (const el of roots[i].querySelectorAll("*"))
      if (el.shadowRoot) roots.push(el.shadowRoot);
  const controls = "input,select,textarea,iframe,[role=combobox]";
  if (!globalThis.careerpathFormObserver) {
    globalThis.careerpathFormRevision = 0;
    globalThis.careerpathFormObserver = new MutationObserver((records) => {
      if (
        records.some((record) =>
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node.nodeType === 1 &&
              (node.matches(controls) || node.querySelector(controls)),
          ),
        )
      )
        globalThis.careerpathFormRevision++;
    });
  }
  for (const root of roots)
    globalThis.careerpathFormObserver.observe(root, {
      childList: true,
      subtree: true,
    });
  return {
    url: location.href,
    revision: globalThis.careerpathFormRevision,
    embeds: roots
      .flatMap((root) => [...root.querySelectorAll("iframe[src]")])
      .filter((el) => el.getClientRects().length)
      .map((el) => el.src),
  };
}
export function cancelFrameScan(runId) {
  if (globalThis.careerpathScanRun === runId)
    globalThis.careerpathScanRun = null;
}
export function directForm(url) {
  try {
    const value = new URL(url);
    return value.protocol === "https:" &&
      !value.username &&
      !value.password &&
      !value.port &&
      ((["job-boards.greenhouse.io", "boards.greenhouse.io"].includes(
        value.hostname,
      ) &&
        /^\/(?:embed\/job_app\/?|[^/]+\/(?:jobs|job_app)\/[\w-]+\/?)$/.test(
          value.pathname,
        )) ||
        (value.hostname === "jobs.ashbyhq.com" &&
          /^\/[^/]+\/[a-f\d-]{36}(?:\/application)?\/?$/i.test(value.pathname)))
      ? value.href
      : null;
  } catch {
    return null;
  }
}
export async function scanFrames(
  api,
  { tabId, func, isCurrent, onProgress, runId = crypto.randomUUID() },
) {
  const started = Date.now(),
    progress = [],
    results = [];
  let frames = [];
  const bounded = async (promise, ms) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("Timed out")), Math.max(1, ms));
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const cancel = () =>
    api.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        func: cancelFrameScan,
        args: [runId],
      })
      .catch(() => {});
  try {
    frames = await bounded(
      api.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: frameInfo,
      }),
      Math.min(10000, 30000 - (Date.now() - started)),
    );
    if (!isCurrent()) return { results, progress };
    if (!frames.length)
      throw Error(
        "No permitted documents were returned. Open the extension on the application tab and retry.",
      );
    for (const frame of frames)
      progress.push({
        documentId: frame.documentId,
        url: frame.result.url,
        state: "waiting",
      });
    const accessible = new Set(frames.map((frame) => frame.result.url));
    for (const url of new Set(frames.flatMap((frame) => frame.result.embeds)))
      if (/^https?:/.test(url) && !accessible.has(url))
        progress.push({
          url,
          embedded: true,
          state: "inaccessible",
          reason:
            "Frame access is not granted or the browser blocked this document.",
        });
    onProgress([...progress]);
    let index = 0;
    await Promise.all(
      [0, 1].map(async () => {
        while (index < frames.length && isCurrent()) {
          const frame = frames[index++],
            row = progress.find((item) => item.documentId === frame.documentId);
          const remaining = 30000 - (Date.now() - started);
          if (remaining <= 0) {
            row.state = "timed out";
            row.reason = "Overall 30-second scan deadline reached.";
            onProgress([...progress]);
            continue;
          }
          row.state = "scanning";
          onProgress([...progress]);
          try {
            const [response] = await bounded(
              api.scripting.executeScript({
                target: { tabId, documentIds: [frame.documentId] },
                func,
                args: [
                  null,
                  {
                    deadline:
                      Date.now() +
                      Math.max(1, Math.min(10000, remaining) - 250),
                    runId,
                  },
                ],
              }),
              Math.min(10000, remaining),
            );
            if (!isCurrent()) break;
            results.push(response);
            row.state = response.result.truncated ? "timed out" : "completed";
            row.revision = response.result.revision;
            if (response.result.truncated)
              row.reason =
                "Document exceeded its scan budget; partial results preserved.";
          } catch (error) {
            row.state =
              error.message === "Timed out" ? "timed out" : "inaccessible";
            row.reason = error.message;
            api.scripting
              .executeScript({
                target: { tabId, documentIds: [frame.documentId] },
                func: cancelFrameScan,
                args: [runId],
              })
              .catch(() => {});
          }
          onProgress([...progress]);
        }
      }),
    );
    if (!isCurrent()) void cancel();
    return { results, progress };
  } catch (error) {
    void cancel();
    throw Error(
      `${frames.length ? "Scan failed" : "Frame discovery failed"}: ${error.message}`,
    );
  }
}
