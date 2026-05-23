export function createJobState() {
  return {
    currentJobId: "",
    currentJobSnapshot: null,
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
    currentJobStartedAt: "",
    currentJobFinishedAt: "",
  };
}

export function resetJobState(target) {
  Object.assign(target, createJobState());
}

export function resetJobSecondaryState(target) {
  Object.assign(target, {
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
  });
}
