import {
  MOCK_JOB_ID,
  MOCK_MARKDOWN_CONTENT,
} from "./mock-constants.js";

export function getMockJobMarkdown() {
  return {
    job_id: MOCK_JOB_ID,
    content: MOCK_MARKDOWN_CONTENT,
    raw_url: "mock://markdown.raw",
    raw_path: "mock://markdown.raw",
    images_base_url: "mock://markdown/images/",
    images_base_path: "mock://markdown/images/",
  };
}
