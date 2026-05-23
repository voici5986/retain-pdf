import {
  summarizeStageDetail,
  summarizeStageKey,
  summarizeStageLabel,
  summarizeStageProgressText,
  progressFromText,
  stageSubtypeOf,
} from "./job-status-summary.js";
import {
  ocrProgressFallbackForRawStage,
  rawStageOfPayload,
  visualStageKeyForRawStage,
} from "./job-stage-contract.js";
import {
  compareProgressEventOrder,
  eventIdentity,
  firstNumber,
  progressUnitPriority,
} from "./job-stage-presentation-utils.js";
import {
  progressFromEvent,
  progressPercentFromEvent,
} from "./job-stage-event-progress.js";
import {
  keepForwardStageKey,
  latestStageEvent,
} from "./job-stage-event-selection.js";
import { compositeRenderProgressFromEvents } from "./job-stage-render-progress.js";

function stagePayloadFromEvent(job, item, progress) {
  const userStage = item?.user_stage || item?.payload?.user_stage || "";
  const rawStage = item?.stage || item?.provider_stage || userStage;
  return {
    ...job,
    status: item?.status || "running",
    user_stage: userStage,
    current_stage: rawStage,
    stage: item?.stage || "",
    substage: item?.substage || item?.payload?.substage || "",
    stage_detail: item?.stage_detail || item?.message || item?.payload?.stage_detail || "",
    progress_unit: item?.progress_unit || item?.payload?.progress_unit || "",
    progress_current: progress.current,
    progress_total: progress.total,
  };
}

function visualStageKeyForEventPayload(payload = {}, stageKey = "") {
  const substage = `${payload?.substage || payload?.payload?.substage || ""}`.trim().toLowerCase();
  if (stageKey === "ocr" && substage) {
    if (substage.includes("upload") || substage.includes("submitting") || substage.includes("submit")) {
      return "ocr_upload";
    }
    if (substage.includes("processing") || substage.includes("recogn") || substage.includes("running")) {
      return "ocr_processing";
    }
    if (substage.includes("result")) {
      return "ocr_result_ready";
    }
    if (substage.includes("normaliz") || substage.includes("standard")) {
      return "ocr_normalizing";
    }
  }
  return visualStageKeyForRawStage(rawStageOfPayload(payload), stageKey);
}

function shouldReplaceStageProgress(previous, next) {
  if (!previous) {
    return true;
  }
  if (
    next.current > 0
    && next.total > 0
    && next.current >= next.total
    && (next.progressUnit === "page" || next.progressUnit === "none" || next.visualStageKey === "ocr_result_ready")
  ) {
    return true;
  }
  const previousPriority = progressUnitPriority(previous.progressUnit);
  const nextPriority = progressUnitPriority(next.progressUnit);
  if (nextPriority !== previousPriority) {
    return nextPriority > previousPriority;
  }
  return true;
}

function shouldReplaceCurrentStageProgress(previous, next) {
  if (!previous) {
    return true;
  }
  const previousSeq = Number(previous.seq);
  const nextSeq = Number(next.seq);
  if (Number.isFinite(previousSeq) && Number.isFinite(nextSeq) && nextSeq !== previousSeq) {
    return nextSeq > previousSeq;
  }
  const previousTs = Date.parse(previous.ts || "");
  const nextTs = Date.parse(next.ts || "");
  if (Number.isFinite(previousTs) && Number.isFinite(nextTs) && nextTs !== previousTs) {
    return nextTs > previousTs;
  }
  return true;
}

function normalizeProgressRecord(job, item, itemStage) {
  const progress = progressFromEvent(item);
  const progressPercent = progressPercentFromEvent(item);
  if (
    (progress.current === null || progress.total === null || progress.total <= 0)
    && progressPercent === null
  ) {
    return null;
  }
  const payload = stagePayloadFromEvent(job, { ...item, stage: itemStage }, progress);
  const stageKey = summarizeStageKey(payload);
  if (!["ocr", "translate", "render"].includes(stageKey)) {
    return null;
  }
  const displayPayload = { ...payload };
  const visualStageKey = visualStageKeyForEventPayload(displayPayload, stageKey);
  const substageKey = stageSubtypeOf(displayPayload);
  const identity = eventIdentity(item);
  return {
    item,
    payload: displayPayload,
    stageKey,
    current: progress.current,
    total: progress.total,
    progressPercent,
    progressUnit: displayPayload.progress_unit,
    progressText: summarizeStageProgressText(displayPayload),
    visualStageKey,
    substageKey,
    indeterminate: stageKey === "ocr" && progress.current <= 0 && progress.total > 0,
    seq: identity.seq,
    ts: item?.ts || item?.created_at,
  };
}

function collectLatestCurrentStageProgress(job, eventsPayload, stageKey = "", substageKey = "") {
  if (stageKey === "render") {
    return compositeRenderProgressFromEvents(job, eventsPayload, {
      normalizeProgressRecord,
      shouldReplaceCurrentStageProgress,
    });
  }
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  let latest = null;
  let latestSameSubstage = null;
  for (const item of items) {
    const itemStage = `${item?.stage || item?.provider_stage || item?.user_stage || item?.payload?.user_stage || ""}`.trim();
    if (!itemStage) {
      continue;
    }
    const next = normalizeProgressRecord(job, item, itemStage);
    if (!next || next.stageKey !== stageKey) {
      continue;
    }
    if (shouldReplaceCurrentStageProgress(latest, next)) {
      latest = next;
    }
    if (substageKey && next.substageKey === substageKey && shouldReplaceCurrentStageProgress(latestSameSubstage, next)) {
      latestSameSubstage = next;
    }
  }
  return latestSameSubstage || latest;
}

function translationSubstageKeyFromTextPayload(payload = {}) {
  if (stageKeyOfPayload(payload) !== "translate") {
    return "";
  }
  return stageSubtypeOf(payload);
}

function stageKeyOfPayload(payload = {}) {
  return summarizeStageKey(payload);
}

export function collectStageProgressByKey(job, eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const progressByKey = {};
  const progressBySubstage = {};
  for (const item of items) {
    const itemStage = `${item?.stage || item?.provider_stage || item?.user_stage || item?.payload?.user_stage || ""}`.trim();
    if (!itemStage) {
      continue;
    }
    const nextProgress = normalizeProgressRecord(job, item, itemStage);
    if (!nextProgress) {
      continue;
    }
    const { stageKey, substageKey } = nextProgress;
    if (shouldReplaceStageProgress(progressByKey[stageKey], nextProgress)) {
      progressByKey[stageKey] = nextProgress;
    }
    if (stageKey === "translate" && substageKey) {
      const bySubstage = progressBySubstage[stageKey] || {};
      if (compareProgressEventOrder(bySubstage[substageKey], nextProgress) >= 0) {
        bySubstage[substageKey] = nextProgress;
      }
      progressBySubstage[stageKey] = bySubstage;
    }
  }
  Object.entries(progressBySubstage).forEach(([stageKey, bySubstage]) => {
    progressByKey[stageKey] = {
      ...progressByKey[stageKey],
      bySubstage,
    };
  });
  const renderCompositeProgress = compositeRenderProgressFromEvents(job, eventsPayload, {
    fallbackProgress: progressByKey.render,
    normalizeProgressRecord,
    shouldReplaceCurrentStageProgress,
  });
  if (renderCompositeProgress) {
    progressByKey.render = renderCompositeProgress;
  }
  return progressByKey;
}

function jobProgress(job = {}) {
  const textProgress = progressFromText(job);
  const current = firstNumber(job?.progress_current, job?.progress?.current);
  const total = firstNumber(job?.progress_total, job?.progress?.total);
  return {
    current: current ?? textProgress.current,
    total: total ?? textProgress.total,
  };
}

function stageProgressMatches(stageKey, eventPayload) {
  return Boolean(stageKey) && summarizeStageKey(eventPayload) === stageKey;
}

function stageFallbackProgress(stageKey, job = {}) {
  return stageKey === "ocr" ? ocrProgressFallbackForRawStage(rawStageOfPayload(job)) : null;
}

function visualStageKeyFor(job = {}, stageKey = "") {
  const substage = `${job?.substage || job?.payload?.substage || ""}`.trim().toLowerCase();
  if (stageKey === "ocr" && substage) {
    return visualStageKeyForEventPayload(job, stageKey);
  }
  return visualStageKeyForRawStage(rawStageOfPayload(job), stageKey);
}

export function resolveDisplayedStagePresentation(job, eventsPayload) {
  const fallbackProgress = jobProgress(job);
  const fallbackStageKey = summarizeStageKey(job);
  const stageFallback = stageFallbackProgress(fallbackStageKey, job);
  const fallback = {
    stageKey: fallbackStageKey,
    visualStageKey: visualStageKeyFor(job, fallbackStageKey),
    label: summarizeStageLabel(job),
    detail: summarizeStageDetail(job),
    progressText: summarizeStageProgressText(job) || stageFallback?.text || "",
    progressCurrent: fallbackProgress.current ?? stageFallback?.current ?? null,
    progressTotal: fallbackProgress.total ?? stageFallback?.total ?? null,
    substageKey: stageSubtypeOf(job),
    progressIndeterminate: fallbackProgress.current === null && fallbackProgress.total === null && Boolean(stageFallback),
  };
  const event = latestStageEvent(job, eventsPayload);
  if (!event) {
    return fallback;
  }
  const eventProgress = progressFromEvent(event);
  const rawEventPayload = {
    ...job,
    status: job.status,
    user_stage: event.user_stage || event.payload?.user_stage || "",
    current_stage: event.stage || event.provider_stage || event.user_stage || event.payload?.user_stage || job.current_stage || job.stage || "",
    substage: event.substage || event.payload?.substage || "",
    stage_detail: event.stage_detail || event.message || event.payload?.stage_detail || job.stage_detail || "",
    progress_unit: event.progress_unit || event.payload?.progress_unit || "",
    progress_current: eventProgress.current,
    progress_total: eventProgress.total,
  };
  const eventMatchesCurrentStage = stageProgressMatches(fallback.stageKey, rawEventPayload);
  const progress = {
    current: eventProgress.current ?? (eventMatchesCurrentStage ? fallbackProgress.current : null),
    total: eventProgress.total ?? (eventMatchesCurrentStage ? fallbackProgress.total : null),
  };
  const eventPayload = {
    ...rawEventPayload,
    progress_current: progress.current ?? stageFallback?.current ?? null,
    progress_total: progress.total ?? stageFallback?.total ?? null,
  };
  const eventProgressText = summarizeStageProgressText(eventPayload);
  const stageKey = keepForwardStageKey(job, eventPayload, eventsPayload);
  const eventSubstageKey = translationSubstageKeyFromTextPayload(eventPayload) || stageSubtypeOf(eventPayload);
  const latestCurrentProgress = collectLatestCurrentStageProgress(job, eventsPayload, stageKey, eventSubstageKey);
  const latestProgressPayload = latestCurrentProgress
    ? {
        ...latestCurrentProgress.payload,
        progress_unit: latestCurrentProgress.progressUnit || latestCurrentProgress.payload?.progress_unit || "",
        progress_current: latestCurrentProgress.current,
        progress_total: latestCurrentProgress.total,
      }
    : null;
  const currentProgressText = latestProgressPayload ? summarizeStageProgressText(latestProgressPayload) : eventProgressText;
  const currentVisualPayload = latestProgressPayload || eventPayload;
  const currentSubstagePayload = latestProgressPayload || eventPayload;
  const currentProgressIndeterminate = latestCurrentProgress
    ? (
        latestCurrentProgress.total !== null
        && (
          (stageKey === "ocr" && latestCurrentProgress.current === null)
          || (stageKey === "render" && latestCurrentProgress.current === 0)
        )
      )
    : eventProgress.current === null && eventProgress.total === null && Boolean(stageFallback);
  return {
    stageKey,
    visualStageKey: visualStageKeyFor(currentVisualPayload, stageKey),
    label: stageKey === summarizeStageKey(eventPayload) ? summarizeStageLabel(eventPayload) : summarizeStageLabel(job),
    detail: summarizeStageDetail(eventPayload),
    progressText: currentProgressText || stageFallback?.text || "",
    progressCurrent: latestCurrentProgress?.current ?? eventPayload.progress_current,
    progressTotal: latestCurrentProgress?.total ?? eventPayload.progress_total,
    progressPercent: latestCurrentProgress?.progressPercent ?? null,
    progressUnit: latestCurrentProgress?.progressUnit || eventPayload.progress_unit || "",
    substageKey: stageSubtypeOf(currentSubstagePayload),
    progressIndeterminate: currentProgressIndeterminate,
  };
}
