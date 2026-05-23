import { buildFrontendPageUrl } from "./config.js";

export function getJobIdFromQuery() {
  return new URLSearchParams(window.location.search).get("job_id")?.trim() || "";
}

export function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function firstJobIdFromPayload(payload) {
  return firstNonEmptyText(
    payload?.job_id,
    payload?.data?.job_id,
    payload?.job?.job_id,
    payload?.job?.id,
    payload?.id,
  );
}

export function buildReaderPageUrl(jobId) {
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) {
    return "";
  }
  return buildFrontendPageUrl("./reader.html", {
    job_id: normalizedJobId,
  });
}

export function buildDetailPageUrl(jobId) {
  return buildFrontendPageUrl("./detail.html", {
    job_id: jobId,
  });
}
