import { setLinearProgress } from "./job-ui-actions.js";
import { buildStatusCardSnapshot } from "./status-card-snapshot.js";
import { renderLegacyStatusRing } from "./status-ring-fallback.js";
import { renderStatusCardSnapshot } from "./ui-presentation-view.js";

export function renderJobStatusCard({
  job,
  jobId,
  stagePresentation,
  events,
  manifest,
  stageActions,
  publicErrorText,
}) {
  if (renderStatusCardSnapshot(buildStatusCardSnapshot({
      job,
      jobId,
      stagePresentation,
      events,
      manifest,
      stageActions,
      publicErrorText,
    }))) {
    return;
  }
  setLinearProgress(
    "job-progress-bar",
    "job-progress-text",
    stagePresentation.progressCurrent,
    stagePresentation.progressTotal,
    "-",
    job.progress_percent,
  );
  renderLegacyStatusRing(job, events);
}
