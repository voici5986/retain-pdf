import { resolveJobActions } from "../../job.js";
import {
  firstNonEmptyText,
} from "./formatters.js";
import {
  dialogComponent,
  setRerunButtonDisabled,
} from "./view.js";

function firstJobIdFromPayload(payload) {
  return firstNonEmptyText(
    payload?.job_id,
    payload?.data?.job_id,
    payload?.job?.job_id,
    payload?.job?.id,
    payload?.id,
  );
}

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "";
  }
  if (!plan.can_resume) {
    return plan.reason || "当前任务暂不可从断点恢复。";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
  const bits = [`可从 ${fromStage} 恢复`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`重跑 ${reruns}`);
  }
  return bits.join("，");
}

export function syncRerunAction({
  state,
  statusText = "",
} = {}) {
  const job = state?.currentJobSnapshot || null;
  const actions = job ? resolveJobActions(job) : {};
  const resumePlan = state?.currentJobResumePlan || null;
  const enabled = Boolean(resumePlan?.can_resume || (actions.rerunEnabled && actions.rerun));
  dialogComponent()?.setRerunAction?.({
    enabled,
    status: statusText || (enabled
      ? summarizeResumePlan(resumePlan) || "后端支持从当前任务产物创建恢复任务。"
      : summarizeResumePlan(resumePlan) || "当前任务暂不可从断点恢复。"),
  });
  return actions.rerun || "";
}

export async function rerunCurrentJob({
  state,
  rerunJob,
  setText,
  startPolling,
} = {}) {
  const actionUrl = syncRerunAction({
    state,
    statusText: "正在提交恢复任务...",
  });
  setRerunButtonDisabled(true);
  if (!actionUrl) {
    syncRerunAction({
      state,
      statusText: "当前任务暂不可从断点恢复。",
    });
    return;
  }
  try {
    const payload = await rerunJob(actionUrl);
    const nextJobId = firstJobIdFromPayload(payload);
    if (!nextJobId) {
      syncRerunAction({
        state,
        statusText: "恢复任务已提交，但响应中没有 job_id。",
      });
      return;
    }
    dialogComponent()?.close?.();
    setText?.("error-box", `已创建恢复任务 ${nextJobId}，开始轮询。`);
    startPolling?.(nextJobId);
  } catch (error) {
    syncRerunAction({
      state,
      statusText: error.message || String(error),
    });
  }
}
