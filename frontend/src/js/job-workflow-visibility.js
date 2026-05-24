import { isTerminalStatus, normalizeJobPayload } from "./job.js";
import {
  setJobWarningVisible,
  setWorkflowSectionsView,
} from "./ui-presentation-view.js";

export function setWorkflowSections(job = null, { onClear = null } = {}) {
  const normalized = job ? normalizeJobPayload(job) : null;
  const hasJob = Boolean(normalized && normalized.job_id);
  if (!hasJob) {
    setWorkflowSectionsView({ hasJob: false, processing: false });
    onClear?.();
    return;
  }
  const processing = !isTerminalStatus(normalized.status);
  setWorkflowSectionsView({ hasJob: true, processing });
}

export function updateJobWarning(status) {
  const active = status === "queued" || status === "running";
  setJobWarningVisible(active);
}
