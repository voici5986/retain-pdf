import {
  clearRegionLayers,
  ensureRegionLayer,
  getPageCanvasBoxWithPdfSize,
  pageNumberOfElement,
  placeRegionBox,
  regionRectFromBox,
} from "./reader-page-geometry.js";
import {
  copyTextToClipboard,
  normalizeReaderRegions,
} from "./reader-region-utils.js";
import {
  formatReaderRegionMarkdownPayload,
  renderReaderMarkdownPayload,
  renderReaderMarkdownPopover,
} from "./reader-region-popover.js";

let regionOverlayTicking = false;
let readerRegionBinding = null;
let selectedReaderRegion = null;
let hoveredReaderRegion = null;
const readerRegionItemCache = new Map();

function findTranslatedRegionAtPoint(event) {
  const binding = readerRegionBinding;
  if (!binding?.translatedController || !binding.regions.length) {
    return null;
  }
  const pageElement = event.target?.closest?.(".page[data-page-number]");
  if (!pageElement || !binding.translatedController.viewerElement.contains(pageElement)) {
    return null;
  }
  const pageNumber = pageNumberOfElement(pageElement);
  if (!pageNumber) {
    return null;
  }
  const pageRect = pageElement.getBoundingClientRect();
  const x = event.clientX - pageRect.left;
  const y = event.clientY - pageRect.top;
  const canvasBox = getPageCanvasBoxWithPdfSize(binding.translatedController, pageElement, pageNumber);
  if (!canvasBox) {
    return null;
  }
  for (let index = binding.regions.length - 1; index >= 0; index -= 1) {
    const region = binding.regions[index];
    if (region.translated.page !== pageNumber) {
      continue;
    }
    const rect = regionRectFromBox(region.translated.bbox, canvasBox);
    if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return region;
    }
  }
  return null;
}

function drawRegionBox(controller, regionPart, layerClassName, boxClassName) {
  if (!controller || !regionPart) {
    return;
  }
  const pageElement = controller.viewerElement.querySelector(`.page[data-page-number="${regionPart.page}"]`);
  const canvasBox = getPageCanvasBoxWithPdfSize(controller, pageElement, regionPart.page);
  if (!pageElement || !canvasBox) {
    return;
  }
  const layer = ensureRegionLayer(pageElement, layerClassName);
  const box = document.createElement("div");
  box.className = boxClassName;
  if (placeRegionBox(box, regionPart.bbox, canvasBox)) {
    layer.appendChild(box);
  }
}

function showReaderRegionToast(controller, regionPart, message) {
  if (!controller || !regionPart || !message) {
    return;
  }
  const pageElement = controller.viewerElement.querySelector(`.page[data-page-number="${regionPart.page}"]`);
  const canvasBox = getPageCanvasBoxWithPdfSize(controller, pageElement, regionPart.page);
  if (!pageElement || !canvasBox) {
    return;
  }
  const rect = regionRectFromBox(regionPart.bbox, canvasBox);
  if (!rect) {
    return;
  }
  const layer = ensureRegionLayer(pageElement, "reader-translated-highlight-layer");
  layer.querySelectorAll(".reader-region-copy-toast").forEach((element) => element.remove());
  const toast = document.createElement("div");
  toast.className = "reader-region-copy-toast";
  toast.textContent = message;
  toast.style.left = `${Math.max(canvasBox.left + 8, rect.left + (rect.right - rect.left) / 2)}px`;
  toast.style.top = `${Math.max(canvasBox.top + 8, rect.top + 6)}px`;
  layer.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
  }, 760);
  window.setTimeout(() => {
    toast.remove();
  }, 1100);
}

function clearActiveRegionHighlights() {
  const binding = readerRegionBinding;
  clearRegionLayers(binding?.sourceController, "reader-source-highlight-layer");
  clearRegionLayers(binding?.translatedController, "reader-translated-highlight-layer");
}

function showReaderRegionPair(region) {
  const binding = readerRegionBinding;
  if (!binding || !region) {
    return;
  }
  clearActiveRegionHighlights();
  drawRegionBox(
    binding.sourceController,
    region.source,
    "reader-source-highlight-layer",
    "reader-region-highlight-box",
  );
  drawRegionBox(
    binding.translatedController,
    region.translated,
    "reader-translated-highlight-layer",
    "reader-region-highlight-box",
  );
}

function hideReaderRegionPair() {
  if (selectedReaderRegion) {
    showReaderRegionPair(selectedReaderRegion);
    return;
  }
  clearActiveRegionHighlights();
}

function handleTranslatedRegionMouseMove(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (region?.itemId === hoveredReaderRegion?.itemId) {
    return;
  }
  hoveredReaderRegion = region;
  if (region) {
    showReaderRegionPair(region);
  } else {
    hideReaderRegionPair();
  }
}

function handleTranslatedRegionMouseLeave() {
  hoveredReaderRegion = null;
  hideReaderRegionPair();
}

function selectReaderRegion(region) {
  selectedReaderRegion = selectedReaderRegion?.itemId === region?.itemId ? null : region;
  if (selectedReaderRegion) {
    showReaderRegionPair(selectedReaderRegion);
  } else {
    clearActiveRegionHighlights();
  }
}

function handleTranslatedRegionClick(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (!region) {
    return;
  }
  selectReaderRegion(region);
}

async function fetchReaderRegionPayload(region) {
  if (region?.markdown || region?.source?.text || region?.translated?.text) {
    return region;
  }
  const binding = readerRegionBinding;
  if (!binding?.jobId || !binding?.fetchTranslationItem || !region?.itemId) {
    return null;
  }
  const cacheKey = `${binding.jobId}:${region.itemId}`;
  if (readerRegionItemCache.has(cacheKey)) {
    return readerRegionItemCache.get(cacheKey);
  }
  const request = binding.fetchTranslationItem(binding.jobId, region.itemId, binding.apiPrefix);
  readerRegionItemCache.set(cacheKey, request);
  return request;
}

async function handleTranslatedRegionDoubleClick(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (!region) {
    return;
  }
  event.preventDefault();
  showReaderRegionPair(region);
  try {
    const payload = await fetchReaderRegionPayload(region);
    const formatted = formatReaderRegionMarkdownPayload(payload);
    await copyTextToClipboard(formatted.translated || formatted.primaryText);
    showReaderRegionToast(readerRegionBinding?.translatedController, region.translated, "已复制");
  } catch {
    showReaderRegionToast(readerRegionBinding?.translatedController, region.translated, "复制失败");
    // Keep text selection behavior unaffected if copy is unavailable.
  }
}

async function showReaderRegionMarkdown(event, region) {
  event.preventDefault();
  event.stopPropagation();
  showReaderRegionPair(region);
  const binding = readerRegionBinding;
  if (!binding?.jobId || !binding?.fetchTranslationItem || !region?.itemId) {
    renderReaderMarkdownPopover(event, region, { message: "缺少 item_id，无法读取文本" });
    return;
  }
  const popover = renderReaderMarkdownPopover(event, region, { message: "正在读取..." });
  try {
    const payload = await fetchReaderRegionPayload(region);
    renderReaderMarkdownPayload(popover, payload);
  } catch (error) {
    popover.querySelector(".reader-region-markdown-body").textContent = error?.message || "读取失败";
  }
}

export function scheduleRegionOverlayRender() {
  if (!readerRegionBinding || regionOverlayTicking) {
    return;
  }
  regionOverlayTicking = true;
  window.requestAnimationFrame(() => {
    regionOverlayTicking = false;
    if (hoveredReaderRegion) {
      showReaderRegionPair(hoveredReaderRegion);
    } else if (selectedReaderRegion) {
      showReaderRegionPair(selectedReaderRegion);
    }
  });
}

export function bindReaderRegionHover({
  regions,
  sourceController,
  translatedController,
  jobId = "",
  apiPrefix = "",
  fetchTranslationItem = null,
} = {}) {
  const normalizedRegions = normalizeReaderRegions(regions);
  if (!normalizedRegions.length || !sourceController || !translatedController) {
    return;
  }
  readerRegionBinding = {
    regions: normalizedRegions,
    sourceController,
    translatedController,
    jobId,
    apiPrefix,
    fetchTranslationItem,
  };
  selectedReaderRegion = null;
  hoveredReaderRegion = null;
  if (translatedController.viewerElement.dataset.readerRegionHitTestBound !== "1") {
    translatedController.viewerElement.dataset.readerRegionHitTestBound = "1";
    translatedController.viewerElement.addEventListener("mousemove", handleTranslatedRegionMouseMove);
    translatedController.viewerElement.addEventListener("mouseleave", handleTranslatedRegionMouseLeave);
    translatedController.viewerElement.addEventListener("click", handleTranslatedRegionClick);
    translatedController.viewerElement.addEventListener("dblclick", handleTranslatedRegionDoubleClick);
    translatedController.viewerElement.addEventListener("contextmenu", (event) => {
      const region = findTranslatedRegionAtPoint(event);
      if (region) {
        showReaderRegionMarkdown(event, region);
      }
    });
  }
  scheduleRegionOverlayRender();
}
