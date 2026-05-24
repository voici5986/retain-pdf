import { resolveDisplayedStagePresentation } from "./job-stage-presentation.js";
import { resolvePinnedStagePresentation } from "./ui-stage-pinning.js";

export function resolveRenderStagePresentation({
  state,
  job,
  jobId,
  events,
}) {
  return resolvePinnedStagePresentation({
    state,
    jobId,
    presentation: resolveDisplayedStagePresentation(job, events),
  });
}
