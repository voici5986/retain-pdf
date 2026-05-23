import { buildApiHeaders, isMockMode } from "../config.js";
import { unwrapEnvelope } from "../job.js";
import { getMockJobEvents } from "../mock.js";
import { buildJobDetailEndpoint } from "./http.js";

export async function fetchJobEvents(jobId, apiPrefix, limit = 50, offset = 0) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const payload = getMockJobEvents();
    return { ...payload, limit, offset };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/events?limit=${limit}&offset=${offset}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [], limit, offset };
    }
    throw new Error(`读取事件流失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
