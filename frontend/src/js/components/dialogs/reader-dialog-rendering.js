const READER_FRAME_PLACEHOLDER = "<style>html,body{margin:0;min-height:100%;background:#f3f4f6;color:#1d1d1f}</style>";

export function readerDialogElements(host) {
  return {
    dialog: host.querySelector("#reader-dialog"),
    frame: host.querySelector("#reader-dialog-frame"),
    loading: host.querySelector("#reader-dialog-loading"),
    loadingText: host.querySelector("#reader-dialog-loading-text"),
    loadingPercent: host.querySelector("#reader-dialog-loading-percent"),
    loadingBar: host.querySelector("#reader-dialog-loading-bar"),
  };
}

export function setReaderDialogLoadingVisible(host, loading) {
  readerDialogElements(host).loading?.classList.toggle("hidden", !loading);
}

export function setReaderDialogLoadingProgress(host, {
  text = "正在准备对照阅读...",
  percent = 0,
  widthPercent = null,
} = {}) {
  const { loadingText, loadingPercent, loadingBar } = readerDialogElements(host);
  const hasWidthPercent = widthPercent !== null && widthPercent !== undefined;
  const safePercent = Math.max(0, Math.min(100, Number(hasWidthPercent ? widthPercent : percent) || 0));
  if (loadingText) {
    loadingText.textContent = text;
  }
  if (loadingPercent) {
    loadingPercent.textContent = `${safePercent.toFixed(0)}%`;
  }
  if (loadingBar) {
    loadingBar.style.width = `${safePercent}%`;
  }
}

export function setReaderDialogToolbarButtonState(host, id, { enabled = false, url = "" } = {}) {
  const button = host.querySelector(`#${id}`);
  if (!button) {
    return;
  }
  button.disabled = !enabled;
  button.dataset.url = enabled ? url : "";
  button.setAttribute("aria-disabled", enabled ? "false" : "true");
}

export function getReaderDialogToolbarButtonUrl(host, id) {
  return `${host.querySelector(`#${id}`)?.dataset?.url || ""}`.trim();
}

export function setReaderDialogButtonBusy(host, id, busy, label = "生成中…") {
  const button = host.querySelector(`#${id}`);
  if (!button) {
    return "";
  }
  const previousMarkup = button.innerHTML;
  if (!button.dataset.defaultMarkup) {
    button.dataset.defaultMarkup = previousMarkup;
  }
  if (busy) {
    button.disabled = true;
    button.innerHTML = `<span>${label}</span>`;
  } else {
    button.innerHTML = button.dataset.defaultMarkup || previousMarkup;
  }
  return previousMarkup;
}

export function restoreReaderDialogButton(host, id, markup) {
  const button = host.querySelector(`#${id}`);
  if (button && typeof markup === "string") {
    button.innerHTML = markup;
  }
}

export function setReaderDialogFrameSource(host, url = "about:blank") {
  const { frame } = readerDialogElements(host);
  if (frame) {
    const normalizedUrl = `${url || ""}`.trim();
    if (!normalizedUrl || normalizedUrl === "about:blank") {
      frame.removeAttribute("src");
      frame.setAttribute("srcdoc", READER_FRAME_PLACEHOLDER);
      return;
    }
    frame.removeAttribute("srcdoc");
    frame.src = normalizedUrl;
  }
}

export function openReaderDialog(host) {
  readerDialogElements(host).dialog?.showModal();
}

export function closeReaderDialog(host) {
  readerDialogElements(host).dialog?.close();
}
