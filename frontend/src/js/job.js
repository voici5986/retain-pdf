import { firstNonEmpty } from "./job-core.js";
export {
  resolveJobActions,
  resolveJobSourcePdfAction,
} from "./job-actions.js";
export { normalizeJobPayload } from "./job-normalize.js";
export {
  summarizeDiagnostic,
  summarizePublicError,
  summarizeStatus,
} from "./job-diagnostics.js";
export {
  isTerminalStatus,
  unwrapEnvelope,
} from "./job-core.js";
export {
  formatEventTimestamp,
  formatJobDuration,
  formatJobFinishedAt,
  formatRuntimeDuration,
  summarizeRuntimeField,
} from "./job-formatters.js";
export {
  summarizeStageDetail,
  summarizeStageKey,
  summarizeStageLabel,
  summarizeStageProgressText,
} from "./job-status-summary.js";

export function summarizeInvocationProtocol(payload) {
  const invocation = payload?.invocation || {};
  const inputProtocol = firstNonEmpty(invocation.input_protocol);
  if (inputProtocol === "stage_spec") {
    return "Stage Spec";
  }
  return "-";
}

export function summarizeInvocationSchemaVersion(payload) {
  const invocation = payload?.invocation || {};
  return firstNonEmpty(invocation.stage_spec_schema_version) || "-";
}
