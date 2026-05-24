import { $ } from "../../dom.js";
import { buildRecentJobsMarkup } from "./card-markup.js";
import { bindRecentJobsListEvents } from "./list-events.js";

function recentJobsDialogComponent() {
  return document.querySelector("recent-jobs-dialog");
}

export function hasRecentJobsView() {
  const component = recentJobsDialogComponent();
  if (component) {
    return true;
  }
  return Boolean($("recent-jobs-list") && $("recent-jobs-empty") && $("load-more-jobs-btn"));
}

export function setRecentJobsDialogOpen(open) {
  const component = recentJobsDialogComponent();
  if (component?.setOpen) {
    component.setOpen(open);
  } else {
    const dialog = $("query-dialog");
    if (!dialog) {
      return;
    }
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }
  $("open-query-btn")?.setAttribute("aria-expanded", open ? "true" : "false");
}

export function bindRecentJobsEvents({
  onOpen,
  onLoadMore,
} = {}) {
  $("open-query-btn")?.addEventListener("click", () => onOpen?.());

  const component = recentJobsDialogComponent();
  if (component?.bindEvents) {
    component.bindEvents({ onLoadMore });
    return;
  }

  $("load-more-jobs-btn")?.addEventListener("click", () => onLoadMore?.());
}

function summarizeInvocationCounts(items) {
  let stageSpecCount = 0;
  let unknownCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const protocol = `${item?.invocation?.input_protocol || ""}`.trim();
    if (protocol === "stage_spec") {
      stageSpecCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { stageSpecCount, unknownCount };
}

export function renderRecentJobsSummary(invocationSummary, items) {
  const stageSpecCountValue = Number(invocationSummary?.stage_spec_count);
  const unknownCountValue = Number(invocationSummary?.unknown_count);
  const counts = Number.isFinite(stageSpecCountValue) && Number.isFinite(unknownCountValue)
    ? { stageSpecCount: stageSpecCountValue, unknownCount: unknownCountValue }
    : summarizeInvocationCounts(items);
  const text = `Stage Spec ${counts.stageSpecCount} · Unknown ${counts.unknownCount}`;
  const component = recentJobsDialogComponent();
  if (component?.renderSummary) {
    component.renderSummary(text);
    return;
  }
  const summaryEl = $("recent-jobs-summary");
  if (summaryEl) {
    summaryEl.textContent = text;
  }
}

export function renderRecentJobsLoading() {
  const component = recentJobsDialogComponent();
  if (component?.renderLoading) {
    component.renderLoading();
    return;
  }
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = '<div class="events-empty">正在加载最近任务…</div>';
  loadMoreButton.classList.add("hidden");
}

export function renderRecentJobsEmpty(message, invocationSummary = null) {
  const component = recentJobsDialogComponent();
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!component?.renderEmpty && (!list || !empty || !loadMoreButton)) {
    return;
  }
  renderRecentJobsSummary(invocationSummary, []);
  if (component?.renderEmpty) {
    component.renderEmpty(message);
    return;
  }
  list.innerHTML = "";
  list.classList.add("hidden");
  empty.textContent = message || "暂无最近任务";
  empty.classList.remove("hidden");
  loadMoreButton.classList.add("hidden");
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function renderRecentJobsError(message, { reset = false } = {}) {
  const component = recentJobsDialogComponent();
  if (component?.renderError) {
    component.renderError(message, { reset });
    return;
  }
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  if (reset) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = message || "读取最近任务失败";
    empty.classList.remove("hidden");
  } else {
    loadMoreButton.classList.add("hidden");
  }
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function renderRecentJobsList({
  items,
  allItems,
  invocationSummary,
  reset = false,
  hasMore = false,
  onSelect,
  onDelete,
}) {
  const component = recentJobsDialogComponent();
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!component?.renderList && (!list || !empty || !loadMoreButton)) {
    return;
  }
  renderRecentJobsSummary(invocationSummary, allItems);
  const markup = buildRecentJobsMarkup(items);
  if (component?.renderList) {
    component.renderList(markup, { reset, hasMore, onSelect, onDelete });
    return;
  }
  list.classList.remove("hidden");
  empty.classList.add("hidden");
  list.__retainPdfRecentJobSelect = onSelect;
  list.__retainPdfRecentJobDelete = onDelete;
  bindRecentJobsListEvents(list);
  list.innerHTML = reset ? markup : `${list.innerHTML}${markup}`;
  loadMoreButton.classList.toggle("hidden", !hasMore);
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function setRecentJobsLoadMoreLoading() {
  const component = recentJobsDialogComponent();
  if (component?.setLoadMoreLoading) {
    component.setLoadMoreLoading();
    return;
  }
  const loadMoreButton = $("load-more-jobs-btn");
  if (!loadMoreButton) {
    return;
  }
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "加载中…";
}
