import {
  buildReaderPageUrl,
  isReaderActionEnabled,
} from "./job-ui-actions.js";
import { collectStageProgressByKey } from "./job-stage-presentation.js";
import { resolveLiveDurations } from "./status-detail-utils.js";
import { normalizeStageRetryActions } from "./ui-stage-actions.js";
import {
  isTerminalStatus,
  resolveJobActions,
  resolveJobSourcePdfAction,
} from "./job.js";

export function buildStatusCardSnapshot({
  job,
  jobId,
  stagePresentation,
  events,
  manifest,
  stageActions,
  publicErrorText,
}) {
  const actions = resolveJobActions(job);
  const readerEnabled = isReaderActionEnabled(job, manifest);
  const sourcePdfAction = resolveJobSourcePdfAction(job, manifest);
  const succeeded = job.status === "succeeded";
  return {
    jobId: job.job_id || jobId || "",
    status: job.status || "idle",
    label: stagePresentation.label,
    value: stagePresentation.detail || "准备中",
    stageKey: stagePresentation.stageKey,
    visualStageKey: stagePresentation.visualStageKey,
    elapsed: resolveLiveDurations(job).totalElapsedText,
    progressCurrent: stagePresentation.progressCurrent,
    progressTotal: stagePresentation.progressTotal,
    progressFallbackText: "-",
    progressPercent: stagePresentation.progressPercent ?? job.progress_percent,
    progressText: stagePresentation.progressText,
    progressUnit: stagePresentation.progressUnit,
    progressIndeterminate: stagePresentation.progressIndeterminate,
    errorText: publicErrorText === "-" ? "" : publicErrorText,
    stageProgressByKey: collectStageProgressByKey(job, events),
    stageRetryActions: normalizeStageRetryActions(stageActions),
    pdfReady: actions.pdfEnabled && !!actions.pdf && succeeded,
    pdfUrl: actions.pdf,
    readerReady: readerEnabled && succeeded,
    readerUrl: buildReaderPageUrl(job.job_id),
    sourcePdfReady: sourcePdfAction.ready && !!sourcePdfAction.url && succeeded,
    sourcePdfUrl: sourcePdfAction.url,
    cancelEnabled: actions.cancelEnabled && !!actions.cancel,
    backHomeVisible: isTerminalStatus(job.status),
  };
}
