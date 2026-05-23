import { STAGE_FLOW } from "./job-status-card-presets.js";
import { normalizeSelectedProgress } from "./job-status-card-progress.js";

export function effectiveFlowStageKey(snapshot = null) {
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  if (STAGE_FLOW.includes(stageKey)) {
    return stageKey;
  }
  const progressByKey = snapshot?.stageProgressByKey || {};
  return [...STAGE_FLOW].reverse().find((key) => progressByKey[key]) || "";
}

export function resolveSelectedStageContext({
  snapshot,
  selectedStageKey = "",
}) {
  const flowStageKey = effectiveFlowStageKey(snapshot);
  const selected = selectedStageKey || flowStageKey || snapshot.stageKey;
  const selectedIsCurrent = selected === snapshot.stageKey;
  const selectedHistoricalProgress = selectedIsCurrent ? null : snapshot.stageProgressByKey?.[selected];
  const currentProgress = {
    current: snapshot.progressCurrent,
    total: snapshot.progressTotal,
    progressText: snapshot.progressText,
    progressUnit: snapshot.progressUnit,
    indeterminate: snapshot.progressIndeterminate,
    substageKey: snapshot.substageKey,
    visualStageKey: snapshot.visualStageKey,
  };
  const selectedProgress = selectedIsCurrent
    ? normalizeSelectedProgress(currentProgress, snapshot.stageProgressByKey?.[selected])
    : normalizeSelectedProgress(selectedHistoricalProgress);
  return {
    flowStageKey,
    selected,
    selectedHistoricalProgress,
    selectedIsCurrent,
    selectedProgress,
  };
}
