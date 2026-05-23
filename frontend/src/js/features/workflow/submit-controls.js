export function resolveSubmitControlState({
  workflow,
  isMock,
  desktopMode,
  uploadId,
  renderSourceJobId,
  hasBrowserCredentials,
  workflowNeedsUpload,
  workflowNeedsCredentials,
  workflowSubmitLabel,
}) {
  const showPageRangeButton = workflowNeedsUpload(workflow);
  if (isMock) {
    return {
      disabled: false,
      label: workflowSubmitLabel(workflow),
      actionVisible: true,
      pageRangeVisible: showPageRangeButton,
    };
  }
  const needsUpload = workflowNeedsUpload(workflow);
  const needsCredentials = workflowNeedsCredentials(workflow);
  const credentialsMissing = !desktopMode
    && needsCredentials
    && !hasBrowserCredentials;
  const renderReady = Boolean(renderSourceJobId);
  const uploadReady = Boolean(uploadId);
  const canSubmit = needsUpload ? uploadReady : renderReady;
  return {
    disabled: credentialsMissing || !canSubmit,
    label: workflowSubmitLabel(workflow),
    actionVisible: !(credentialsMissing || (needsUpload ? !uploadReady : false)),
    pageRangeVisible: showPageRangeButton,
  };
}
