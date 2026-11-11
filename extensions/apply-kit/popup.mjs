document.getElementById("open").addEventListener("click", async () => {
  try {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: window.id });
    globalThis.close();
  } catch {
    document.getElementById("status").textContent =
      "Unable to open the panel. Reload the extension in Chrome 116 or newer.";
  }
});
