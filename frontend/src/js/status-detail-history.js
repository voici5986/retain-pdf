import {
  escapeHtml,
  formatEventTimestamp,
  formatRuntimeDuration,
  isTerminalStatus,
  resolveStageHistory,
  resolveStageHistoryDuration,
  summarizeStageName,
} from "./status-detail-utils.js";

export function buildStageHistoryPresentation(job) {
  const history = resolveStageHistory(job);
  const markup = history.map((entry, index) => {
    const duration = resolveStageHistoryDuration(entry, job);
    const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
    const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isTerminalStatus(job.status) ? "-" : "进行中");
    const stageName = summarizeStageName(entry?.stage, entry?.detail);
    const stageKey = summarizeStageName(entry?.stage, "");
    const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
    return `
      <article class="stage-history-item">
        <div class="stage-history-main">
          <span class="stage-history-index">${index + 1}</span>
          <div class="stage-history-copy">
            <div class="stage-history-title">${escapeHtml(stageName)}</div>
            <div class="stage-history-stage">${escapeHtml(stageKey)}</div>
            <div class="stage-history-meta">${escapeHtml(enterAt)} → ${escapeHtml(exitAt)}${escapeHtml(terminalText)}</div>
          </div>
        </div>
        <div class="stage-history-duration">${escapeHtml(formatRuntimeDuration(duration))}</div>
      </article>
    `;
  }).join("");
  return {
    markup,
    emptyText: "后端未返回 runtime.stage_history",
    hasItems: history.length > 0,
  };
}
