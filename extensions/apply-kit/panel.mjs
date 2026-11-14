import { scanFrames, frameInfo, cancelFrameScan, directForm } from "./scan.mjs";
import { formControls } from "./controls.mjs";
import {
  parseBundle,
  suggestions,
  needsReview,
  optionMatch,
  isDialingCode,
  graduationSeason,
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
  const selected = rows.filter(
    (row) => row.check.checked && !row.check.disabled,
  );
  $("available").textContent =
    `${rows.filter((row) => !row.check.disabled).length} fields available to autofill`;
  $("count").textContent = `${selected.length} fields will be filled`;
  $("manual-count").textContent =
    `${$("checklist").querySelectorAll("input:checked").length} manual reminders checked`;
  $("fill").disabled = !selected.length || $("scan").disabled;
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
function rememberOriginal(tab) {
  if (!tab?.id) return;
  state.jobOrigins ||= {};
  if (
    /^https:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/\d+(?:[/?#]|$)/i.test(
      tab.url || "",
    )
  )
    state.jobOrigins[tab.id] = tab.url;
  else if (
    tab.openerTabId &&
    state.jobOrigins[tab.openerTabId] &&
    !state.jobOrigins[tab.id]
  )
    state.jobOrigins[tab.id] = state.jobOrigins[tab.openerTabId];
}
function focusField(key) {
  [...$("fields").querySelectorAll("article")]
    .find((card) => card.dataset.fieldKey === key)
    ?.querySelector("input[type=checkbox]")
    ?.focus();
}
function render() {
  rows = [];
  $("fields").replaceChildren();
  $("checklist").replaceChildren();
  if (!page) {
    $("scan-progress").replaceChildren();
    $("diagnostics").textContent = state.entries.length
      ? "No tab scanned yet."
      : "Autofill data not loaded. No tab scanned yet.";
    $("track").hidden = true;
    $("checklist").hidden = true;
    $("frames").hidden = true;
    updateCount();
    return;
  }
  if (page.progress) renderProgress(page.progress);
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
    const completed =
      !field.invalid &&
      ((result?.ok && (!field.current || field.current === result.value)) ||
        field.verified);
    const ready =
      !completed &&
      !field.filled &&
      !field.manualReason &&
      !!option &&
      !field.demographic &&
      !page.overrides?.[key] &&
      !needsReview(field, entry || { prompt: "", review: false });
    const group = groups[completed ? 2 : ready ? 0 : 1];
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.fieldKey = key;
    const topic = field.demographic
      ? "Demographics"
      : /authoriz|sponsor|visa|eligib/i.test(field.label)
        ? "Authorization"
        : /school|degree|graduat|gpa|education/i.test(field.label)
          ? "Education"
          : /employer|employment|job title|current role/i.test(field.label)
            ? "Work history"
            : /name|email|phone|country|address|city|linkedin|portfolio|github/i.test(
                  field.label,
                )
              ? "Profile"
              : "Other";
    let section = [...group.querySelectorAll(":scope > details")].find(
      (el) => el.dataset.topic === topic,
    );
    if (!section) {
      section = document.createElement("details");
      section.dataset.topic = topic;
      section.open = true;
      text("summary", topic, section);
      group.append(section);
    }
    section.append(card);
    text("strong", field.label, card);
    if (field.guidance) text("p", field.guidance, card);
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
      if (field.kind === "combo") {
        const retry = text("button", "Retry this field", card);
        retry.onclick = () => retryField(field);
      }
      continue;
    }
    if (field.manualReason) {
      text("p", field.manualReason, card);
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
          delete page.overrides?.[key];
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
    const overrideDetails = document.createElement("details");
    text("summary", "Application-only answer / option", overrideDetails);
    text(
      "p",
      "Use only for this application. Your general Apply Kit answer stays unchanged. Choose translated options by their displayed wording; do not guess identity or eligibility.",
      overrideDetails,
    );
    const override = document.createElement(
      field.kind === "text" ? "textarea" : "select",
    );
    override.setAttribute(
      "aria-label",
      `Application-only answer for ${field.label}`,
    );
    if (field.kind === "text") {
      override.maxLength = 10000;
      override.value = page.overrides?.[key]?.answer || "";
    } else {
      const empty = text(
        "option",
        "Choose the exact employer option",
        override,
      );
      empty.value = "";
      for (const value of field.options || []) {
        const option = text("option", value, override);
        option.value = value;
      }
      override.value = page.overrides?.[key]?.answer || "";
    }
    overrideDetails.append(override);
    const saveOverride = text(
      "button",
      "Use for this application",
      overrideDetails,
    );
    saveOverride.onclick = () => {
      if (!override.value.trim()) {
        message(
          "Enter an answer or choose an available employer option first.",
        );
        return;
      }
      page.overrides ||= {};
      page.overrides[key] = { answer: override.value };
      check.checked = false;
      delete page.selected?.[key];
      render();
      focusField(key);
      save();
    };
    const clearOverride = text(
      "button",
      "Use saved answer instead",
      overrideDetails,
    );
    clearOverride.onclick = () => {
      delete page.overrides?.[key];
      override.value = "";
      check.checked = false;
      delete page.selected?.[key];
      render();
      focusField(key);
      save();
    };
    card.append(overrideDetails);
    const copy = text("button", "Copy proposed answer", card);
    copy.onclick = async () => {
      const entry = page.overrides?.[key] || state.entries[selected];
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
      const applicationOverride = page.overrides?.[key];
      const e = applicationOverride || state.entries[selected];
      approvedOption = e ? optionMatch(field, e.answer) : null;
      preview.textContent = e
        ? `Proposed answer: ${e.answer}`
        : "No reliable saved answer. Choose a saved answer or complete on the form.";
      source.textContent = applicationOverride
        ? "Source: application-only override · general answer unchanged"
        : e
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
      label.lastChild.textContent = applicationOverride
        ? " I reviewed this application-only answer"
        : field.demographic
          ? " I reviewed this demographic answer for this application"
          : " Fill this field";
      check.disabled = !approvedOption;
      const seasonal = e && graduationSeason(field, e.answer);
      if (seasonal)
        exact.textContent += ` · Employer definition: ${seasonal.definition}. Saved graduation date is unchanged; review individually.`;
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
        return ready && selected === suggested && !page.overrides?.[key];
      },
      get value() {
        return (page.overrides?.[key] || state.entries[selected])?.answer;
      },
      get option() {
        return approvedOption;
      },
    });
    refresh();
    if (result && !result.ok) text("p", result.reason, card);
    if (
      (result && !result.ok) ||
      (field.kind !== "text" && !field.options?.length)
    ) {
      const retry = text("button", "Retry this field", card);
      retry.onclick = () => retryField(field);
    }
  }
  groups.forEach((group) => {
    group.firstChild.textContent += ` (${group.querySelectorAll("article").length})`;
  });
  for (const url of page.embeds) {
    const safe = directForm(url);
    if (!safe) continue;
    const link = text("a", "Open embedded application", $("fields"));
    link.href = safe;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.onclick = async (event) => {
      event.preventDefault();
      const original = page.originalUrl || page.url;
      try {
        const tab = await chrome.tabs.create({
          url: safe,
          active: false,
          openerTabId: page.tabId,
        });
        state.jobOrigins ||= {};
        state.jobOrigins[tab.id] = original;
        await save();
        await chrome.tabs.update(tab.id, { active: true });
      } catch {
        message(
          "Could not open the standalone form. Use the employer page or copy the detected link.",
        );
      }
    };
    text(
      "p",
      "If upload fails here, complete it in the standalone form. Confirm the original job link before recording.",
      $("fields"),
    );
  }
  text(
    "p",
    "Closed shadow roots and native-accessibility-only widgets cannot be read by this extension. Complete them on the form, then rescan.",
    $("fields"),
  );
  const checklist = $("checklist");
  checklist.hidden = false;
  text("h2", "Manual reminders · not autofill selections", checklist);
  for (const warning of page.warnings || []) text("p", warning, checklist);
  for (const upload of page.uploads) {
    const item = document.createElement("div");
    checklist.append(item);
    text("strong", upload.label, item);
    text(
      "p",
      `File input: ${upload.inputId ? "#" + upload.inputId : upload.inputName ? "name=" + upload.inputName : "input[type=file] · " + ((upload.inputIndex ?? 0) + 1)} · ${upload.required ? "Required" : "Not marked required"}`,
      item,
    );
    text(
      "p",
      `Current filename (native input): ${upload.filename || "None exposed — check the employer’s uploaded-file preview"}`,
      item,
    );
    text(
      "p",
      `Upload errors: ${upload.errors?.length ? upload.errors.join(" ") : "No exposed errors. Employer acceptance is not confirmed."}`,
      item,
    );
    if (upload.accept) text("p", `Accepted file types: ${upload.accept}`, item);
  }
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
  $("origin-help").textContent =
    page.originalUrl && page.originalUrl !== page.url
      ? "Original job link retained. Verify it before saving."
      : "No earlier job URL was observed. Paste the original LinkedIn/job link before recording if this is only the employer form URL.";
  $("job-link").value = page.originalUrl || page.url;
  for (const id of ["company", "role", "location", "applied-date"])
    $(id).value =
      page[id] ||
      (id === "applied-date" ? new Date().toLocaleDateString("en-CA") : "");
  $("submission-status").value = page.submissionStatus || "Not confirmed";
  $("receipt-excerpt").value = page.receiptExcerpt || "";
  $("receipt-url").value = page.receiptUrl || page.url;
  $("confirmed").checked = !!page.confirmed;
  $("record").disabled = !page.confirmed;
  updateCount();
}
let scanGeneration = 0,
  scanningTab,
  scanningRun;
function cancelScan() {
  scanGeneration++;
  if (scanningTab)
    chrome.scripting
      .executeScript({
        target: { tabId: scanningTab, allFrames: true },
        func: cancelFrameScan,
        args: [scanningRun],
      })
      .catch(() => {});
  scanningTab = undefined;
  $("scan").disabled = false;
}
function renderProgress(progress) {
  $("scan-progress").replaceChildren();
  for (const frame of progress)
    text(
      "p",
      `${frame.url} · ${frame.state}${frame.reason ? " — " + frame.reason : ""}`,
      $("scan-progress"),
    );
}

async function scan() {
  cancelScan();
  const generation = scanGeneration;
  scanningRun = crypto.randomUUID();
  if (!state.entries.length) {
    message("Paste your Careerpath autofill data first.");
    return;
  }
  $("scan").disabled = true;
  for (const row of rows) row.check.checked = false;
  if (page) page.selected = {};
  updateCount();
  renderProgress([
    {
      url: "Active application",
      state: "scanning",
      reason: "Discovering permitted documents…",
    },
  ]);
  message("Scanning the active application and permitted frames…");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (generation !== scanGeneration) return;
    if (!tab?.id || !/^https?:/.test(tab.url || ""))
      throw Error("Open an employer application tab first.");
    scanningTab = tab.id;
    const { results, progress } = await scanFrames(chrome, {
      tabId: tab.id,
      func: formControls,
      runId: scanningRun,
      isCurrent: () => generation === scanGeneration,
      onProgress: (items) => {
        if (generation === scanGeneration) renderProgress(items);
      },
    });
    if (generation !== scanGeneration) return;
    rememberOriginal(tab);
    const key = pageKey(tab),
      previous = state.pages[key];
    page = {
      ...previous,
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      originalUrl:
        previous?.originalUrl || state.jobOrigins?.[tab.id] || tab.url,
      progress,
      warnings: results.flatMap((result) => result.result.warnings || []),
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
      embeds: [
        ...new Set([
          ...results.flatMap((r) => r.result?.frames || []),
          ...progress
            .filter((frame) => frame.embedded)
            .map((frame) => frame.url),
        ]),
      ],
      uploads: results.flatMap((r) =>
        (r.result?.uploads || []).map((upload) => ({
          ...upload,
          documentId: r.documentId,
        })),
      ),
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
      progress.some(
        (frame) =>
          frame.state === "timed out" || frame.state === "inaccessible",
      )
        ? "Partial scan finished. Available results are preserved; review frame failures above and retry when ready."
        : "Scan complete. Review exact options before selecting fields. Use Retry this field for missing menu choices.",
    );
  } catch (error) {
    if (generation !== scanGeneration) return;
    message(
      `${error.message} Click the extension icon on this tab to grant temporary access, then try again.`,
    );
  } finally {
    if (generation === scanGeneration) {
      $("scan").disabled = false;
      scanningTab = undefined;
      updateCount();
    }
  }
}
async function retryField(field) {
  const current = page;
  cancelScan();
  const generation = scanGeneration;
  scanningRun = crypto.randomUUID();
  scanningTab = current.tabId;
  $("scan").disabled = true;
  updateCount();
  let timer;
  message(`Inspecting options for ${field.label}…`);
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (generation !== scanGeneration) return;
    if (tab?.id !== current.tabId || tab.url !== current.url)
      throw Error("The page changed. Scan this application first.");
    const [result] = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId: current.tabId, documentIds: [field.documentId] },
        func: formControls,
        args: [
          null,
          {
            signature: field.signature,
            runId: scanningRun,
            deadline: Date.now() + 9750,
          },
        ],
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error("This field timed out. Retry or complete it on the form."),
            ),
          10000,
        );
      }),
    ]);
    if (generation !== scanGeneration || page !== current) return;
    const previous = current.fields.filter(
      (item) => item.documentId === field.documentId,
    );
    current.fields = current.fields
      .filter((item) => item.documentId !== field.documentId)
      .concat(
        result.result.fields.map((item) => ({
          ...item,
          documentId: field.documentId,
          options:
            item.signature === field.signature
              ? item.options
              : item.options.length
                ? item.options
                : previous.find((old) => old.signature === item.signature)
                    ?.options || [],
        })),
      );
    current.uploads = current.uploads
      .filter((upload) => upload.documentId !== field.documentId)
      .concat(
        (result.result.uploads || []).map((upload) => ({
          ...upload,
          documentId: field.documentId,
        })),
      );
    current.selected = {};
    delete current.results?.[
      `${field.documentId}:${field.index}:${field.signature}`
    ];
    await save();
    if (page === current) {
      render();
      focusField(`${field.documentId}:${field.index}:${field.signature}`);
    }
    const inspected = result.result.fields.find(
      (item) => item.signature === field.signature,
    );
    message(
      inspected?.options?.length || inspected?.kind === "text"
        ? `Refreshed ${field.label}. Review its exact option and select it before filling.`
        : `No accessible options exposed for ${field.label}. Complete it on the employer form.`,
    );
  } catch (error) {
    if (generation !== scanGeneration) return;
    message(
      `${error.message} Complete this field on the employer form if it remains unavailable.`,
    );
  } finally {
    clearTimeout(timer);
    if (generation === scanGeneration) {
      cancelScan();
      updateCount();
    }
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
  "submission-status",
  "receipt-excerpt",
  "receipt-url",
])
  $(id).onchange = () => {
    if (!page) return;
    page[id] = id === "confirmed" ? $(id).checked : $(id).value;
    if (id === "job-link") {
      page.originalUrl = $(id).value;
      state.jobOrigins ||= {};
      state.jobOrigins[page.tabId] = $(id).value;
    }
    if (id === "submission-status") {
      page.submissionStatus = $(id).value;
      if (page.submissionStatus === "Confirmed submitted" && !page.confirmed) {
        page.submissionStatus = "Not confirmed";
        $("submission-status").value = page.submissionStatus;
        message(
          "Confirm an employer receipt using the confirmation checkbox first.",
        );
      }
      if (page.submissionStatus !== "Confirmed submitted") {
        page.confirmed = false;
        $("confirmed").checked = false;
      }
    }
    if (id === "receipt-excerpt") page.receiptExcerpt = $(id).value;
    if (id === "receipt-url") page.receiptUrl = $(id).value;
    if (id === "confirmed") {
      page.submissionStatus = page.confirmed
        ? "Confirmed submitted"
        : "Not confirmed";
      page.confirmedAt = page.confirmed ? new Date().toISOString() : undefined;
      $("submission-status").value = page.submissionStatus;
    }
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
    const source = new URL($("receipt-url").value);
    if (
      !["https:", "http:"].includes(source.protocol) ||
      source.username ||
      source.password
    )
      throw Error();
    destination.hash = new URLSearchParams({
      receipt: JSON.stringify({
        excerpt: $("receipt-excerpt").value.slice(0, 500),
        sourceUrl: source.href,
        confirmedAt: page.confirmedAt || new Date().toISOString(),
      }),
    }).toString();
    chrome.tabs.create({ url: destination.href });
  } catch {
    message("Enter the original HTTP(S) job URL before saving.");
  }
};
const saved = await chrome.storage.session.get("applyKit");
if (saved.applyKit) state = saved.applyKit;
const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
rememberOriginal(active);
await save();
page = state.pages[pageKey(active || {})];
load();
render();
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  cancelScan();
  const tab = await chrome.tabs.get(tabId);
  rememberOriginal(tab);
  await save();
  page = state.pages[pageKey(tab)];
  render();
  message("Active tab changed. Scan before filling.");
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (tab.active || tabId === page?.tabId || state.jobOrigins?.[tabId]) {
    rememberOriginal(tab);
    save();
  }
  if (tab.active && change.url) {
    cancelScan();
  }
  if (tabId !== page?.tabId || !change.url || change.url === page.url) return;
  page = state.pages[pageKey(tab)];
  render();
  message(
    "Application page changed. Scan to refresh; previous-page progress is saved.",
  );
});

let polling = false;
setInterval(async () => {
  const current = page;
  if (!current || $("scan").disabled || polling) return;
  polling = true;
  let timer;
  try {
    const results = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId: current.tabId, allFrames: true },
        func: frameInfo,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Form observation timed out")),
          3000,
        );
      }),
    ]);
    if (page !== current) return;
    if (
      results.length !== current.frames.length ||
      results.some(
        (result) =>
          current.progress?.find((row) => row.documentId === result.documentId)
            ?.revision !== result.result.revision,
      )
    )
      message(
        "Form changed — rescan. Newly loaded controls or frames may now be available.",
      );
  } catch {
    /* Missing access is explained by the scan diagnostics. */
  } finally {
    clearTimeout(timer);
    polling = false;
  }
}, 4000);
