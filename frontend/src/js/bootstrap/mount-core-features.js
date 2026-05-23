import { isMockMode } from "../config.js";
import { mountAppShellFeature } from "../features/app-shell/controller.js";
import { setText } from "../main-helpers.js";
import {
  prepareFilePicker,
  renderJob,
  resetUploadProgress,
  resetUploadedFile,
  setLinearProgress,
  setWorkflowSections,
  updateActionButtons,
  updateJobWarning,
} from "../ui.js";

export function mountCoreFeatures(features) {
  features.appShellFeature = mountAppShellFeature({
    isMockMode,
    prepareFilePicker,
    setText,
    setWorkflowSections,
    setLinearProgress,
    updateActionButtons,
    renderPageRangeSummary: () => features.uploadFeature?.renderPageRangeSummary(),
    resetUploadProgress,
    resetUploadedFile,
    applyWorkflowMode: () => features.workflowFeature?.applyWorkflowMode(),
    updateJobWarning,
    activateDetailTab: (name) => features.statusDetailFeature?.activateDetailTab(name),
  });
}

export const coreUiDependencies = {
  renderJob,
  resetUploadProgress,
  resetUploadedFile,
  setText,
  setWorkflowSections,
  updateJobWarning,
};
