// Chrome serializes this function into the active tab. Keep it self-contained.
export function applicationFields(approved = null, report = false) {
  const types = new Set(["text", "email", "tel", "url"]);
  const sensitive =
    /\b(password|passcode|passphrase|pin|social security|ssn|passport|driver.?s licen[sc]e|tax id|national id|credit card|debit card|card number|cvv|cvc|bank|routing number|account number|security code|verification code|one time|otp|birth date|date of birth|dob)\b/i;
  const blockedAutocomplete =
    /(?:^|\s)(?:cc-\S+|current-password|new-password|one-time-code|bday(?:-\w+)?)(?:\s|$)/i;
  const controls = [...document.querySelectorAll("input, textarea")];
  const visible = (el) => {
    if (
      !el.getClientRects().length ||
      el.closest("[hidden], [inert], [aria-hidden=true]")
    )
      return false;
    for (let parent = el; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.visibility !== "visible" || style.opacity === "0") return false;
    }
    return true;
  };
  const describe = (el, index, allowFilled = false) => {
    if (
      (!types.has(el.type) && el.tagName !== "TEXTAREA") ||
      el.matches(
        ":disabled, [readonly], [aria-disabled=true], [aria-readonly=true]",
      ) ||
      (!allowFilled && el.value !== "") ||
      !visible(el)
    )
      return null;
    const referenced = (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    const labels = [...(el.labels || [])]
      .map((label) => label.textContent)
      .join(" ");
    const aria = el.getAttribute("aria-label") || "";
    const placeholder = el.getAttribute("placeholder") || "";
    const autocomplete = el.getAttribute("autocomplete") || "";
    const legend =
      el.closest("fieldset")?.querySelector(":scope > legend")?.textContent ||
      "";
    const generic =
      /^(?:textbox|search|select|choose|enter text|text input)[.… ]*$/i;
    const caption =
      el.parentElement?.previousElementSibling ?? el.previousElementSibling;
    const nearby = [el.previousElementSibling, caption].find(
      (node) =>
        node?.matches("label, legend, span, p, div") &&
        !node.querySelector("input, select, textarea, button") &&
        node.textContent.trim().length <= 120 &&
        visible(node),
    )?.textContent;
    const label = (
      [referenced, labels, aria, nearby, placeholder].find(
        (value) => value?.trim() && !generic.test(value.trim()),
      ) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const widget =
      el.closest(
        '[role="combobox"], [aria-haspopup="listbox"], [aria-autocomplete], [aria-expanded][aria-controls]',
      ) || el.hasAttribute("list");
    const demographic =
      /\b(pronouns?|gender|race|ethnicity|disability|veteran)\b/i.test(
        [label, referenced, labels, aria, legend, el.name, el.id].join(" "),
      );
    const manual = demographic
      ? "demographic"
      : widget || /^select date[ *]*$/i.test(label)
        ? "choice"
        : null;
    const phone =
      !widget && /(?:^|[_-])phone(?:[_-]number)?$/i.test(el.id || el.name);
    const display =
      label ||
      (widget ? "Choose an option on the form" : phone ? "Phone number" : "");
    const semantic =
      autocomplete.toLowerCase().trim().split(/\s+/).at(-1) || "";
    const signature = JSON.stringify([
      display,
      el.tagName,
      el.type,
      el.id,
      el.name,
      autocomplete,
      manual,
    ]);

    const identifiers = [el.id, el.name, autocomplete]
      .join(" ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ");
    if (
      (!display && !semantic) ||
      display.length > 600 ||
      blockedAutocomplete.test(autocomplete) ||
      sensitive.test(
        [
          label,
          referenced,
          aria,
          labels,
          placeholder,
          identifiers,
          legend,
        ].join(" "),
      )
    )
      return null;
    return {
      index,
      label: display || semantic,
      signature,
      autocomplete: semantic,
      manual,
      filled: el.value !== "",
    };
  };
  if (!approved) {
    globalThis.careerpathScannedControls = controls;
    const fields = controls
      .map((el, index) => describe(el, index, report))
      .filter(Boolean);
    if (!report) return fields;
    const frames = [...document.querySelectorAll("iframe[src]")].filter(
      (frame) =>
        frame.getAttribute("src")?.trim() &&
        /^https?:/.test(frame.src) &&
        visible(frame),
    );
    const greenhouse = frames
      .map((frame) => {
        try {
          const url = new URL(frame.src);
          if (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.port &&
            ["job-boards.greenhouse.io", "boards.greenhouse.io"].includes(
              url.hostname,
            )
          )
            return url.href;
        } catch {
          /* An invalid embed has no safe standalone destination. */
        }
        return null;
      })
      .find(Boolean);
    const checklist = [
      ...document.querySelectorAll(
        'input[type="file"], select, input[required], textarea[required], [role="combobox"]',
      ),
    ]
      .filter(
        (el) =>
          visible(el) &&
          !el.matches(":disabled") &&
          (el.matches('[role="combobox"]') ||
            (el.matches('input[type="checkbox"], input[type="radio"]')
              ? !el.checked
              : !el.value)) &&
          !el.files?.length,
      )
      .map((el) =>
        el.type === "file"
          ? "Upload résumé or requested attachment"
          : el.matches('[role="combobox"]')
            ? `Verify selection: ${describe(el, controls.indexOf(el), true)?.label || el.getAttribute("aria-label") || "dropdown or autocomplete"}`
            : describe(el, controls.indexOf(el))?.label ||
              el.labels?.[0]?.textContent?.trim() ||
              el.getAttribute("aria-label") ||
              "Complete a required field on the form",
      )
      .slice(0, 60);
    // Some employers expose the upload button while hiding its native file input.
    if (
      [...document.querySelectorAll("button, [role=button]")].some(
        (el) =>
          visible(el) &&
          !el.matches(":disabled, [aria-disabled=true]") &&
          /^(?:select file\s*[-–]\s*)?(?:upload|attach)(?: your)? (?:résumé|resume|cv)\b/i.test(
            (el.getAttribute("aria-label") || el.textContent).trim(),
          ),
      )
    )
      checklist.push("Upload résumé or requested attachment");
    return {
      checklist,
      fields: fields.filter((field) => !field.filled),
      filled: fields.filter((field) => field.filled).length,
      embedded: frames.length > 0,
      greenhouse,
    };
  }
  const scanned = globalThis.careerpathScannedControls;
  delete globalThis.careerpathScannedControls;
  const attempted = [];
  for (const { index, signature, value } of approved) {
    const el = controls[index];
    const current = el && describe(el, index);
    if (
      !el?.isConnected ||
      el !== scanned?.[index] ||
      !current ||
      current.manual ||
      current.signature !== signature ||
      (el.maxLength >= 0 && value.length > el.maxLength) ||
      (el.tagName === "INPUT" && /[\r\n]/.test(value))
    )
      continue;
    const prototype =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    attempted.push({ el, value });
  }
  const retained = () =>
    attempted.filter(
      ({ el, value }) =>
        el.isConnected &&
        el.value === value &&
        el.validity.valid &&
        el.getAttribute("aria-invalid") !== "true",
    ).length;
  return report
    ? new Promise((resolve) => setTimeout(() => resolve(retained()), 350))
    : retained();
}
