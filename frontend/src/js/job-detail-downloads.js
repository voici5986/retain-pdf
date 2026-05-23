import {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "./downloads.js";
import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "./download-feedback.js";
import { $ } from "./dom.js";

export function bindProtectedDownloadLink({
  id,
  fallbackNameFactory,
  detailPageState,
  fetchProtected,
  setText,
}) {
  $(id)?.addEventListener("click", async (event) => {
    const link = event.currentTarget;
    const enabled = link?.getAttribute("aria-disabled") !== "true";
    const url = `${link?.href || ""}`.trim();
    if (!enabled || !url || url.endsWith("#")) {
      event.preventDefault();
      return;
    }
    if (id === "detail-reader-btn") {
      return;
    }
    event.preventDefault();
    const fallbackName = fallbackNameFactory(detailPageState.job?.job_id || "job");
    const downloadTarget = await prepareDownloadTarget(fallbackName);
    if (downloadTarget.kind === "aborted") {
      return;
    }
    try {
      showDownloadPreparing(fallbackName);
      const resp = await fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
      }
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("detail-head-note", `已开始保存 ${filename}`);
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
    } catch (error) {
      setText("detail-head-note", error.message || "下载失败");
      failDownloadToast(error.message || "下载失败");
    }
  });
}
