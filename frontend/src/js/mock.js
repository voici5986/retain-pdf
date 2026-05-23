import { MOCK_JOB_ID } from "./mock-constants.js";
import { buildMockManifest } from "./mock-artifacts.js";
import { buildMockEvents } from "./mock-events.js";
import { buildMockJobPayload } from "./mock-job.js";
import { currentMockScenario } from "./mock-scenario.js";
export { getMockJobMarkdown } from "./mock-markdown.js";
export { fetchMockProtected } from "./mock-responses.js";

export function isMockScenarioEnabled() {
  return !!currentMockScenario();
}

export function getMockScenario() {
  return currentMockScenario();
}

export function getMockJobId() {
  return MOCK_JOB_ID;
}

export function getMockJobPayload(jobId = "") {
  if (jobId && jobId !== MOCK_JOB_ID) {
    throw new Error("未找到该 mock 任务，请检查 job_id 是否正确。");
  }
  return buildMockJobPayload();
}

export function getMockJobEvents() {
  return buildMockEvents();
}

export function getMockJobArtifactsManifest() {
  return buildMockManifest();
}

export function getMockJobList() {
  return {
    items: [buildMockJobPayload()],
    limit: 20,
    offset: 0,
    has_more: false,
  };
}

export function submitMockJob() {
  return buildMockJobPayload();
}

export function submitMockUpload() {
  return {
    upload_id: "mock-upload-id",
    filename: "mock.pdf",
    page_count: 12,
    bytes: 2_621_440,
  };
}
