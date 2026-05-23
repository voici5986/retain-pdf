import {
  browserCredentialElements,
  currentCredentialDialogSetupMode,
} from "./view.js";

export function persistBrowserCredentialsFromDialog({
  applyKeyInputs,
  currentOcrProvider,
  saveTaskOptions,
  saveBrowserStoredConfig,
}) {
  const {
    mineruInput,
    paddleInput,
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
    mathModeSelect,
  } = browserCredentialElements();
  applyKeyInputs({
    ocrProvider: currentOcrProvider(),
    mineruToken: mineruInput?.value?.trim() || "",
    paddleToken: paddleInput?.value?.trim() || "",
    modelApiKey: apiKeyInput?.value?.trim() || "",
  });
  saveTaskOptions?.({
    model: modelNameInput?.value?.trim() || "",
    baseUrl: modelBaseUrlInput?.value?.trim() || "",
    mathMode: mathModeSelect?.value || "direct_typst",
    translateTitles: true,
  });
  saveBrowserStoredConfig();
}

export async function persistDesktopCredentialsFromDialog({
  currentOcrProvider,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
}) {
  const {
    mineruInput,
    paddleInput,
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
    mathModeSelect,
  } = browserCredentialElements();
  const provider = currentOcrProvider();
  const mineruToken = mineruInput?.value?.trim() || "";
  const paddleToken = paddleInput?.value?.trim() || "";
  const modelApiKey = apiKeyInput?.value?.trim() || "";
  await saveDesktopConfig?.(
    mineruToken,
    modelApiKey,
    async () => {
      await checkApiConnectivity?.();
    },
    {
      ocrProvider: provider,
      paddleToken,
      markConfigured: currentCredentialDialogSetupMode(),
    },
  );
  saveTaskOptions?.({
    model: modelNameInput?.value?.trim() || "",
    baseUrl: modelBaseUrlInput?.value?.trim() || "",
    mathMode: mathModeSelect?.value || "direct_typst",
    translateTitles: true,
  });
}
