from __future__ import annotations

from dataclasses import dataclass

from services.translation.core.payload import apply_translated_text_map
from services.translation.services.agents.coordinator import TranslationAgentCoordinator
from services.translation.services.agents.repair import TranslationRepairRequest
from services.translation.services.agents.repair import RepairAgent
from services.translation.services.agents.runtime import TranslationAgentRuntime
from services.translation.services.quality import TranslationQualityIssue
from services.translation.services.quality import TranslationQualityReport


BLOCKING_REPAIR_ISSUE_KINDS = {
    "placeholder_inventory_mismatch",
    "placeholder_order_changed",
    "unexpected_placeholder",
    "math_delimiter_unbalanced",
    "context_bleed",
}


@dataclass(frozen=True)
class AgentRepairPipelineResult:
    reviewed_items: int = 0
    candidate_items: int = 0
    repaired_items: int = 0
    skipped_items: int = 0
    failed_items: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "reviewed_items": self.reviewed_items,
            "candidate_items": self.candidate_items,
            "repaired_items": self.repaired_items,
            "skipped_items": self.skipped_items,
            "failed_items": self.failed_items,
        }


def run_agent_repair_pipeline(
    *,
    payload: list[dict],
    translated_results: dict[str, dict[str, str]],
    coordinator: TranslationAgentCoordinator,
    runtime: TranslationAgentRuntime,
    glossary_entries: list | None = None,
    max_items: int | None = None,
    model: str = "",
    base_url: str = "",
) -> AgentRepairPipelineResult:
    candidates: list[tuple[dict, dict[str, str], list[TranslationQualityIssue]]] = []
    reviewed = 0
    skipped = 0
    for item in payload:
        item_id = str(item.get("item_id", "") or "")
        if not item_id or item_id not in translated_results:
            continue
        translated_result = translated_results.get(item_id, {}) or {}
        review = coordinator.review_batch([item], {item_id: translated_result})
        reviewed += review.reviewed_item_count
        if _has_blocking_issue(review.issues):
            skipped += 1
            _record_agent_repair_skip(item, "blocking_quality_issue", review.issues)
            continue
        issues = _repairable_review_issues(review)
        if not issues:
            continue
        candidates.append((item, translated_result, issues))

    if max_items is not None:
        skipped += max(0, len(candidates) - max(0, max_items))
        candidates = candidates[: max(0, max_items)]

    repaired = 0
    failed = 0
    repaired_results: dict[str, dict[str, object]] = {}
    for item, translated_result, issues in candidates:
        item_id = str(item.get("item_id", "") or "")
        try:
            repair_result = coordinator.run_repair(
                TranslationRepairRequest(
                    item=item,
                    translated_result=translated_result,
                    issues=issues,
                    glossary_entries=glossary_entries,
                ),
                runtime=runtime,
                model=model,
                base_url=base_url,
            )
        except Exception as exc:
            failed += 1
            _record_agent_repair_failure(item, exc)
            continue
        repaired_results[item_id] = {
            "decision": "translate",
            "translated_text": repair_result.repaired_text,
            "final_status": "translated",
            "translation_diagnostics": {
                "agent_repaired": True,
                "agent": "repair",
                "applied_issue_kinds": repair_result.applied_issue_kinds,
                "confidence": repair_result.confidence,
                "needs_manual_review": repair_result.needs_manual_review,
                "notes": repair_result.notes,
            },
        }
        repaired += 1

    if repaired_results:
        apply_translated_text_map(payload, repaired_results)
    return AgentRepairPipelineResult(
        reviewed_items=reviewed,
        candidate_items=len(candidates),
        repaired_items=repaired,
        skipped_items=skipped,
        failed_items=failed,
    )


def _repairable_review_issues(report: TranslationQualityReport) -> list[TranslationQualityIssue]:
    return RepairAgent().repairable_issues(report.issues)


def _has_blocking_issue(issues: list[TranslationQualityIssue]) -> bool:
    return any(issue.kind in BLOCKING_REPAIR_ISSUE_KINDS for issue in issues)


def _record_agent_repair_skip(item: dict, reason: str, issues: list[TranslationQualityIssue]) -> None:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics["agent_repair_skipped"] = True
    diagnostics["agent_repair_skip_reason"] = reason
    diagnostics["agent_repair_issue_kinds"] = [issue.kind for issue in issues]
    item["translation_diagnostics"] = diagnostics


def _record_agent_repair_failure(item: dict, exc: Exception) -> None:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics["agent_repair_failed"] = True
    diagnostics["agent_repair_error_type"] = type(exc).__name__
    diagnostics["agent_repair_error"] = str(exc)
    item["translation_diagnostics"] = diagnostics


__all__ = [
    "AgentRepairPipelineResult",
    "BLOCKING_REPAIR_ISSUE_KINDS",
    "run_agent_repair_pipeline",
]
