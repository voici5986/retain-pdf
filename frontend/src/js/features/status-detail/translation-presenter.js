import {
  boolLabel,
  degradationReasonOf,
  diagnosticsOf,
  errorTypesOf,
  escapeHtml,
  fallbackToOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  normalizeRoutePath,
  pageNumberOf,
  previewText,
  renderField,
  renderTextBlock,
  routePathOf,
  summarizeTranslationFilter,
} from "./formatters.js";
import { dialogComponent } from "./view.js";

export function renderTranslationEmpty(message) {
  const component = dialogComponent();
  component?.renderTranslationSummary({
    hidden: true,
    emptyText: message,
  });
  component?.renderTranslationItems({
    loading: false,
    hasItems: false,
    emptyText: message,
    meta: "-",
  });
  component?.renderTranslationItemDetail({
    loading: false,
    hasItem: false,
    emptyText: "请选择左侧 item",
    meta: "-",
    replayEnabled: false,
  });
  component?.renderTranslationReplay({
    hasResult: false,
    status: "-",
  });
}

export function renderTranslationSummary(translationState) {
  const summary = translationState.summary?.summary || {};
  dialogComponent()?.renderTranslationSummary({
    counts: summary.counts || {},
    finalStatusCounts: summary.final_status_counts || {},
    providerFamily: `${summary.provider_family || ""}`.trim(),
    summaryScopeText: "当前 job 全量统计",
    filterText: summarizeTranslationFilter(translationState.query),
    hidden: false,
  });
}

export function renderTranslationItems(translationState, { loading = false, emptyText = "没有匹配的翻译 item" } = {}) {
  const component = dialogComponent();
  const list = translationState.list || [];
  const offset = Number(translationState.query.offset || 0);
  const limit = Number(translationState.query.limit || 20);
  const total = Number(translationState.total || 0);
  const totalPages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0;
  const currentPage = total > 0 ? Math.floor(offset / Math.max(limit, 1)) + 1 : 0;
  const meta = loading
    ? "读取中..."
    : `共 ${total} 条，本页 ${list.length} 条，offset ${offset}，limit ${limit}`;
  const pageLabel = loading
    ? "读取中..."
    : total > 0
      ? `第 ${currentPage} / ${totalPages} 页`
      : "第 0 / 0 页";
  const markup = list.map((item) => {
    const active = item.item_id === translationState.selectedItemId;
    const routePath = normalizeRoutePath(routePathOf(item));
    const errorTypes = errorTypesOf(item);
    const errorLabel = errorTypes.length ? errorTypes.join(", ") : "-";
    const degradationReason = degradationReasonOf(item) || "-";
    const finalStatus = finalStatusOf(item);
    return `
      <button
        type="button"
        class="translation-item-card${active ? " is-active" : ""}"
        data-translation-item-id="${escapeHtml(item.item_id)}"
      >
        <div class="translation-item-card-top">
          <span class="translation-item-id mono">${escapeHtml(item.item_id || "-")}</span>
          <span class="translation-item-status ${finalStatusClass(finalStatus)}">${escapeHtml(finalStatusLabel(finalStatus))}</span>
        </div>
        <div class="translation-item-card-meta">
          <span class="translation-item-chip">第 ${escapeHtml(pageNumberOf(item))} 页</span>
          <span class="translation-item-chip">${escapeHtml(item.block_type || "-")}</span>
          <span class="translation-item-chip">${escapeHtml(item.classification_label || "-")}</span>
        </div>
        <div class="translation-item-card-route"><strong>route</strong> ${escapeHtml(routePath || "-")}</div>
        <div class="translation-item-card-preview">${escapeHtml(previewText(item.source_preview || item.source_text || ""))}</div>
        <div class="translation-item-card-footer">
          <span><strong>fallback</strong> ${escapeHtml(fallbackToOf(item) || "-")}</span>
          <span><strong>error</strong> ${escapeHtml(errorLabel)}</span>
        </div>
        <div class="translation-item-card-route"><strong>degradation</strong> ${escapeHtml(degradationReason)}</div>
      </button>
    `;
  }).join("");
  component?.renderTranslationItems({
    markup,
    hasItems: list.length > 0,
    emptyText,
    meta,
    loading,
    pageLabel,
    canPrev: offset > 0,
    canNext: offset + list.length < total,
  });
}

export function renderTranslationItemDetail(translationState, { loading = false, emptyText = "请选择左侧 item" } = {}) {
  const component = dialogComponent();
  const payload = translationState.selectedItem;
  if (loading) {
    component?.renderTranslationItemDetail({
      loading: true,
      hasItem: false,
      emptyText,
      meta: "读取中...",
      replayEnabled: false,
    });
    return;
  }
  if (!payload?.item) {
    component?.renderTranslationItemDetail({
      loading: false,
      hasItem: false,
      emptyText,
      meta: "-",
      replayEnabled: false,
    });
    return;
  }
  const item = payload.item || {};
  const diagnostics = diagnosticsOf(item);
  const routePath = normalizeRoutePath(routePathOf(item));
  const pageNumber = pageNumberOf(payload, pageNumberOf(item));
  const finalStatus = finalStatusOf(item) || finalStatusOf(payload) || "-";
  const markup = `
    <div class="detail-info-list translation-detail-grid">
      ${renderField("item_id", payload.item_id || item.item_id || "-")}
      ${renderField("page_number", pageNumber)}
      ${renderField("block_type", item.block_type || "-")}
      ${renderField("math_mode", item.math_mode || "-")}
      ${renderField("classification_label", item.classification_label || "-")}
      ${renderField("should_translate", boolLabel(item.should_translate))}
      ${renderField("skip_reason", item.skip_reason || "-")}
      ${renderField("final_status", finalStatus)}
      ${renderField("route_path", routePath || "-")}
      ${renderField("fallback_to", fallbackToOf(item) || "-")}
      ${renderField("degradation_reason", degradationReasonOf(item) || "-")}
    </div>
    ${renderTextBlock("原文", item.source_text || "")}
    ${renderTextBlock("落盘翻译", item.translated_text || item.translation_unit_translated_text || item.group_translated_text || "")}
    ${renderTextBlock("保护后译文", item.protected_translated_text || item.translation_unit_protected_translated_text || item.group_protected_translated_text || "")}
    ${renderTextBlock("translation_diagnostics", diagnostics || {})}
  `;
  component?.renderTranslationItemDetail({
    loading: false,
    hasItem: true,
    markup,
    meta: `${payload.item_id || item.item_id || "-"} · 第 ${pageNumber} 页`,
    replayEnabled: true,
  });
}

export function renderTranslationReplay(translationState) {
  const replay = translationState.replay;
  if (!replay?.payload) {
    dialogComponent()?.renderTranslationReplay({
      hasResult: false,
      status: "-",
    });
    return;
  }
  const payload = replay.payload || {};
  const markup = `
    <div class="translation-replay-grid">
      ${renderTextBlock("policy_before", payload.policy_before || {})}
      ${renderTextBlock("policy_after", payload.policy_after || {})}
      ${renderTextBlock("replay_result", payload.replay_result || {})}
      ${renderTextBlock("replay_error", payload.replay_error || null)}
    </div>
  `;
  dialogComponent()?.renderTranslationReplay({
    hasResult: true,
    markup,
    status: payload.replay_error ? "重放返回错误" : "重放完成",
  });
}
