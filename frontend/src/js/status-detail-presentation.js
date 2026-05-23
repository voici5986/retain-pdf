import { renderStatusDetailSnapshotSections } from "./features/status-detail/view.js";
import { resolveDisplayedStagePresentation } from "./job-stage-presentation.js";
import { buildEventsPresentation } from "./status-detail-events.js";
import { buildStageHistoryPresentation } from "./status-detail-history.js";
import {
  resolveJobActions,
  summarizeInvocationProtocol,
  summarizeInvocationSchemaVersion,
  summarizeRuntimeField,
} from "./job.js";
import {
  formatEventTimestamp,
  resolveLiveDurations,
  summarizeStageName,
} from "./status-detail-utils.js";

function stageIconMarkup(status, stageText) {
  const text = `${stageText || ""}`.toLowerCase();
  if (status === "succeeded") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (status === "failed") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M15 9l-6 6M9 9l6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (text.includes("排队")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  if (text.includes("翻译")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h8M8 6c0 6-2 10-5 12M8 6c1 3 3.5 6.5 7 9M14 6h6M17 6v12M14 18h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (text.includes("解析") || text.includes("ocr")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 4v5h5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function statusDetailNote(status) {
  return status === "failed"
    ? "查看失败原因、建议与事件流"
    : status === "succeeded"
      ? "任务已完成，可查看概览与事件流"
      : "查看任务概览、失败原因与事件流";
}

function buildHeadline(job, stageText) {
  return {
    iconMarkup: stageIconMarkup(job.status, stageText),
    jobId: job.job_id || "-",
    note: statusDetailNote(job.status),
  };
}

function summarizeMathMode(job) {
  const mathMode = `${job?.request_payload_math_mode || ""}`.trim();
  if (mathMode === "placeholder") {
    return "placeholder - 公式占位保护";
  }
  if (mathMode === "direct_typst") {
    return "direct_typst - 模型直出公式";
  }
  return mathMode || "-";
}

function buildRuntimeDetails(job, eventsPayload) {
  const durations = resolveLiveDurations(job);
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  return {
    currentStage: summarizeStageName(job.current_stage || job.stage, presentation.detail),
    stageElapsed: durations.stageElapsedText,
    totalElapsed: durations.totalElapsedText,
    retryCount: `${job.retry_count ?? 0}`,
    lastTransition: job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-",
    terminalReason: summarizeRuntimeField(job.terminal_reason),
    inputProtocol: summarizeInvocationProtocol(job),
    stageSpecVersion: summarizeInvocationSchemaVersion(job),
    mathMode: summarizeMathMode(job),
  };
}

function buildFailureDetails(job) {
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const diagnostics = job.diagnostics || job.failure_diagnostics || {};
  const failureLastLogLine = failure.last_log_line
    || failureDiagnostic.last_log_line
    || failure.raw_excerpt
    || failure.raw_exception_message
    || (Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "");
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  return {
    summary: summarizeRuntimeField(
      diagnostics.summary || diagnostics.detail || failure.summary || failure.detail || job.final_failure_summary || failureDiagnostic.summary || failureDiagnostic.detail || failure.raw_excerpt,
    ),
    category: summarizeRuntimeField(
      diagnostics.failure_category || diagnostics.category || diagnostics.error_type || failure.category || failure.failure_category || job.final_failure_category || failureDiagnostic.type || failureDiagnostic.error_kind || failure.error_type || failure.failure_code,
    ),
    stage: summarizeRuntimeField(
      diagnostics.failed_stage || diagnostics.stage || failure.stage || failure.failed_stage || failure.provider_stage || failureDiagnostic.stage || failureDiagnostic.failed_stage,
    ),
    rootCause: summarizeRuntimeField(
      diagnostics.root_cause || diagnostics.raw_exception_type || failure.root_cause || failureDiagnostic.root_cause || failure.raw_exception_type || failure.upstream_host,
    ),
    suggestion: summarizeRuntimeField(
      diagnostics.suggestion || failure.suggestion || failureDiagnostic.suggestion || failure.failure_code,
    ),
    lastLogLine: summarizeRuntimeField(
      diagnostics.raw_excerpt || diagnostics.detail || failureLastLogLine,
    ),
    retryable: typeof (diagnostics.retryable ?? retryable) === "boolean" ? ((diagnostics.retryable ?? retryable) ? "是" : "否") : "-",
  };
}

export function buildStatusDetailSnapshot(job, eventsPayload) {
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const actions = resolveJobActions(job);
  const rerunEnabled = Boolean(actions.rerunEnabled && actions.rerun);

  return {
    headline: buildHeadline(job, presentation.detail),
    runtime: buildRuntimeDetails(job, eventsPayload),
    failure: buildFailureDetails(job),
    stageHistory: buildStageHistoryPresentation(job),
    events: buildEventsPresentation(eventsPayload),
    rerun: {
      enabled: rerunEnabled,
      status: rerunEnabled
        ? "后端支持从当前任务产物创建恢复任务。"
        : "当前任务暂不可从断点恢复。",
    },
  };
}

export function renderStatusDetailSections(job, eventsPayload) {
  const snapshot = buildStatusDetailSnapshot(job, eventsPayload);
  renderStatusDetailSnapshotSections(snapshot);
}
