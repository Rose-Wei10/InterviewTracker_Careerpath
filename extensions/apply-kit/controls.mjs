// Serialized by Chrome into each permitted frame; no imported helpers here.
export async function formControls(approved = null, inspect = null) {
  const roots = [document];
  for (let i = 0; i < roots.length; i++)
    for (const el of roots[i].querySelectorAll("*"))
      if (el.shadowRoot) roots.push(el.shadowRoot);
  const queryAll = (selector) =>
    roots.flatMap((root) => [...root.querySelectorAll(selector)]);
  const resolveId = (el, id) =>
    el.getRootNode().getElementById?.(id) || document.getElementById(id);
  if (inspect?.runId) globalThis.careerpathScanRun = inspect.runId;
  const cancelled = () =>
    !!inspect &&
    ((inspect.deadline && Date.now() > inspect.deadline) ||
      (inspect.runId && globalThis.careerpathScanRun !== inspect.runId));
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    for (
      let node = el;
      node;
      node = node.parentElement || node.getRootNode()?.host
    ) {
      if (node.matches?.("[hidden],[inert],[aria-hidden=true]")) return false;
      const style = getComputedStyle(node);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      )
        return false;
    }
    return true;
  };
  const labelText = (el) => {
    const copy = el.cloneNode(true);
    copy
      .querySelectorAll("select,textarea,input,[role=listbox]")
      .forEach((child) => child.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  };
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const baseLabel = (el) =>
    (
      el
        .getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => text(resolveId(el, id)))
        .join(" ") ||
      [...(el.labels || [])].map(labelText).join(" ") ||
      el.getAttribute("aria-label") ||
      text(el.closest("fieldset")?.querySelector("legend")) ||
      el.getAttribute("placeholder") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  const label = (el) => {
    const value = baseLabel(el);
    if (
      value &&
      !/^(search|textbox|select|choose|text input)[ .…]*$/i.test(value)
    )
      return value;
    for (
      let parent = el, depth = 0;
      parent && depth < 9;
      parent = parent.parentElement, depth++
    ) {
      const nearby = parent.previousElementSibling;
      if (
        nearby &&
        visible(nearby) &&
        !nearby.querySelector("input,textarea,select,button") &&
        text(nearby) &&
        text(nearby).length <= 600
      )
        return text(nearby);
    }
    return value || el.name || el.id;
  };
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}+]+/gu, " ")
      .trim();
  const forbidden =
    /\b(password|passcode|passphrase|pin|ssn|social security|passport|driver.?s licen[sc]e|tax id|national id|bank|credit card|debit card|card number|cvv|cvc|routing|account number|birth|dob|otp|one time|security code|verification code)\b/i;
  const inputs = [
    ...queryAll(
      "input,textarea,select,[role=combobox],[aria-haspopup=listbox],[aria-autocomplete]",
    ),
  ].filter(
    (el) =>
      (visible(el) ||
        (/^(radio|checkbox)$/.test(el.type) &&
          [...(el.labels || [])].some(visible))) &&
      !el.matches(":disabled,[aria-disabled=true]") &&
      (!el.matches("[readonly],[aria-readonly=true]") ||
        el.matches("[role=combobox],[aria-haspopup=listbox]")) &&
      !forbidden.test(
        `${label(el)} ${el.autocomplete} ${el.name} ${el.id}`
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/[_-]/g, " "),
      ) &&
      !/(?:^|\s)(?:cc-\S+|current-password|new-password|one-time-code|bday(?:-\w+)?)(?:\s|$)/i.test(
        el.autocomplete || "",
      ) &&
      !/^(password|hidden|submit|reset|file)$/i.test(el.type) &&
      (el.type !== "button" ||
        el.matches("[role=combobox],[aria-haspopup=listbox]")),
  );
  const groups = new Set();
  const descriptors = [];
  const nodes = [];
  for (const el of inputs) {
    if (cancelled()) break;
    if (el.closest("[role=combobox]") !== el && el.closest("[role=combobox]"))
      continue;
    let kind =
      el.tagName === "SELECT"
        ? "select"
        : el.matches(
              "[role=combobox],[aria-autocomplete],[aria-haspopup=listbox]",
            )
          ? "combo"
          : el.hasAttribute("list") || el.type === "search"
            ? "combo"
            : /^(radio|checkbox)$/.test(el.type)
              ? el.type
              : "text";
    if (
      kind === "text" &&
      el.tagName !== "TEXTAREA" &&
      !/^(text|email|tel|url|number|date)$/.test(el.type)
    )
      continue;
    let members = [el];
    let question = label(el);
    if (kind === "radio" || kind === "checkbox") {
      const parent = el.closest("fieldset,[role=radiogroup],[role=group]");
      const key = parent || (el.name ? `${kind}:${el.name}` : el);
      if (groups.has(key)) continue;
      groups.add(key);
      members = inputs.filter(
        (other) =>
          other.type === kind &&
          (parent
            ? other.closest("fieldset,[role=radiogroup],[role=group]") ===
              parent
            : el.name
              ? other.name === el.name
              : other === el),
      );
      question =
        text(parent?.querySelector("legend")) ||
        parent
          ?.getAttribute("aria-labelledby")
          ?.split(/\s+/)
          .map((id) => text(resolveId(el, id)))
          .join(" ") ||
        parent?.getAttribute("aria-label") ||
        (parent ? label(parent) : question);
    }
    if (!question) continue;
    const manualReason =
      /\b(consent|agree|acknowledg|certif|privacy (?:statement|notice)|terms(?: of| and conditions)?|nondisclosure|code of conduct|nda|signature)/i.test(
        [question, ...members.map((member) => label(member)), el.name, el.id]
          .join(" ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/[_-]/g, " "),
      )
        ? "Legal acknowledgment: complete directly on the employer form."
        : el.type !== "date" &&
            (el.matches("[role=spinbutton]") ||
              (/date/i.test(
                el.closest("[role=group]")?.getAttribute("aria-label") || "",
              ) &&
                el.type === "text"))
          ? "Segmented date: select the date through the employer calendar."
          : null;
    const optionNodes = () => {
      if (kind === "select")
        return [...el.options].filter((o) => !o.disabled && o.value !== "");
      if (kind === "radio" || kind === "checkbox") return members;
      const ids =
        `${el.getAttribute("aria-controls") || ""} ${el.getAttribute("aria-owns") || ""} ${el.getAttribute("list") || ""}`
          .trim()
          .split(/\s+/);
      const lists = ids.map((id) => resolveId(el, id)).filter(Boolean);
      // Never use options from an unrelated open menu.
      return lists
        .flatMap((list) => [...list.querySelectorAll("[role=option],option")])
        .filter(
          (o) => visible(o) && o.getAttribute("aria-disabled") !== "true",
        );
    };
    const optionText = (o) =>
      kind === "select"
        ? o.textContent.trim()
        : /^(radio|checkbox)$/.test(kind)
          ? label(o)
          : text(o);
    const current = () =>
      kind === "select"
        ? el.value && !el.selectedOptions[0]?.disabled
          ? text(el.selectedOptions[0])
          : ""
        : /^(radio|checkbox)$/.test(kind)
          ? members
              .filter((o) => o.checked)
              .map(optionText)
              .join("; ")
          : kind === "combo"
            ? (/^(INPUT|TEXTAREA)$/.test(el.tagName)
                ? el.value
                : el.getAttribute("aria-valuetext") ||
                  el.querySelector("input")?.value ||
                  text(el)) || ""
            : el.value || "";
    const signature = JSON.stringify([question, kind, el.id, el.name]);
    const keyEvent = (key) =>
      el.dispatchEvent(
        new el.ownerDocument.defaultView.KeyboardEvent("keydown", {
          key,
          code: key,
          bubbles: true,
        }),
      );
    const openMenu = async () => {
      if (cancelled()) return;
      el.focus();
      el.click();
      for (let wait = 0; wait < 15 && !optionNodes().length; wait++) {
        if (cancelled()) break;
        if (wait === 1) keyEvent("ArrowDown");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    const closeMenu = () => {
      keyEvent("Escape");
      el.blur();
    };
    let options = optionNodes().map(optionText);
    if (
      !approved &&
      !manualReason &&
      kind === "combo" &&
      (!current() || inspect?.signature === signature) &&
      !options.length &&
      (!inspect?.signature || inspect.signature === signature)
    ) {
      try {
        await openMenu();
        options = optionNodes().map(optionText);
      } finally {
        if (
          !inspect?.runId ||
          globalThis.careerpathScanRun === null ||
          globalThis.careerpathScanRun === inspect.runId
        )
          closeMenu();
      }
    }
    descriptors.push({
      index: nodes.length,
      label: question,
      manualReason,
      context: [
        text(el.closest("fieldset")?.querySelector("legend")),
        question,
        ...(el.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .map((id) => text(resolveId(el, id))),
      ]
        .join(" ")
        .slice(0, 2000),
      kind,
      inputType: el.type || "",
      guidance:
        el.type === "date"
          ? "Native date: use YYYY-MM-DD."
          : /date|birth|graduat/i.test(question) && kind === "combo"
            ? "Use the employer calendar for segmented/custom dates."
            : "",
      signature,
      autocomplete: el.autocomplete?.split(/\s+/).at(-1) || "",
      options,
      current: current(),
      filled: !!current(),
      invalid:
        !!el.closest("[aria-invalid=true]") || !(el.validity?.valid ?? true),
      verified:
        !!current() &&
        kind !== "combo" &&
        el.getAttribute("aria-invalid") !== "true" &&
        (el.validity?.valid ?? true),
      demographic: /\b(race|ethnic|gender|pronoun|veteran|disabilit)/i.test(
        question,
      ),
    });
    nodes.push({
      el,
      members,
      kind,
      signature,
      optionNodes,
      optionText,
      current,
      manualReason,
      openMenu,
      closeMenu,
    });
  }
  if (!approved) {
    const candidates = queryAll(
      'fieldset,[data-section="employment"],[data-testid*="workExperience"]',
    );
    const employment = candidates.filter(
      (group) =>
        /employer|company|job title/i.test(text(group)) &&
        !candidates.some(
          (child) =>
            child !== group &&
            group.contains(child) &&
            /employer|company|job title/i.test(text(child)),
        ),
    );
    const seen = new Set(),
      warnings = [];
    for (const group of employment) {
      const fields = [...group.querySelectorAll("input,select,textarea")];
      const value = (pattern) =>
        fields.find((el) => pattern.test(label(el)))?.value?.trim() || "";
      const employer = value(/employer|company/i),
        role = value(/job title|position|role/i);
      if (
        !employer &&
        !role &&
        !fields.some((el) => /employer|company|job title/i.test(label(el)))
      )
        continue;
      const key = normalize(`${employer}|${role}`);
      if (employer && role && seen.has(key))
        warnings.push(
          `Possible duplicate employment fragments: ${employer} / ${role}. Review dates and current-role flags; no entries were changed.`,
        );
      if (employer && role) seen.add(key);
      if (
        fields.some(
          (el) =>
            el.required &&
            (/^(checkbox|radio)$/.test(el.type)
              ? !el.validity.valid
              : !el.value),
        )
      )
        warnings.push(
          `Employment entry ${employer || role || "on this form"} has missing required fields.`,
        );
      if (
        value(/end date|to date/i) &&
        fields.some(
          (el) => /current|present|still work/i.test(label(el)) && el.checked,
        )
      )
        warnings.push(
          `Employment entry ${employer || role || "on this form"} has both an end date and a current-role flag. Review on the form.`,
        );
    }
    if (!inspect?.runId || globalThis.careerpathScanRun === inspect.runId)
      globalThis.careerpathControlSnapshot = nodes;
    return {
      warnings,
      truncated: cancelled(),
      revision: globalThis.careerpathFormRevision || 0,
      fields: descriptors,
      frames: [...queryAll("iframe[src]")]
        .filter(visible)
        .map((el) => el.src)
        .filter((url) => /^https?:/.test(url)),
      uploads: [...queryAll("input[type=file]")].map((el, index) => {
        const rawLabel = label(el) || "Résumé / attachment";
        const ids =
          `${el.getAttribute("aria-errormessage") || ""} ${el.getAttribute("aria-describedby") || ""}`
            .trim()
            .split(/\s+/);
        const errors = ids
          .map((id) => resolveId(el, id))
          .filter(
            (node) =>
              node &&
              (el.getAttribute("aria-invalid") === "true" ||
                node.matches("[role=alert],[aria-live=assertive]") ||
                /error/i.test(node.className)),
          )
          .map(text)
          .filter(Boolean);
        if (el.getAttribute("aria-invalid") === "true" && !errors.length)
          errors.push("The employer marked this upload invalid.");
        return {
          label: rawLabel.replace(/\s*\*\s*$/, ""),
          inputId: el.id || "",
          inputName: el.name || "",
          inputIndex: index,
          required:
            el.required ||
            el.getAttribute("aria-required") === "true" ||
            /\*\s*$/.test(rawLabel),
          accept: el.accept || "",
          filename: el.files?.[0]?.name || "",
          errors,
          accepted: !!el.files?.length && !errors.length && el.validity.valid,
        };
      }),
      title: document.title,
    };
  }
  const results = [];
  for (const request of approved) {
    const node = nodes[request.index],
      previous = globalThis.careerpathControlSnapshot?.[request.index];
    const fail = (reason) =>
      results.push({ index: request.index, ok: false, reason });
    if (
      !node ||
      node.el !== previous?.el ||
      node.manualReason ||
      node.signature !== request.signature ||
      node.current() !== request.before
    ) {
      fail("Field changed since preview. Rescan; your edits were preserved.");
      continue;
    }
    const { el, kind, optionNodes, optionText, openMenu, closeMenu } = node;
    try {
      if (kind === "text") {
        if (node.current()) {
          fail("Existing text preserved.");
          continue;
        }
        if (el.maxLength >= 0 && request.value.length > el.maxLength) {
          fail("Answer exceeds the field limit.");
          continue;
        }
        const proto =
          el.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(
          el,
          request.value,
        );
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        if (!request.option) {
          fail("No exact option approved.");
          continue;
        }
        if (kind === "combo") {
          await openMenu();
        }
        if (
          kind === "combo" &&
          !optionNodes().some(
            (option) =>
              normalize(optionText(option)) === normalize(request.option),
          ) &&
          el.tagName === "INPUT" &&
          !el.readOnly
        ) {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(el, request.option);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          for (
            let wait = 0;
            wait < 15 &&
            !optionNodes().some(
              (option) =>
                normalize(optionText(option)) === normalize(request.option),
            );
            wait++
          )
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const options = optionNodes().filter(
          (o) => normalize(optionText(o)) === normalize(request.option),
        );
        if (options.length !== 1) {
          fail(
            "Approved option is missing or ambiguous. Open the menu and rescan.",
          );
          continue;
        }
        const option = options[0];
        if (kind === "select") {
          Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          ).set.call(el, option.value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (kind === "combo" || !option.checked) option.click();
      }
      el.blur();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const retained = node.current();
      const expected = kind === "text" ? request.value : request.option;
      let ok =
        el.isConnected &&
        !el.closest("[aria-invalid=true]") &&
        (el.validity?.valid ?? true);
      if (kind === "combo") {
        // Eightfold must expose the committed choice again after blur, not just query text.
        if (/(^|\.)eightfold\.ai$/i.test(document.location.hostname)) {
          await openMenu();
          const selected = optionNodes().filter(
            (o) =>
              normalize(optionText(o)) === normalize(expected) &&
              (o.getAttribute("aria-selected") === "true" ||
                o.getAttribute("aria-checked") === "true"),
          );
          closeMenu();
          await new Promise((resolve) => setTimeout(resolve, 350));
          ok &&=
            selected.length === 1 &&
            !!node.current() &&
            !el.closest("[aria-invalid=true]") &&
            (el.validity?.valid ?? true);
        } else {
          const selected = optionNodes().some(
            (o) =>
              normalize(optionText(o)) === normalize(expected) &&
              o.getAttribute("aria-selected") === "true",
          );
          ok &&=
            normalize(retained) === normalize(expected) &&
            (selected || el.getAttribute("aria-expanded") === "false");
        }
      } else if (kind === "checkbox" || kind === "radio")
        ok &&= node.members.some(
          (o) =>
            o.checked && normalize(node.optionText(o)) === normalize(expected),
        );
      else
        ok &&=
          kind === "text"
            ? retained === expected
            : normalize(retained) === normalize(expected);
      results.push({
        index: request.index,
        ok,
        reason: ok
          ? "Read back and verified after blur."
          : kind === "combo" &&
              /(^|\.)eightfold\.ai$/i.test(document.location.hostname)
            ? "Eightfold did not expose a committed selection after blur. Retry this field or select and verify it on the form."
            : "The form did not retain a valid, committed value after blur. Retry this field or complete on the form.",
        value: retained,
      });
    } catch {
      fail("Control could not be filled. Complete on the form or rescan.");
    }
  }
  return results;
}
