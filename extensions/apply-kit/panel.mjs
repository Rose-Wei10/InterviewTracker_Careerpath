import { formControls } from "./controls.mjs";
import {
  parseBundle,
  suggestions,
  needsReview,
  optionMatch,
  isDialingCode,
} from "./match.mjs";
const $ = (id) => document.getElementById(id);
let state = {
  entries: [],
  origin: "https://interview-tracker-careerpath.vercel.app",
  pages: {},
};
const pageKey = (tab) => `${tab.id}:${tab.url?.split("#")[0]}`;
let page,
  rows = [],
  frameOrigins = [];
const save = async () => {
  try {
    await chrome.storage.session.set({ applyKit: state });
  } catch {
    message(
      "Could not preserve this session. Keep the panel open and copy any needed answers before closing.",
    );
  }
};
const message = (value) => {
  $("status").textContent = value;
};
function updateCount() {
  const selected = rows.filter((row) => row.check.checked);
  $("available").textContent =
    `${rows.filter((row) => !row.check.disabled).length} fields available to autofill`;
  $("count").textContent = `${selected.length} fields will be filled`;
  $("manual-count").textContent =
    `${$("checklist").querySelectorAll("input:checked").length} manual reminders checked`;
  $("fill").disabled = !selected.length;
  $("fill-help").textContent = selected.length
    ? "Only these approved fields will be changed."
    : "Select an autofill suggestion. Manual reminders do not select fields.";
}
function load() {
  $("loaded").hidden = !state.entries.length;
  $("import").hidden = !!state.entries.length;
  $("summary").textContent =
    `Apply Kit loaded · ${state.entries.length} saved answers`;
}
function text(tag, value, parent) {
  const el = document.createElement(tag);
  el.textContent = value;
  parent.append(el);
  return el;
}
function render() {
  rows = [];
  $("fields").replaceChildren();
  $("checklist").replaceChildren();
  if (!page) {
    updateCount();
    return;
  }
  $("diagnostics").textContent =
    `${state.entries.length} answers loaded. Scanned: ${page.title || ""} ${page.url}. ${page.frames.length} accessible documents; ${page.fields.length} fields detected. ${page.fields.filter((field) => suggestions(field, state.entries).choices.length).length} matched. ${page.embeds.length} iframe(s) detected. Cross-origin frames need explicit permission.`;
  const groups = ["Ready to fill", "Needs review", "Completed"].map((name) => {
    const el = document.createElement("details");
    el.open = name !== "Completed";
    text("summary", name, el);
    $("fields").append(el);
    return el;
  });
  for (const field of page.fields) {
    const key = `${field.documentId}:${field.index}:${field.signature}`;
    const result = page.results?.[key];
    const { suggested, choices } = suggestions(field, state.entries);
    const entry = state.entries[suggested];
    const option = entry ? optionMatch(field, entry.answer) : null;
    const completed = (result?.ok && !field.current) || field.verified;
    const ready =
      !completed &&
      !field.filled &&
      !!option &&
      !field.demographic &&
      !needsReview(field, entry || { prompt: "", review: false });
    const group = groups[completed ? 2 : ready ? 0 : 1];
    const card = document.createElement("article");
    card.className = "card";
    group.append(card);
    text("strong", field.label, card);
    if (completed) {
      text(
        "p",
        `Verified current value: ${result?.value || field.current}`,
        card,
      );
      continue;
    }
    if (field.filled) {
      text(
        "p",
        `Existing value preserved: ${field.current}. Verify it on the form.`,
        card,
      );
      continue;
    }
    let selected = page.sources?.[key] ?? suggested;
    const preview = text("p", "", card),
      source = text("p", "", card),
      exact = text("p", "", card);
    const label = document.createElement("label"),
      check = document.createElement("input");
    check.type = "checkbox";
    label.append(
      check,
      field.demographic
        ? " I reviewed this demographic answer for this application"
        : " Fill this field",
    );
    card.append(label);
    if (field.demographic)
      text(
        "p",
        "Review required for each application. No demographic answer is inferred.",
        card,
      );
    if (
      /consent|agree|acknowledg|conflict|eligib|authoriz|sponsor/i.test(
        field.label,
      )
    )
      text(
        "p",
        "Review the exact employer question. Never infer this answer from your profile.",
        card,
      );
    const details = document.createElement("details");
    text("summary", "Choose saved answer", details);
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search saved questions";
    search.setAttribute("aria-label", `Saved answers for ${field.label}`);
    details.append(search);
    const list = document.createElement("div");
    details.append(list);
    card.append(details);
    const drawChoices = () => {
      list.replaceChildren();
      const order = isDialingCode(field)
        ? choices
        : [...new Set([...choices, ...state.entries.keys()])];
      for (const index of order) {
        const e = state.entries[index];
        if (
          !`${e.prompt} ${e.answer}`
            .toLowerCase()
            .includes(search.value.toLowerCase())
        )
          continue;
        const b = text("button", e.prompt, list);
        b.type = "button";
        b.className = "answer-choice";
        b.onclick = () => {
          selected = index;
          page.sources ||= {};
          page.sources[key] = index;
          delete page.selected?.[key];
          check.checked = false;
          details.open = false;
          refresh();
          save();
        };
      }
    };
    details.ontoggle = () => {
      if (details.open) drawChoices();
    };
    search.oninput = drawChoices;
    const copy = text("button", "Copy proposed answer", card);
    copy.onclick = async () => {
      const entry = state.entries[selected];
      if (!entry) return;
      try {
        await navigator.clipboard.writeText(entry.answer);
        message("Copied proposed answer.");
      } catch {
        message(
          "Clipboard unavailable. Select the preview text and copy it manually.",
        );
      }
    };
    let approvedOption = null;
    const refresh = () => {
      const e = state.entries[selected];
      approvedOption = e ? optionMatch(field, e.answer) : null;
      preview.textContent = e
        ? `Proposed answer: ${e.answer}`
        : "No reliable saved answer. Choose a saved answer or complete on the form.";
      source.textContent = e
        ? `Source: Apply Kit → ${e.prompt}`
        : "Source: none";
      exact.textContent = approvedOption
        ? field.kind === "text"
          ? "Will enter the proposed text."
          : `Exact option: ${approvedOption}`
        : isDialingCode(field)
          ? "Missing a valid phone country code or matching dialing option. Postal code and residence country are never used."
          : field.kind === "combo"
            ? "Open the dropdown on the employer form and rescan to preview its available options."
            : "No unique matching option is available. Complete on the form or choose another saved answer.";
      check.disabled = !approvedOption;
      copy.disabled = !e;
      updateCount();
    };
    check.checked = !!page.selected?.[key];
    check.onchange = () => {
      page.selected ||= {};
      page.selected[key] = check.checked;
      updateCount();
      save();
    };
    rows.push({
      field,
      check,
      key,
      get ready() {
        return ready && selected === suggested;
      },
      get value() {
        return state.entries[selected]?.answer;
      },
      get option() {
        return approvedOption;
      },
    });
    refresh();
    if (result && !result.ok) {
      text("p", result.reason, card);
      const retry = text("button", "Rescan to retry", card);
      retry.onclick = scan;
    }
  }
  groups.forEach((group) => {
    group.firstChild.textContent += ` (${group.querySelectorAll("article").length})`;
  });
  const checklist = $("checklist");
  checklist.hidden = false;
  text("h2", "Manual reminders · not autofill selections", checklist);
  for (const upload of page.uploads)
    text(
      "p",
      upload.filename
        ? `${upload.label}: ${upload.filename} · ${upload.accepted ? "File selected; employer acceptance still needs confirmation." : "Not accepted. Retry the upload on the form."}`
        : `${upload.label}: no file selected. Upload on the form.`,
      checklist,
    );
  for (const reminder of [
    "Review uploaded résumé and any employer upload errors",
    "Review required fields and employer acknowledgments",
  ]) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!page.reminders?.[reminder];
    input.onchange = () => {
      page.reminders ||= {};
      page.reminders[reminder] = input.checked;
      updateCount();
      save();
    };
    label.append(input, reminder);
    checklist.append(label);
  }
  $("track").hidden = false;
  $("job-link").value = page.originalUrl || page.url;
  for (const id of ["company", "role", "location", "applied-date"])
    $(id).value =
      page[id] ||
      (id === "applied-date" ? new Date().toLocaleDateString("en-CA") : "");
  $("confirmed").checked = !!page.confirmed;
  $("record").disabled = !page.confirmed;
  updateCount();
}
async function scan() {
  if (!state.entries.length) {
    message("Paste your Careerpath autofill data first.");
    return;
  }
  $("scan").disabled = true;
  message("Scanning the active application and permitted frames…");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url || ""))
      throw Error("Open an employer application tab first.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: formControls,
    });
    const key = pageKey(tab),
      previous = state.pages[key];
    page = {
      ...previous,
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      originalUrl: previous?.originalUrl || tab.url,
      frames: results.map((r) => ({
        documentId: r.documentId,
        frameId: r.frameId,
      })),
      fields: results.flatMap((r) =>
        (r.result?.fields || []).map((f) => ({
          ...f,
          documentId: r.documentId,
        })),
      ),
      embeds: results.flatMap((r) => r.result?.frames || []),
      uploads: results.flatMap((r) => r.result?.uploads || []),
      selected: {},
      sources: previous?.sources || {},
      results: {},
    };
    // Review selection is never carried into a new document or changed question.
    state.pages[key] = page;
    frameOrigins = [
      ...new Set(
        page.embeds.flatMap((url) => {
          try {
            return [`${new URL(url).origin}/*`];
          } catch {
            return [];
          }
        }),
      ),
    ];
    $("frames").hidden = !frameOrigins.length;
    render();
    await save();
    message(
      "Scan complete. Review exact options before selecting fields. Open closed custom menus and rescan if their choices are not available.",
    );
  } catch (error) {
    message(
      `${error.message} Click the extension icon on this tab to grant temporary access, then try again.`,
    );
  } finally {
    $("scan").disabled = false;
  }
}
$("scan").onclick = scan;
$("frames").onclick = async () => {
  try {
    if (await chrome.permissions.request({ origins: frameOrigins }))
      await scan();
    else
      message(
        "Frame access was not granted. Complete the embedded form manually.",
      );
  } catch (error) {
    message(error.message);
  }
};
$("select-ready").onclick = () => {
  for (const row of rows)
    if (
      row.ready &&
      !row.check.disabled &&
      !needsReview(row.field, { prompt: "", review: false })
    ) {
      row.check.checked = true;
      page.selected ||= {};
      page.selected[row.key] = true;
    }
  updateCount();
  save();
};
$("clear").onclick = () => {
  for (const row of rows) row.check.checked = false;
  if (page) page.selected = {};
  updateCount();
  save();
};
$("fill").onclick = async () => {
  const current = page;
  const selected = rows.filter(
    (row) => row.check.checked && !row.check.disabled,
  );
  if (!selected.length) return;
  $("fill").disabled = true;
  $("scan").disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== current.tabId || tab.url !== current.url)
      throw Error("The page changed. Scan it before filling.");
    current.results ||= {};
    for (const documentId of new Set(
      selected.map((row) => row.field.documentId),
    )) {
      const subset = selected.filter(
        (row) => row.field.documentId === documentId,
      );
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: current.tabId, documentIds: [documentId] },
        func: formControls,
        args: [
          subset.map((row) => ({
            index: row.field.index,
            signature: row.field.signature,
            value: row.value,
            option: row.option,
            before: row.field.current,
          })),
        ],
      });
      for (const item of result.result) {
        const row = subset.find((row) => row.field.index === item.index);
        current.results[row.key] = item;
      }
    }
    current.selected = {};
    await save();
    if (page === current) render();
    message(
      "Fill finished. Completed contains read-back results; failed fields remain in Needs review with retry instructions.",
    );
  } catch (error) {
    message(
      `${error.message} Rescan to retry; existing values will be preserved.`,
    );
  } finally {
    $("scan").disabled = false;
    updateCount();
  }
};
$("bundle").oninput = async () => {
  try {
    const parsed = parseBundle($("bundle").value);
    state = { ...state, ...parsed, pages: {} };
    page = undefined;
    render();
    $("bundle").value = "";
    load();
    await save();
    message("Data loaded. Scan this application.");
  } catch {
    message("Paste a valid Apply Kit export.");
  }
};
$("replace").onclick = () => {
  $("import").hidden = false;
  $("loaded").hidden = true;
  $("bundle").focus();
};
$("forget").onclick = async () => {
  state = { entries: [], origin: state.origin, pages: {} };
  page = null;
  await chrome.storage.session.remove("applyKit");
  load();
  render();
  message("Session answers and progress removed.");
};
for (const id of [
  "company",
  "role",
  "location",
  "applied-date",
  "confirmed",
  "job-link",
])
  $(id).onchange = () => {
    if (!page) return;
    page[id] = id === "confirmed" ? $(id).checked : $(id).value;
    if (id === "job-link") page.originalUrl = $(id).value;
    $("record").disabled = !page.confirmed;
    save();
  };
$("record").onclick = () => {
  try {
    if (!page?.confirmed) return;
    const url = new URL($("job-link").value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password)
      throw Error();
    const destination = new URL("/applications", state.origin);
    destination.searchParams.set("recordLink", url.href);
    for (const id of ["company", "role", "location", "applied-date"])
      destination.searchParams.set(`record-${id}`, $(id).value);
    chrome.tabs.create({ url: destination.href });
  } catch {
    message("Enter the original HTTP(S) job URL before saving.");
  }
};
const saved = await chrome.storage.session.get("applyKit");
if (saved.applyKit) state = saved.applyKit;
const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
page = state.pages[pageKey(active || {})];
load();
render();
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  page = state.pages[pageKey(tab)];
  render();
  message("Active tab changed. Scan before filling.");
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (tabId !== page?.tabId || !change.url || change.url === page.url) return;
  page = state.pages[pageKey(tab)];
  render();
  message(
    "Application page changed. Scan to refresh; previous-page progress is saved.",
  );
});
