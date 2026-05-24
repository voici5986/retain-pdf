import {
  buildStatusDetailSnapshot,
  renderStatusDetailSections,
} from "./status-detail-presentation.js";
import { renderStatusDetailSnapshotView } from "./ui-presentation-view.js";

export function renderStatusDetails(job, events) {
  const statusDetailSnapshot = buildStatusDetailSnapshot(job, events);
  if (!renderStatusDetailSnapshotView(statusDetailSnapshot)) {
    renderStatusDetailSections(job, events);
  }
}
