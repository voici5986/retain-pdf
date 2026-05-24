import { resolveDisplayedStagePresentation } from "./job-stage-presentation.js";
import {
  renderStatusRingFallback,
  statusActionReady,
} from "./ui-presentation-view.js";

export function renderLegacyStatusRing(job, events) {
  const presentation = resolveDisplayedStagePresentation(job, events);
  const stageText = presentation.detail;
  renderStatusRingFallback({
    label: presentation.label,
    value: stageText || "准备中",
    stageKey: presentation.stageKey,
    pdfReady: statusActionReady("pdf-btn") && job.status === "succeeded",
    readerReady: statusActionReady("reader-btn") && job.status === "succeeded",
  });
}
