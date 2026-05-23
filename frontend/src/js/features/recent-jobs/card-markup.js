function recentJobStatusLabel(status) {
  switch (`${status || ""}`.trim()) {
    case "queued":
      return "排队中";
    case "running":
      return "进行中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return status || "-";
  }
}

function truncateRecentJobName(value) {
  const text = `${value || ""}`.trim();
  if (!text) {
    return "-";
  }
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

function recentJobTitle(item) {
  return truncateRecentJobName(item.title || item.display_name || item.source_file_name || item.job_id || "-");
}

function recentJobImageUrl(item) {
  const direct = `${item?.thumbnail_url || item?.cover_url || ""}`.trim();
  if (direct) {
    return direct.replaceAll('"', "&quot;");
  }
  const jobId = `${item?.job_id || ""}`.trim();
  return jobId ? `/api/v1/library/books/${encodeURIComponent(jobId)}/thumbnail` : "";
}

export function buildRecentJobsMarkup(items) {
  return items.map((item) => `
    <article class="recent-job-item" role="button" tabindex="0" data-job-id="${item.job_id || ""}">
      <div class="recent-job-cover-wrap">
        <div class="recent-job-cover" data-image-url="${recentJobImageUrl(item)}">
          <span class="recent-job-cover-fallback">${recentJobTitle(item).slice(0, 1)}</span>
        </div>
        <span class="recent-job-status">${recentJobStatusLabel(item.status)}</span>
        <button type="button" class="recent-job-delete" aria-label="删除任务" title="删除">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 14h10l1-14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="recent-job-delete-popover" role="group" aria-label="确认删除">
          <div>删除这本书？</div>
          <div class="recent-job-delete-actions">
            <button type="button" class="recent-job-delete-cancel">取消</button>
            <button type="button" class="recent-job-delete-confirm">删除</button>
          </div>
        </div>
      </div>
      <div class="recent-job-title-wrap">
        <span class="recent-job-id" title="${(item.title || item.display_name || item.job_id || "-").replaceAll('"', "&quot;")}">${recentJobTitle(item)}</span>
        <span class="recent-job-real-id mono">${item.page_count || "-"} 页 · ${item.updated_at || "-"}</span>
      </div>
    </article>
  `).join("");
}
