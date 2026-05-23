export function normalizeSelectedProgress(progress = {}, fallback = {}) {
  const fallbackBySubstage = fallback?.bySubstage || {};
  const progressSubstageKey = progress?.substageKey || fallback?.substageKey || "";
  const substageFallback = progressSubstageKey ? fallbackBySubstage[progressSubstageKey] : null;
  const current = Number(progress?.current ?? progress?.progressCurrent ?? substageFallback?.current ?? substageFallback?.progressCurrent ?? fallback?.current ?? fallback?.progressCurrent);
  const total = Number(progress?.total ?? progress?.progressTotal ?? substageFallback?.total ?? substageFallback?.progressTotal ?? fallback?.total ?? fallback?.progressTotal);
  return {
    current: Number.isFinite(current) ? current : NaN,
    total: Number.isFinite(total) ? total : NaN,
    progressText: progress?.progressText || substageFallback?.progressText || fallback?.progressText || "",
    progressUnit: progress?.progressUnit || substageFallback?.progressUnit || fallback?.progressUnit || "",
    indeterminate: Boolean(progress?.indeterminate ?? progress?.progressIndeterminate ?? substageFallback?.indeterminate ?? substageFallback?.progressIndeterminate ?? fallback?.indeterminate ?? fallback?.progressIndeterminate),
    substageKey: progressSubstageKey,
    visualStageKey: progress?.visualStageKey || substageFallback?.visualStageKey || fallback?.visualStageKey || "",
  };
}

export function shouldAnimateRenderPageProgress({
  selected,
  selectedIsCurrent,
  snapshot,
  selectedProgress,
  previous,
}) {
  const targetCurrent = Number(selectedProgress?.current);
  const targetTotal = Number(selectedProgress?.total);
  const status = `${snapshot?.status || ""}`.trim();
  const canAnimateRenderPages = selected === "render"
    && selectedIsCurrent
    && status === "running"
    && selectedProgress?.progressUnit !== "percent"
    && Number.isFinite(targetCurrent)
    && Number.isFinite(targetTotal)
    && targetTotal > 0
    && targetCurrent > 0;
  const rawPreviousCurrent = Number(previous?.current);
  const previousCurrent = Number.isFinite(rawPreviousCurrent) ? rawPreviousCurrent : 0;
  const previousTotal = Number(previous?.total);
  const shouldAnimate = canAnimateRenderPages
    && (!Number.isFinite(previousTotal) || previousTotal === targetTotal)
    && targetCurrent > previousCurrent + 1;
  return {
    previousCurrent,
    shouldAnimate,
    targetCurrent,
    targetTotal,
  };
}

export function buildProgressOptions({
  selected,
  selectedIsCurrent,
  snapshot,
  selectedProgress,
  displayedCurrent = null,
}) {
  const current = displayedCurrent ?? selectedProgress?.current;
  const total = selectedProgress?.total;
  const progressText = displayedCurrent === null || displayedCurrent >= Number(selectedProgress?.current)
    ? selectedProgress?.progressText || ""
    : `第 ${displayedCurrent}/${total} 页`;
  return {
    current,
    total,
    fallbackText: snapshot.progressFallbackText,
    percent: displayedCurrent === null && selectedIsCurrent ? snapshot.progressPercent : NaN,
    progressText,
    progressUnit: displayedCurrent === null ? selectedProgress?.progressUnit || "" : "",
    indeterminate: displayedCurrent === null ? selectedProgress?.indeterminate : false,
    stageKey: selected,
    forceVisible: displayedCurrent !== null || (["ocr", "translate", "render"].includes(selected)
      && (selectedIsCurrent || Boolean(selectedProgress))),
  };
}
