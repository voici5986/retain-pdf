export function bindStageRetryEvents(component) {
  component.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".status-stage-retry-btn");
    const stage = button?.dataset?.retryStage || "";
    if (!stage || button.disabled) {
      return;
    }
    component.dispatchEvent(new CustomEvent("retainpdf:retry-stage", {
      bubbles: true,
      composed: true,
      detail: { stage },
    }));
  });
}

export function renderStageRetryAction(component, selected, action) {
  const container = component.querySelector("#status-stage-retry");
  if (!container) {
    return;
  }
  if (!["ocr", "translate", "render"].includes(selected) || !action) {
    container.classList.add("hidden");
    container.replaceChildren();
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "status-stage-retry-btn";
  button.dataset.retryStage = action.stage || (selected === "translate" ? "translation" : selected);
  button.disabled = !action.canRetry;
  button.textContent = action.label || "重新执行";
  if (action.disabledReason) {
    button.title = action.disabledReason;
  }
  container.replaceChildren(button);
  container.classList.remove("hidden");
}
