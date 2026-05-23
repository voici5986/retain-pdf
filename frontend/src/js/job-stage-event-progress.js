import { firstNumber } from "./job-stage-presentation-utils.js";

export function progressFromEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const current = firstNumber(
    event?.progress_current,
    event?.progress?.current,
    event?.current,
    payload.progress_current,
    payload.progress?.current,
    payload.render?.progress_current,
    payload.render?.current,
    payload.current,
    payload.current_page,
    payload.page_current,
    payload.currentPage,
    payload.extracted_pages,
    payload.extractedPages,
    payload.rendered_pages,
    payload.renderedPages,
    payload.completed_pages,
    payload.completedPages,
    payload.finished_pages,
    payload.finishedPages,
    payload.pages_done,
    payload.pagesDone,
    payload.page_number,
    payload.page,
  );
  const total = firstNumber(
    event?.progress_total,
    event?.progress?.total,
    event?.total,
    payload.progress_total,
    payload.progress?.total,
    payload.render?.progress_total,
    payload.render?.total,
    payload.total,
    payload.total_pages,
    payload.totalPages,
    payload.page_total,
    payload.pageTotal,
    payload.num_pages,
    payload.numPages,
    payload.page_count,
    payload.pages,
  );
  return { current, total };
}

export function progressPercentFromEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  return firstNumber(
    event?.progress_percent,
    event?.progress?.percent,
    payload.progress_percent,
    payload.progress?.percent,
    payload.render?.progress_percent,
    payload.render?.percent,
    event?.percent,
    payload.percent,
  );
}
