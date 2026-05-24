import { isTerminalStatus } from "./job.js";
import { resolveLiveDurations } from "./status-detail-utils.js";
import {
  setStatusCardElapsed,
  setTextView,
  statusSectionStatus,
} from "./ui-presentation-view.js";

export function stopElapsedTicker(state) {
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

export function renderElapsed(state) {
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

export function startElapsedTicker(state) {
  stopElapsedTicker(state);
  renderElapsed(state);
  const status = statusSectionStatus();
  if (isTerminalStatus(status)) {
    return;
  }
  state.elapsedTimer = setInterval(() => {
    renderElapsed(state);
  }, 1000);
}
