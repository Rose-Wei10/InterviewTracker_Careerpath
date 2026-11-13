// Serialized by Chrome into each permitted frame; no imported helpers here.
export async function formControls(approved = null, inspect = null) {
  const visible = (el) =>
    !!el.getClientRects().length &&
    !el.closest("[hidden],[inert],[aria-hidden=true]") &&
    getComputedStyle(el).display !== "none" &&
    getComputedStyle(el).visibility !== "hidden";
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
        .map((id) => text(document.getElementById(id)))
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
    ...document.querySelectorAll(
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
    if (el.closest("[role=combobox]") !== el && el.closest("[role=combobox]"))
      continue;
    let kind =
      el.tagName === "SELECT"
        ? "select"
        : el.matches(
              "[role=combobox],[aria-autocomplete],[aria-haspopup=listbox]",
            )
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
          .map((id) => text(document.getElementById(id)))
          .join(" ") ||
        parent?.getAttribute("aria-label") ||
        (parent ? label(parent) : question);
    }
    if (!question) continue;
    const optionNodes = () => {
      if (kind === "select")
        return [...el.options].filter((o) => !o.disabled && o.value !== "");
      if (kind === "radio" || kind === "checkbox") return members;
      const ids =
        `${el.getAttribute("aria-controls") || ""} ${el.getAttribute("aria-owns") || ""}`
          .trim()
          .split(/\s+/);
      const lists = ids
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      // Never use options from an unrelated open menu.
      return lists
        .flatMap((list) => [...list.querySelectorAll("[role=option]")])
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
      el.focus();
      el.click();
      for (let wait = 0; wait < 15 && !optionNodes().length; wait++) {
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
      kind === "combo" &&
      (!current() || inspect?.signature === signature) &&
      !options.length &&
      (!inspect || inspect.signature === signature)
    ) {
      try {
        await openMenu();
        options = optionNodes().map(optionText);
      } finally {
        closeMenu();
      }
    }
    descriptors.push({
      index: nodes.length,
      label: question,
      kind,
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
      openMenu,
      closeMenu,
    });
  }
  if (!approved) {
    globalThis.careerpathControlSnapshot = nodes;
    return {
      fields: descriptors,
      frames: [...document.querySelectorAll("iframe[src]")]
        .filter(visible)
        .map((el) => el.src)
        .filter((url) => /^https?:/.test(url)),
      uploads: [...document.querySelectorAll("input[type=file]")].map(
        (el, index) => {
          const rawLabel = label(el) || "Résumé / attachment";
          const ids =
            `${el.getAttribute("aria-errormessage") || ""} ${el.getAttribute("aria-describedby") || ""}`
              .trim()
              .split(/\s+/);
          const errors = ids
            .map((id) => document.getElementById(id))
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
        },
      ),
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
