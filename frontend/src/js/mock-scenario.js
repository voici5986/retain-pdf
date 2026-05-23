export function currentMockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  const aliases = {
    queued: "upload",
    running: "translate",
    succeeded: "done",
    complete: "done",
    completed: "done",
  };
  const normalized = aliases[value] || value;
  return ["upload", "ocr", "translate", "render", "done", "failed"].includes(normalized) ? normalized : "";
}

export function isoOffsetMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
