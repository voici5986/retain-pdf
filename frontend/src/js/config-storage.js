import {
  BROWSER_CONFIG_STORAGE_KEY,
  DEVELOPER_CONFIG_STORAGE_KEY,
} from "./constants.js";
import { normalizeOcrProvider } from "./provider-config.js";

export function isObject(value) {
  return typeof value === "object" && value !== null;
}

export function readStoredConfig(key) {
  if (typeof window.localStorage === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch (_err) {
    return {};
  }
}

export function writeStoredConfig(key, payload = {}) {
  if (typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (_err) {
    // Ignore storage quota / privacy mode failures.
  }
}

export function normalizeBrowserStoredConfig(payload = {}) {
  const source = isObject(payload) ? payload : {};
  return {
    ocrProvider: normalizeOcrProvider(source.ocrProvider),
    mineruToken: typeof source.mineruToken === "string" ? source.mineruToken : "",
    paddleToken: typeof source.paddleToken === "string" ? source.paddleToken : "",
    modelApiKey: typeof source.modelApiKey === "string" ? source.modelApiKey : "",
  };
}

export function normalizeDeveloperStoredConfig(payload = {}) {
  return isObject(payload) ? { ...payload } : {};
}

export function desktopRuntimeToBrowserConfig(runtime = {}) {
  const source = isObject(runtime) ? runtime : {};
  return normalizeBrowserStoredConfig({
    ocrProvider: source.ocrProvider,
    mineruToken: source.mineruToken,
    paddleToken: source.paddleToken,
    modelApiKey: source.modelApiKey,
  });
}

export function buildRuntimeConfig(browserConfig = {}, developerConfig = {}, baseRuntimeConfig = {}) {
  const nextBrowserConfig = normalizeBrowserStoredConfig(browserConfig);
  const nextDeveloperConfig = normalizeDeveloperStoredConfig(developerConfig);
  const nextRuntimeConfig = {
    ...(isObject(baseRuntimeConfig) ? baseRuntimeConfig : {}),
    ocrProvider: nextBrowserConfig.ocrProvider,
    mineruToken: nextBrowserConfig.mineruToken,
    paddleToken: nextBrowserConfig.paddleToken,
    modelApiKey: nextBrowserConfig.modelApiKey,
    developerConfig: nextDeveloperConfig,
  };
  if (typeof nextDeveloperConfig.model === "string" && nextDeveloperConfig.model.trim()) {
    nextRuntimeConfig.model = nextDeveloperConfig.model.trim();
  }
  if (typeof nextDeveloperConfig.baseUrl === "string" && nextDeveloperConfig.baseUrl.trim()) {
    nextRuntimeConfig.baseUrl = nextDeveloperConfig.baseUrl.trim();
  }
  return nextRuntimeConfig;
}

export function readBrowserStoredConfig() {
  return readStoredConfig(BROWSER_CONFIG_STORAGE_KEY);
}

export function writeBrowserStoredConfig(payload = {}) {
  writeStoredConfig(BROWSER_CONFIG_STORAGE_KEY, normalizeBrowserStoredConfig(payload));
}

export function readDeveloperStoredConfig() {
  return readStoredConfig(DEVELOPER_CONFIG_STORAGE_KEY);
}

export function writeDeveloperStoredConfig(payload = {}) {
  writeStoredConfig(DEVELOPER_CONFIG_STORAGE_KEY, normalizeDeveloperStoredConfig(payload));
}
