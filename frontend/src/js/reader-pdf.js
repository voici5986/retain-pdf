import { $ } from "./dom.js";
import {
  loadPdfDocument,
  resolveReaderArtifactUrl,
} from "./reader-pdf-document.js";
import {
  bindReaderRegionHover,
  scheduleRegionOverlayRender,
} from "./reader-region-interactions.js";
import { bindPrimaryViewer } from "./reader-primary-viewer.js";
import {
  mountManualPages,
  scheduleVisibleManualPages,
} from "./reader-pdf-renderer.js";
import {
  applyViewerScale,
  schedulePageRowSync as scheduleReaderPageRowSync,
  scheduleScaleRefresh as scheduleReaderScaleRefresh,
} from "./reader-pdf-layout.js";
import {
  showReaderPaneEmpty,
  showReaderPaneReady,
} from "./reader-view.js";

const viewerControllers = new Map();

export { resolveReaderArtifactUrl };

function getViewerController(key) {
  return viewerControllers.get(key) || null;
}

function renderCallbacks() {
  return {
    onPageRendered: () => {
      schedulePageRowSync();
      scheduleRegionOverlayRender();
    },
    onScaleChanged: () => schedulePageRowSync(),
    onScaleRefresh: () => schedulePageRowSync(),
  };
}

function schedulePageRowSync() {
  scheduleReaderPageRowSync(viewerControllers);
}

export function scheduleScaleRefresh() {
  scheduleReaderScaleRefresh(viewerControllers, renderCallbacks());
}

export { bindPrimaryViewer };

function createViewerController(key) {
  const scrollShell = $("reader-scroll-shell");
  const viewerHost = $(`${key}-viewer-host`);
  const viewerElement = $(`${key}-viewer`);
  if (!scrollShell || !viewerHost || !viewerElement) {
    return null;
  }

  const controller = {
    key,
    scrollShell,
    viewerHost,
    viewerElement,
    basePageWidth: 0,
    currentScale: 0,
    pdfDocument: null,
    pageViewports: new Map(),
    renderedPages: new Set(),
    renderTasks: new Map(),
    visiblePages: new Set(),
    pageObserver: null,
    primaryScrollHandler: null,
  };
  viewerControllers.set(key, controller);
  return controller;
}

export async function mountPdfViewer({
  key,
  itemOrUrl,
  label,
  emptyId,
}) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  void label;
  const pdfDocument = await loadPdfDocument({ itemOrUrl });
  if (!pdfDocument) {
    showReaderPaneEmpty(key, emptyId);
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  controller.basePageWidth = firstViewport.width;
  mountManualPages(controller, pdfDocument, firstViewport, renderCallbacks());
  applyViewerScale(controller, renderCallbacks());
  controller.visiblePages.add(1);
  if (pdfDocument.numPages > 1) {
    controller.visiblePages.add(2);
  }
  scheduleVisibleManualPages(controller, renderCallbacks());

  showReaderPaneReady(key, emptyId);

  return {
    key,
    pagesCount: pdfDocument.numPages,
    controller,
  };
}

export function bindResizeRefresh() {
  window.addEventListener("resize", scheduleScaleRefresh);
}

export { bindReaderRegionHover };
