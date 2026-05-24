import {
  formatJobFinishedAt,
  summarizePublicError,
  summarizeStatus,
} from "./job.js";
import {
  setInputValueView,
  setTextView,
} from "./ui-presentation-view.js";

export function renderJobStatusSummary(job, stagePresentation) {
  const publicErrorText = summarizePublicError(job);
  setTextView("job-id", job.job_id || "-");
  setTextView("job-summary", summarizeStatus(job.status || "idle"));
  setTextView("job-stage-detail", stagePresentation.detail);
  setTextView("job-finished-at", formatJobFinishedAt(job));
  setTextView("query-job-finished-at", formatJobFinishedAt(job));
  setInputValueView("job-id-input", job.job_id || "");
  setTextView("error-box", publicErrorText);
  return {
    publicErrorText,
  };
}
