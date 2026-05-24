import {
  getRecentJobsState,
  resetRecentJobsPagination,
  setRecentJobsHasMore,
  setRecentJobsItems,
  setRecentJobsOffset,
} from "./state.js";
import {
  bindRecentJobsEvents,
  hasRecentJobsView,
  renderRecentJobsEmpty,
  renderRecentJobsError,
  renderRecentJobsList,
  renderRecentJobsLoading,
  setRecentJobsDialogOpen,
  setRecentJobsLoadMoreLoading,
} from "./view.js";

const RECENT_JOBS_PAGE_SIZE = 10;

function dedupeRecentJobs(items) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const jobId = `${item?.job_id || ""}`.trim();
    if (!jobId || seen.has(jobId)) {
      continue;
    }
    seen.add(jobId);
    result.push(item);
  }
  return result;
}

function isPrimaryRecentJob(item) {
  const workflow = `${item?.workflow || item?.job_type || ""}`.trim();
  const jobId = `${item?.job_id || ""}`.trim();
  if (workflow === "ocr") {
    return false;
  }
  if (jobId.endsWith("-ocr")) {
    return false;
  }
  return true;
}

async function collectRecentJobsPage(fetchJobList, fetchLibraryBookList, apiPrefix, startOffset, pageSize) {
  const fetchLimit = Math.max(pageSize, 20);
  const collected = [];
  let latestInvocationSummary = null;
  let nextOffset = startOffset;
  let hasMore = true;

  while (collected.length < pageSize) {
    const payload = fetchLibraryBookList
      ? await fetchLibraryBookList(apiPrefix, { limit: fetchLimit, offset: nextOffset })
      : await fetchJobList(apiPrefix, { limit: fetchLimit, offset: nextOffset });
    latestInvocationSummary = payload?.invocation_summary || latestInvocationSummary;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    let consumed = 0;
    for (const item of items) {
      consumed += 1;
      if (!isPrimaryRecentJob(item)) {
        continue;
      }
      collected.push(item);
      if (collected.length >= pageSize) {
        break;
      }
    }

    nextOffset += consumed;

    if (!hasMore || collected.length >= pageSize) {
      break;
    }
    if (items.length < fetchLimit) {
      hasMore = false;
      break;
    }
  }

  return {
    collected,
    hasMore,
    latestInvocationSummary,
    nextOffset,
  };
}

export function mountRecentJobsFeature({ fetchJobList, fetchLibraryBookList, deleteLibraryBook, apiPrefix, startPolling }) {
  function renderCurrentRecentJobs({ reset = true, invocationSummary = null } = {}) {
    const { items, hasMore } = getRecentJobsState();
    renderRecentJobsList({
      items,
      allItems: items,
      invocationSummary,
      reset,
      hasMore,
      onSelect: handleSelectRecentJob,
      onDelete: handleDeleteRecentJob,
    });
  }

  function handleSelectRecentJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      renderRecentJobsError("该任务缺少 job_id，无法打开。", { reset: false });
      return;
    }
    closeRecentJobsDialog();
    startPolling(normalizedJobId);
  }

  async function handleDeleteRecentJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId || !deleteLibraryBook) {
      return;
    }
    try {
      await deleteLibraryBook(apiPrefix, normalizedJobId);
    } catch (error) {
      const message = error?.message || String(error);
      if (message.includes("(409)")) {
        await deleteLibraryBook(apiPrefix, normalizedJobId, { force: true });
      } else {
        renderRecentJobsError(message || "删除失败", { reset: false });
        return;
      }
    }
    const rootJobId = normalizedJobId.replace(/-ocr$/, "");
    const nextItems = getRecentJobsState().items.filter((item) => {
      const itemJobId = `${item?.job_id || ""}`.trim();
      return itemJobId !== rootJobId && itemJobId !== `${rootJobId}-ocr`;
    });
    setRecentJobsItems(nextItems);
    if (nextItems.length === 0) {
      renderRecentJobsEmpty("暂无最近任务");
      return;
    }
    renderCurrentRecentJobs({ reset: true });
  }

  async function loadRecentJobs({ reset = false } = {}) {
    if (!hasRecentJobsView()) {
      return;
    }
    if (reset) {
      resetRecentJobsPagination();
      renderRecentJobsLoading();
    } else {
      setRecentJobsLoadMoreLoading();
    }

    try {
      const { offset, items: previousItems } = getRecentJobsState();
      const {
        collected,
        hasMore,
        latestInvocationSummary,
        nextOffset,
      } = await collectRecentJobsPage(
        fetchJobList,
        fetchLibraryBookList,
        apiPrefix,
        reset ? 0 : offset,
        RECENT_JOBS_PAGE_SIZE,
      );

      if (reset && collected.length === 0) {
        setRecentJobsItems([]);
        setRecentJobsHasMore(false);
        renderRecentJobsEmpty("暂无最近任务", latestInvocationSummary);
        return;
      }
      if (!reset && collected.length === 0) {
        setRecentJobsHasMore(false);
        renderRecentJobsError("", { reset: false });
        return;
      }

      const nextItems = dedupeRecentJobs(reset ? collected : [...previousItems, ...collected]);
      setRecentJobsOffset(nextOffset);
      setRecentJobsHasMore(hasMore);
      setRecentJobsItems(nextItems);
      renderRecentJobsList({
        items: nextItems,
        allItems: nextItems,
        invocationSummary: latestInvocationSummary,
        reset,
        hasMore,
        onSelect: handleSelectRecentJob,
        onDelete: handleDeleteRecentJob,
      });
    } catch (err) {
      if (!reset) {
        setRecentJobsHasMore(false);
      }
      renderRecentJobsError(err.message || "读取最近任务失败", { reset });
    }
  }

  function openRecentJobsDialog() {
    loadRecentJobs({ reset: true });
    setRecentJobsDialogOpen(true);
  }

  function closeRecentJobsDialog() {
    setRecentJobsDialogOpen(false);
  }

  bindRecentJobsEvents({
    onOpen: openRecentJobsDialog,
    onLoadMore: () => loadRecentJobs({ reset: false }),
  });

  return {
    openRecentJobsDialog,
    closeRecentJobsDialog,
    loadRecentJobs,
  };
}
