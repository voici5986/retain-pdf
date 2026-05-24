import {
  summarizeStageKey,
  progressFromText,
  stageSubtypeOf,
} from "./job-status-summary.js";
import {
  ocrProgressFallbackForRawStage,
  rawStageOfPayload,
} from "./job-stage-contract.js";
import {
  firstNumber,
  progressUnitOf,
} from "./job-stage-presentation-utils.js";

export function jobProgress(job = {}) {
  const textProgress = progressFromText(job);
  const current = firstNumber(job?.progress_current, job?.progress?.current);
  const total = firstNumber(job?.progress_total, job?.progress?.total);
  return {
    current: current ?? textProgress.current,
    total: total ?? textProgress.total,
  };
}

export function stageFallbackProgress(stageKey, job = {}) {
  return stageKey === "ocr" ? ocrProgressFallbackForRawStage(rawStageOfPayload(job)) : null;
}

export function shouldPreferJobProgress(job, stageKey, latestProgress) {
  if (!["ocr", "translate", "render"].includes(stageKey)) {
    return false;
  }
  if (summarizeStageKey(job) !== stageKey) {
    return false;
  }
  const fallback = jobProgress(job);
  if (fallback.current === null || fallback.total === null || fallback.total <= 0) {
    return false;
  }
  if (!latestProgress) {
    return true;
  }
  if (latestProgress.current === null || latestProgress.total === null || latestProgress.total <= 0) {
    return true;
  }
  if (fallback.total !== latestProgress.total) {
    return fallback.current / fallback.total >= latestProgress.current / latestProgress.total;
  }
  return fallback.current >= latestProgress.current;
}

export function jobProgressRecord(job, stageKey) {
  const progress = jobProgress(job);
  if (progress.current === null || progress.total === null || progress.total <= 0) {
    return null;
  }
  const payload = {
    ...job,
    progress_current: progress.current,
    progress_total: progress.total,
    progress_unit: progressUnitOf(job) || (stageKey === "translate" ? "batch" : "page"),
  };
  return {
    payload,
    current: progress.current,
    total: progress.total,
    progressPercent: firstNumber(job?.progress_percent, job?.progress?.percent),
    progressUnit: payload.progress_unit,
    substageKey: stageSubtypeOf(payload),
  };
}
