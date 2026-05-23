import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "./constants.js";
import { normalizeOcrProvider } from "./provider-config.js";

export let runtimeConfig = { ...(window.__FRONT_RUNTIME_CONFIG__ || {}) };

const API_V1_SUFFIX = "/api/v1";

export function isFileProtocol() {
  return window.location.protocol === "file:";
}

export function buildFrontendPageUrl(relativePath, params = {}) {
  const url = new URL(relativePath, window.location.href);
  for (const [key, value] of Object.entries(params || {})) {
    const normalized = `${value ?? ""}`.trim();
    if (!normalized) {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, normalized);
  }
  return url.toString();
}

export function readerMessageTargetOrigin() {
  return isFileProtocol() ? "*" : window.location.origin;
}

export function isTrustedWindowMessage(event, expectedSource = null) {
  if (expectedSource && event.source !== expectedSource) {
    return false;
  }
  if (isFileProtocol()) {
    return event.origin === "null" || !event.origin;
  }
  return event.origin === window.location.origin;
}

export function apiBase() {
  if (typeof runtimeConfig.apiBase === "string" && runtimeConfig.apiBase.trim()) {
    return runtimeConfig.apiBase.trim().replace(/\/+$/, "").replace(new RegExp(`${API_V1_SUFFIX}$`), "");
  }
  if (!isFileProtocol() && window.location.protocol === "https:") {
    return window.location.origin;
  }
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:41000`;
}

export function buildApiUrl(apiPrefix = "", relativePath = "") {
  const normalizedPrefix = `${apiPrefix || ""}`.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const normalizedPath = `${relativePath || ""}`.trim().replace(/^\/+/, "");
  const segments = [apiBase(), normalizedPrefix].filter(Boolean);
  if (normalizedPath) {
    segments.push(normalizedPath);
  }
  return segments.join("/");
}

export function mockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  return ["queued", "running", "succeeded", "failed", "upload", "ocr", "translate", "render", "done"].includes(value) ? value : "";
}

export function isMockMode() {
  return !!mockScenario();
}

export function frontendApiKey() {
  return typeof runtimeConfig.xApiKey === "string" ? runtimeConfig.xApiKey.trim() : "";
}

export function buildApiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const apiKey = frontendApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

export function defaultMineruToken() {
  return typeof runtimeConfig.mineruToken === "string" ? runtimeConfig.mineruToken : "";
}

export function defaultPaddleToken() {
  return typeof runtimeConfig.paddleToken === "string" ? runtimeConfig.paddleToken : "";
}

export function defaultPaddleApiUrl() {
  return typeof runtimeConfig.paddleApiUrl === "string" ? runtimeConfig.paddleApiUrl.trim() : "";
}

export function defaultOcrProvider() {
  return normalizeOcrProvider(runtimeConfig.ocrProvider);
}

export function defaultModelApiKey() {
  return typeof runtimeConfig.modelApiKey === "string" ? runtimeConfig.modelApiKey : "";
}

export function defaultModelName() {
  return typeof runtimeConfig.model === "string" && runtimeConfig.model.trim()
    ? runtimeConfig.model.trim()
    : DEFAULT_MODEL;
}

export function defaultModelBaseUrl() {
  return typeof runtimeConfig.baseUrl === "string" && runtimeConfig.baseUrl.trim()
    ? runtimeConfig.baseUrl.trim()
    : DEFAULT_BASE_URL;
}

export function setRuntimeConfig(nextConfig = {}) {
  runtimeConfig = {
    ...runtimeConfig,
    ...nextConfig,
  };
}
