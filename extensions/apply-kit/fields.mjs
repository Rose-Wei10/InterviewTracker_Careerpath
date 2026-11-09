// Chrome serializes this function into the active tab. Keep it self-contained.
export function applicationFields(approved = null) {
  const types = new Set(["text", "email", "tel", "url"]);
  const sensitive =
    /\b(password|passcode|passphrase|pin|social security|ssn|passport|driver.?s licen[sc]e|tax id|national id|credit card|debit card|card number|cvv|cvc|bank|routing number|account number|security code|verification code|one time|otp|birth date|date of birth|dob)\b/i;
  const blockedAutocomplete =
    /(?:^|\s)(?:cc-\S+|current-password|new-password|one-time-code|bday(?:-\w+)?)(?:\s|$)/i;
  const controls = [...document.querySelectorAll("input, textarea")];
  const describe = (el, index) => {
    if (
      (!types.has(el.type) && el.tagName !== "TEXTAREA") ||
      el.matches(
        ":disabled, [readonly], [aria-disabled=true], [aria-readonly=true]",
      ) ||
      el.closest("[hidden], [inert], [aria-hidden=true]") ||
      el.value !== "" ||
      !el.getClientRects().length
    )
      return null;
    for (let parent = el; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.visibility !== "visible" || style.opacity === "0") return null;
    }
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
    const label = (referenced || aria || labels || placeholder)
      .replace(/\s+/g, " ")
      .trim();
    const identifiers = [el.id, el.name, autocomplete]
      .join(" ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ");
    if (
      !label ||
      label.length > 600 ||
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
      label,
      signature: JSON.stringify([
        label,
        el.tagName,
        el.type,
        el.id,
        el.name,
        autocomplete,
      ]),
    };
  };
  if (!approved) {
    globalThis.careerpathScannedControls = controls;
    return controls.map(describe).filter(Boolean);
  }
  const scanned = globalThis.careerpathScannedControls;
  delete globalThis.careerpathScannedControls;
  let filled = 0;
  for (const { index, signature, value } of approved) {
    const el = controls[index];
    if (
      !el?.isConnected ||
      el !== scanned?.[index] ||
      describe(el, index)?.signature !== signature ||
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
    if (el.value === value) filled++;
  }
  return filled;
}
