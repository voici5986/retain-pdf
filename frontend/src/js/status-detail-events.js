import { escapeHtml, formatEventTimestamp } from "./status-detail-utils.js";

function eventBadgeTone(item) {
  if (item.level === "error" || item.event === "failure_classified" || item.event === "job_terminal") {
    return "error";
  }
  if (item.level === "warn" || item.event === "retry_scheduled") {
    return "warn";
  }
  return "";
}

function formatEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_err) {
    return "";
  }
}

export function buildEventsPresentation(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const markup = items.map((item) => {
    const tone = eventBadgeTone(item);
    const payloadText = formatEventPayload(item.payload);
    return `
      <article class="event-item">
        <div class="event-meta">
          <span class="event-badge ${tone}">${escapeHtml(item.event || "-")}</span>
          <span>${formatEventTimestamp(item.ts)}</span>
          <span>${escapeHtml(item.stage || "-")}</span>
          <span>${escapeHtml(item.level || "-")}</span>
        </div>
        <div class="event-title">${escapeHtml(item.message || "-")}</div>
        ${payloadText ? `
          <details class="event-payload-wrap">
            <summary class="event-payload-toggle">查看 payload</summary>
            <pre class="event-payload">${escapeHtml(payloadText)}</pre>
          </details>
        ` : ""}
      </article>
    `;
  }).join("");
  return {
    markup,
    count: items.length,
    emptyText: "暂无事件",
    hasItems: items.length > 0,
  };
}
