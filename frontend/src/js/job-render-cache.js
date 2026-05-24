import { normalizeJobPayload } from "./job.js";

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function clearCachedEventsForOtherJob(state, jobId) {
  if (state.currentJobEventsJobId && state.currentJobEventsJobId !== jobId) {
    state.currentJobEvents = null;
    state.currentJobEventsJobId = "";
    state.currentJobEventsFetchedAt = 0;
  }
}

function clearCachedManifestForOtherJob(state, jobId) {
  if (state.currentJobManifestJobId && state.currentJobManifestJobId !== jobId) {
    state.currentJobManifest = null;
    state.currentJobManifestJobId = "";
    state.currentJobManifestFetchedAt = 0;
  }
}

function syncEventsPayload(state, jobId, eventsPayload) {
  if (eventsPayload === null) {
    clearCachedEventsForOtherJob(state, jobId);
    return state.currentJobEventsJobId === jobId ? state.currentJobEvents : null;
  }
  const isFreshEventsPayload = eventsPayload !== state.currentJobEvents
    || state.currentJobEventsJobId !== jobId;
  state.currentJobEvents = eventsPayload;
  state.currentJobEventsJobId = jobId;
  if (isFreshEventsPayload) {
    state.currentJobEventsFetchedAt = Date.now();
  }
  return state.currentJobEvents;
}

function syncManifestPayload(state, jobId, manifestPayload) {
  if (manifestPayload === null) {
    clearCachedManifestForOtherJob(state, jobId);
    return state.currentJobManifestJobId === jobId ? state.currentJobManifest : null;
  }
  const isFreshManifestPayload = manifestPayload !== state.currentJobManifest
    || state.currentJobManifestJobId !== jobId;
  state.currentJobManifest = manifestPayload;
  state.currentJobManifestJobId = jobId;
  if (isFreshManifestPayload) {
    state.currentJobManifestFetchedAt = Date.now();
  }
  return state.currentJobManifest;
}

function syncStageActionsPayload(state, jobId, stageActionsPayload) {
  if (stageActionsPayload === null) {
    return state.currentJobStageActionsJobId === jobId ? state.currentJobStageActions : null;
  }
  const isFreshStageActionsPayload = stageActionsPayload !== state.currentJobStageActions
    || state.currentJobStageActionsJobId !== jobId;
  state.currentJobStageActions = stageActionsPayload;
  state.currentJobStageActionsJobId = jobId;
  if (isFreshStageActionsPayload) {
    state.currentJobStageActionsFetchedAt = Date.now();
  }
  return state.currentJobStageActions;
}

export function syncJobRenderCache({
  state,
  payload,
  eventsPayload = null,
  manifestPayload = null,
  stageActionsPayload = null,
}) {
  const job = normalizeJobPayload(payload);
  const jobId = job.job_id || state.currentJobId;
  state.currentJobSnapshot = job;
  state.currentJobId = jobId;
  state.currentJobStartedAt = resolveElapsedStart(job);
  state.currentJobFinishedAt = (job.finished_at || job.updated_at || "").trim();
  return {
    job,
    jobId,
    events: syncEventsPayload(state, jobId, eventsPayload),
    manifest: syncManifestPayload(state, jobId, manifestPayload),
    stageActions: syncStageActionsPayload(state, jobId, stageActionsPayload),
  };
}
