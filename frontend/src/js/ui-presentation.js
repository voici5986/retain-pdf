import {
  buildReaderPageUrl,
  isReaderActionEnabled,
  prepareFilePicker,
  resetUploadedFile as resetUploadedFilePresentation,
  setLinearProgress,
  updateActionButtons,
} from "./job-ui-actions.js";
import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "./job-stage-presentation.js";
import {
  buildStatusDetailSnapshot,
  renderStatusDetailSections,
} from "./status-detail-presentation.js";
import { resolveLiveDurations } from "./status-detail-utils.js";
import {
  renderStatusCardSnapshot,
  renderStatusDetailSnapshotView,
  renderStatusRingFallback,
  setInputValueView,
  setJobWarningVisible,
  setStatusCardElapsed,
  setStatusView,
  setTextView,
  setWorkflowSectionsView,
  statusActionReady,
  statusSectionStatus,
} from "./ui-presentation-view.js";
import {
  keepDisplayedStageForward,
  pinnedStagePresentation,
} from "./ui-stage-pinning.js";
import { normalizeStageRetryActions } from "./ui-stage-actions.js";
import { state } from "./state.js";
import {
  formatJobFinishedAt,
  isTerminalStatus,
  normalizeJobPayload,
  resolveJobActions,
  resolveJobSourcePdfAction,
  summarizePublicError,
  summarizeStatus,
} from "./job.js";

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function stopElapsedTicker() {
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

function renderElapsed() {
  const snapshot = state.currentJobSnapshot;
  if (!snapshot) {
    setTextView("query-job-duration", "-");
    setStatusCardElapsed("-");
    return;
  }
  const durations = resolveLiveDurations(snapshot);
  setTextView("query-job-duration", durations.totalElapsedText);
  setStatusCardElapsed(durations.totalElapsedText);
  setTextView("runtime-stage-elapsed", durations.stageElapsedText);
  setTextView("runtime-total-elapsed", durations.totalElapsedText);
}

function startElapsedTicker() {
  stopElapsedTicker();
  renderElapsed();
  const status = statusSectionStatus();
  if (isTerminalStatus(status)) {
    return;
  }
  state.elapsedTimer = setInterval(() => {
    renderElapsed();
  }, 1000);
}

function updateRing(job) {
  const presentation = resolveDisplayedStagePresentation(job, state.currentJobEvents);
  const stageText = presentation.detail;
  renderStatusRingFallback({
    label: presentation.label,
    value: stageText || "准备中",
    stageKey: presentation.stageKey,
    pdfReady: statusActionReady("pdf-btn") && job.status === "succeeded",
    readerReady: statusActionReady("reader-btn") && job.status === "succeeded",
  });
}

export function setStatus(status) {
  setStatusView(status);
  startElapsedTicker();
}

export function setWorkflowSections(job = null) {
  const normalized = job ? normalizeJobPayload(job) : null;
  const hasJob = Boolean(normalized && normalized.job_id);
  if (!hasJob) {
    setWorkflowSectionsView({ hasJob: false, processing: false });
    stopElapsedTicker();
    return;
  }
  const processing = !isTerminalStatus(normalized.status);
  setWorkflowSectionsView({ hasJob: true, processing });
}

export {
  clearFileInputValue,
  prepareFilePicker,
  resetUploadProgress,
  setLinearProgress,
  setUploadProgress,
  updateActionButtons,
} from "./job-ui-actions.js";

export function resetUploadedFile() {
  stopElapsedTicker();
  resetUploadedFilePresentation();
}

export function updateJobWarning(status) {
  const active = status === "queued" || status === "running";
  setJobWarningVisible(active);
}

export function renderJob(payload, eventsPayload = null, manifestPayload = null, stageActionsPayload = null) {
  const job = normalizeJobPayload(payload);
  const nextJobId = job.job_id || state.currentJobId;
  state.currentJobSnapshot = job;
  state.currentJobId = nextJobId;
  if (eventsPayload === null && state.currentJobEventsJobId && state.currentJobEventsJobId !== nextJobId) {
    state.currentJobEvents = null;
    state.currentJobEventsJobId = "";
    state.currentJobEventsFetchedAt = 0;
  }
  if (manifestPayload === null && state.currentJobManifestJobId && state.currentJobManifestJobId !== nextJobId) {
    state.currentJobManifest = null;
    state.currentJobManifestJobId = "";
    state.currentJobManifestFetchedAt = 0;
  }
  if (eventsPayload !== null) {
    state.currentJobEvents = eventsPayload;
    state.currentJobEventsJobId = nextJobId;
    state.currentJobEventsFetchedAt = Date.now();
  }
  if (manifestPayload !== null) {
    state.currentJobManifest = manifestPayload;
    state.currentJobManifestJobId = nextJobId;
    state.currentJobManifestFetchedAt = Date.now();
  }
  if (stageActionsPayload !== null) {
    state.currentJobStageActions = stageActionsPayload;
    state.currentJobStageActionsJobId = nextJobId;
    state.currentJobStageActionsFetchedAt = Date.now();
  }
  const stagePresentation = resolveDisplayedStagePresentation(
    job,
    eventsPayload !== null ? eventsPayload : state.currentJobEvents,
  );
  const displayStage = keepDisplayedStageForward({
    state,
    stageKey: stagePresentation.stageKey,
    jobId: nextJobId,
  });
  stagePresentation.stageKey = displayStage.stageKey;
  if (displayStage.keptPrevious) {
    const pinned = pinnedStagePresentation(displayStage.stageKey);
    stagePresentation.visualStageKey = displayStage.stageKey;
    stagePresentation.label = pinned.label;
    stagePresentation.detail = pinned.detail;
    stagePresentation.progressText = "";
    stagePresentation.progressCurrent = null;
    stagePresentation.progressTotal = null;
    stagePresentation.progressIndeterminate = false;
  }
  state.currentJobStartedAt = resolveElapsedStart(job);
  state.currentJobFinishedAt = (job.finished_at || job.updated_at || "").trim();
  setWorkflowSections(job);
  setTextView("job-id", job.job_id || "-");
  setTextView("job-summary", summarizeStatus(job.status || "idle"));
  setTextView("job-stage-detail", stagePresentation.detail);
  setTextView("job-finished-at", formatJobFinishedAt(job));
  setTextView("query-job-finished-at", formatJobFinishedAt(job));
  setInputValueView("job-id-input", job.job_id || "");
  setStatus(job.status || "idle");
  const publicErrorText = summarizePublicError(job);
  setTextView("error-box", publicErrorText);
  updateActionButtons(job, manifestPayload);
  const actions = resolveJobActions(job);
  const readerEnabled = isReaderActionEnabled(job, manifestPayload);
  const sourcePdfAction = resolveJobSourcePdfAction(job, manifestPayload);
  const stageText = stagePresentation.detail;
  if (renderStatusCardSnapshot({
      jobId: job.job_id || nextJobId || "",
      status: job.status || "idle",
      label: stagePresentation.label,
      value: stageText || "准备中",
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
      stageProgressByKey: collectStageProgressByKey(
        job,
        eventsPayload !== null ? eventsPayload : state.currentJobEvents,
      ),
      stageRetryActions: normalizeStageRetryActions(
        stageActionsPayload !== null ? stageActionsPayload : state.currentJobStageActions,
      ),
      pdfReady: actions.pdfEnabled && !!actions.pdf && job.status === "succeeded",
      pdfUrl: actions.pdf,
      readerReady: readerEnabled && job.status === "succeeded",
      readerUrl: buildReaderPageUrl(job.job_id),
      sourcePdfReady: sourcePdfAction.ready && !!sourcePdfAction.url && job.status === "succeeded",
      sourcePdfUrl: sourcePdfAction.url,
      cancelEnabled: actions.cancelEnabled && !!actions.cancel,
      backHomeVisible: isTerminalStatus(job.status),
    })) {
    // Rendered by the web component.
  } else {
    setLinearProgress(
      "job-progress-bar",
      "job-progress-text",
      stagePresentation.progressCurrent,
      stagePresentation.progressTotal,
      "-",
      job.progress_percent,
    );
    updateRing(job);
  }
  const statusDetailSnapshot = buildStatusDetailSnapshot(job, eventsPayload);
  if (!renderStatusDetailSnapshotView(statusDetailSnapshot)) {
    renderStatusDetailSections(job, eventsPayload);
  }
  startElapsedTicker();
  updateJobWarning(job.status || "idle");
}
