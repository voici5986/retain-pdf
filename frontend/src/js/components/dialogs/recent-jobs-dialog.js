import {
  recentJobsElements,
  renderRecentJobsEmpty,
  renderRecentJobsError,
  renderRecentJobsList,
  renderRecentJobsLoading,
  renderRecentJobsSummary,
  setRecentJobsLoadMoreLoading,
  setRecentJobsOpen,
} from "./recent-jobs-dialog-rendering.js";
import { recentJobsDialogTemplate } from "./recent-jobs-dialog-template.js";

class RecentJobsDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = recentJobsDialogTemplate();
  }

  summaryElement() {
    return recentJobsElements(this).summary;
  }

  listElement() {
    return recentJobsElements(this).list;
  }

  emptyElement() {
    return recentJobsElements(this).empty;
  }

  loadMoreButton() {
    return recentJobsElements(this).loadMoreButton;
  }

  dialogElement() {
    return recentJobsElements(this).dialog;
  }

  setOpen(open) {
    setRecentJobsOpen(this, open);
  }

  bindEvents({ onLoadMore } = {}) {
    this.loadMoreButton()?.addEventListener("click", () => onLoadMore?.());
  }

  renderSummary(text) {
    renderRecentJobsSummary(this, text);
  }

  renderLoading() {
    renderRecentJobsLoading(this);
  }

  renderEmpty(message) {
    renderRecentJobsEmpty(this, message);
  }

  renderError(message, { reset = false } = {}) {
    renderRecentJobsError(this, message, { reset });
  }

  renderList(markup, { reset = false, hasMore = false, onSelect, onDelete } = {}) {
    renderRecentJobsList(this, markup, { reset, hasMore, onSelect, onDelete });
  }

  setLoadMoreLoading() {
    setRecentJobsLoadMoreLoading(this);
  }
}

if (!customElements.get("recent-jobs-dialog")) {
  customElements.define("recent-jobs-dialog", RecentJobsDialog);
}
