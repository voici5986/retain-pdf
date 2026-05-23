import { buildApiHeaders, isMockMode } from "../config.js";
import { unwrapEnvelope } from "../job.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";

export async function fetchJobDiagnostics(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      summary: "mock failure diagnostics",
      detail: "",
      suggestion: "",
      retryable: true,
      resume_available: true,
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/diagnostics`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`读取失败诊断失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchResumePlan(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      can_resume: true,
      from_stage: "render",
      resume_workflow: "render",
      reuses_artifacts: ["translations_dir", "source_pdf"],
      reruns_stages: ["render"],
      reason: "mock resume plan",
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume-plan`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`读取恢复计划失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function resumeJob(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: `mock-resume-${Date.now()}`,
      status: "queued",
    };
  }
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume`, {});
}

export async function fetchJobStageActions(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      stages: [
        { stage: "ocr", label: "重试 OCR", can_retry: false, disabled_reason: "Mock 任务不支持 OCR 重试" },
        { stage: "translation", label: "重试翻译", can_retry: true, disabled_reason: "" },
        { stage: "render", label: "重新渲染", can_retry: true, disabled_reason: "" },
      ],
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/stage-actions`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`读取阶段操作失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function retryJobStage(jobId, apiPrefix, stage, payload = {}) {
  const normalizedStage = `${stage || ""}`.trim();
  if (!normalizedStage) {
    throw new Error("阶段重试失败: 缺少 stage");
  }
  if (isMockMode()) {
    return {
      job_id: `mock-${normalizedStage}-retry-${Date.now()}`,
      source_job_id: jobId,
      status: "queued",
      rerun_from_stage: normalizedStage,
    };
  }
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/retry-stage`, {
    stage: normalizedStage,
    ...payload,
  });
}

export async function rerunJob(actionUrl) {
  if (isMockMode()) {
    void actionUrl;
    return {
      job_id: `mock-rerun-${Date.now()}`,
      status: "queued",
    };
  }
  return submitJson(actionUrl, {});
}
