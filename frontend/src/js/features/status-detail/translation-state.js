import {
  renderTranslationEmpty as renderTranslationEmptyView,
  renderTranslationItemDetail as renderTranslationItemDetailView,
  renderTranslationItems as renderTranslationItemsView,
  renderTranslationReplay as renderTranslationReplayView,
  renderTranslationSummary as renderTranslationSummaryView,
} from "./translation-presenter.js";

export function createTranslationState() {
  return {
    jobId: "",
    loaded: false,
    summary: null,
    query: {
      finalStatus: "kept_origin",
      q: "",
      limit: 20,
      offset: 0,
    },
    list: [],
    total: 0,
    selectedItemId: "",
    selectedItem: null,
    replay: null,
  };
}

export function resetTranslationState(translationState, jobId = "") {
  translationState.jobId = jobId;
  translationState.loaded = false;
  translationState.summary = null;
  translationState.list = [];
  translationState.total = 0;
  translationState.selectedItemId = "";
  translationState.selectedItem = null;
  translationState.replay = null;
}

export function renderTranslationEmpty(message) {
  renderTranslationEmptyView(message);
}

export function renderTranslationSummary(translationState) {
  renderTranslationSummaryView(translationState);
}

export function renderTranslationItems(
  translationState,
  { loading = false, emptyText = "没有匹配的翻译 item" } = {},
) {
  renderTranslationItemsView(translationState, { loading, emptyText });
}

export function renderTranslationItemDetail(
  translationState,
  { loading = false, emptyText = "请选择左侧 item" } = {},
) {
  renderTranslationItemDetailView(translationState, { loading, emptyText });
}

export function renderTranslationReplay(translationState) {
  renderTranslationReplayView(translationState);
}
