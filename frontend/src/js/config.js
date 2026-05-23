import { $ } from "./dom.js";
import {
  apiBase,
  buildApiHeaders,
  buildApiUrl,
  buildFrontendPageUrl,
  defaultMineruToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  defaultOcrProvider,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  frontendApiKey,
  isFileProtocol,
  isMockMode,
  isTrustedWindowMessage,
  mockScenario,
  readerMessageTargetOrigin,
  runtimeConfig,
  setRuntimeConfig,
} from "./config-runtime.js";
import {
  normalizeBrowserStoredConfig,
  normalizeDeveloperStoredConfig,
  readBrowserStoredConfig,
  readDeveloperStoredConfig,
  writeBrowserStoredConfig,
  writeDeveloperStoredConfig,
} from "./config-storage.js";
import {
  desktopInvoke,
  isDesktopMode,
  loadPersistedConfig,
  openDesktopOutputDirectory,
  persistedDesktopSnapshot,
  savePersistedBrowserConfig,
  savePersistedDesktopConfig,
  savePersistedDeveloperConfig,
} from "./config-desktop-persistence.js";
import { DEFAULT_OCR_PROVIDER, normalizeOcrProvider } from "./provider-config.js";

function currentBrowserStoredConfig() {
  return normalizeBrowserStoredConfig({
    ocrProvider: $("ocr_provider")?.value || DEFAULT_OCR_PROVIDER,
    mineruToken: $("mineru_token")?.value || "",
    paddleToken: $("paddle_token")?.value || "",
    modelApiKey: $("api_key")?.value || "",
  });
}

export function loadBrowserStoredConfig() {
  const snapshot = persistedDesktopSnapshot();
  return isDesktopMode() && snapshot
    ? snapshot.browserConfig
    : normalizeBrowserStoredConfig(readBrowserStoredConfig());
}

export function saveBrowserStoredConfig(payload = currentBrowserStoredConfig()) {
  writeBrowserStoredConfig(payload);
}

export async function savePersistedBrowserStoredConfig(payload = currentBrowserStoredConfig()) {
  const nextBrowserConfig = normalizeBrowserStoredConfig(payload);
  saveBrowserStoredConfig(nextBrowserConfig);
  if (!isDesktopMode()) {
    return savePersistedBrowserConfig(nextBrowserConfig);
  }
  return savePersistedBrowserConfig(nextBrowserConfig);
}

export function loadDeveloperStoredConfig() {
  const snapshot = persistedDesktopSnapshot();
  return isDesktopMode() && snapshot
    ? snapshot.developerConfig
    : normalizeDeveloperStoredConfig(readDeveloperStoredConfig());
}

export function saveDeveloperStoredConfig(payload = {}) {
  writeDeveloperStoredConfig(payload);
}

export async function savePersistedDeveloperStoredConfig(payload = {}) {
  const nextDeveloperConfig = normalizeDeveloperStoredConfig(payload);
  saveDeveloperStoredConfig(nextDeveloperConfig);
  if (!isDesktopMode()) {
    return savePersistedDeveloperConfig(nextDeveloperConfig);
  }
  return savePersistedDeveloperConfig(nextDeveloperConfig);
}

export function applyKeyInputs(credentialsOrMineruToken, legacyModelApiKey = "") {
  const credentials = typeof credentialsOrMineruToken === "object" && credentialsOrMineruToken
    ? credentialsOrMineruToken
    : {
        ocrProvider: DEFAULT_OCR_PROVIDER,
        mineruToken: credentialsOrMineruToken,
        paddleToken: "",
        modelApiKey: legacyModelApiKey,
      };
  const ocrProvider = normalizeOcrProvider(credentials.ocrProvider);
  const mineruToken = credentials.mineruToken || "";
  const paddleToken = credentials.paddleToken || "";
  const modelApiKey = credentials.modelApiKey || "";
  $("ocr_provider").value = ocrProvider;
  $("mineru_token").value = mineruToken;
  $("paddle_token").value = paddleToken;
  $("api_key").value = modelApiKey;
}

export {
  apiBase,
  buildApiHeaders,
  buildApiUrl,
  buildFrontendPageUrl,
  defaultMineruToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  defaultOcrProvider,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  frontendApiKey,
  isFileProtocol,
  isDesktopMode,
  isMockMode,
  isTrustedWindowMessage,
  desktopInvoke,
  loadPersistedConfig,
  mockScenario,
  openDesktopOutputDirectory,
  readerMessageTargetOrigin,
  savePersistedDesktopConfig,
  setRuntimeConfig,
};
