import { createCredentialState, resetOcrValidationState as resetOcrValidationStateSlice } from "./state/credential-state.js";
import { createDesktopState } from "./state/desktop-state.js";
import { createDeveloperState } from "./state/developer-state.js";
import { createJobState, resetJobSecondaryState as resetJobSecondaryStateSlice, resetJobState as resetJobStateSlice } from "./state/job-state.js";
import { createRecentJobsState, resetRecentJobsListState as resetRecentJobsListStateSlice } from "./state/recent-jobs-state.js";
import { createTimerState } from "./state/timer-state.js";
import { createUploadState, resetUploadState as resetUploadStateSlice, setUploadState as setUploadStateSlice } from "./state/upload-state.js";

export {
  createCredentialState,
  createDesktopState,
  createDeveloperState,
  createJobState,
  createRecentJobsState,
  createTimerState,
  createUploadState,
};

export function createInitialState() {
  return {
    ...createTimerState(),
    ...createJobState(),
    ...createUploadState(),
    ...createRecentJobsState(),
    ...createCredentialState(),
    ...createDeveloperState(),
    ...createDesktopState(),
  };
}

export const state = createInitialState();

export function resetJobState(target = state) {
  resetJobStateSlice(target);
}

export function resetJobSecondaryState(target = state) {
  resetJobSecondaryStateSlice(target);
}

export function resetUploadState(target = state, options = {}) {
  resetUploadStateSlice(target, options);
}

export function setUploadState(target = state, payload = {}) {
  setUploadStateSlice(target, payload);
}

export function resetRecentJobsListState(target = state) {
  resetRecentJobsListStateSlice(target);
}

export function resetOcrValidationState(target = state) {
  resetOcrValidationStateSlice(target);
}
