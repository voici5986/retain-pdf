import { pageNumberOfElement } from "./reader-page-geometry.js";

export function bindPrimaryViewer(controller, onPageChange) {
  if (!controller) {
    return;
  }
  if (controller.primaryScrollHandler) {
    controller.scrollShell.removeEventListener("scroll", controller.primaryScrollHandler);
  }
  let ticking = false;
  controller.primaryScrollHandler = () => {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      const containerRect = controller.scrollShell.getBoundingClientRect();
      const focusY = containerRect.top + Math.min(containerRect.height * 0.35, 320);
      let bestPage = 1;
      let bestDistance = Number.POSITIVE_INFINITY;
      controller.viewerElement.querySelectorAll(".page[data-page-number]").forEach((pageElement) => {
        const rect = pageElement.getBoundingClientRect();
        const pageFocus = rect.top + Math.min(rect.height * 0.35, 320);
        const distance = Math.abs(pageFocus - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPage = pageNumberOfElement(pageElement) || bestPage;
        }
      });
      onPageChange?.(bestPage);
    });
  };
  controller.scrollShell.addEventListener("scroll", controller.primaryScrollHandler, { passive: true });
  controller.primaryScrollHandler();
}
