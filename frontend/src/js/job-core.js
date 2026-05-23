export function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function objectOrNull(value) {
  return value && typeof value === "object" ? value : null;
}

export function unwrapEnvelope(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "code" in payload) {
    if (payload.code !== 0) {
      throw new Error(payload.message || `API returned code ${payload.code}`);
    }
    return payload.data;
  }
  return payload;
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}
