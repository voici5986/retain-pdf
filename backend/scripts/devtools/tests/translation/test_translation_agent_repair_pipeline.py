import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.services.agents import TranslationAgentCoordinator
from services.translation.services.agents import TranslationAgentRuntime
from services.translation.services.agents import run_agent_repair_pipeline


def _item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "translation_unit_protected_source_text": source_text,
        "should_translate": True,
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
        "metadata": {"structure_role": "body"},
    }
    item.update(overrides)
    return item


def test_agent_repair_pipeline_repairs_english_residue_and_applies_result() -> None:
    payload = [
        _item(
            "p001-b001",
            (
                "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                "before the final energy is evaluated for the system."
            ),
            protected_map=[{"token_tag": "<f1-abc/>", "restore_text": "$E$"}],
            translation_unit_protected_map=[{"token_tag": "<f1-abc/>", "restore_text": "$E$"}],
        )
    ]
    translated_results = {
            "p001-b001": {
                "decision": "translate",
                "translated_text": (
                    "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                    "before the final energy is evaluated for the system."
                ),
            }
        }

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "自洽场循环保留 <f1-abc/> 于最终能量计算中。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.as_dict() == {
        "reviewed_items": 1,
        "candidate_items": 1,
        "repaired_items": 1,
        "skipped_items": 0,
        "failed_items": 0,
    }
    assert payload[0]["protected_translated_text"] == "自洽场循环保留 <f1-abc/> 于最终能量计算中。"
    assert payload[0]["translated_text"] == "自洽场循环保留 $E$ 于最终能量计算中。"
    assert payload[0]["translation_diagnostics"]["agent_repaired"] is True
    assert payload[0]["translation_diagnostics"]["applied_issue_kinds"] == ["english_residue"]


def test_agent_repair_pipeline_skips_placeholder_blocking_issues() -> None:
    payload = [
        _item(
            "p001-b002",
            "The final energy <f1-abc/> is reported.",
        )
    ]
    translated_results = {
        "p001-b002": {
            "decision": "translate",
            "translated_text": "最终能量 <f9-bad/> 被报告。",
        }
    }

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=lambda *_args, **_kwargs: "{}"),
    )

    assert summary.candidate_items == 0
    assert summary.repaired_items == 0
    assert summary.skipped_items == 1
    assert payload[0]["translation_diagnostics"]["agent_repair_skipped"] is True
    assert payload[0]["translation_diagnostics"]["agent_repair_skip_reason"] == "blocking_quality_issue"
