import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.workflow import stages


def _item(item_id: str, text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "translation_unit_protected_source_text": text,
        "protected_translated_text": text,
        "translated_text": text,
        "should_translate": True,
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
        "metadata": {"structure_role": "body"},
    }


def test_agent_repair_stage_can_be_disabled_by_env(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "page-001.json"
    payload = [_item("p001-b001", "The self-consistent field procedure computes molecular orbitals.")]
    path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "0")

    summary = stages.run_agent_repair_stage(
        page_payloads={0: payload},
        translation_paths={0: path},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        translation_context=None,
        run_diagnostics=None,
    )

    assert summary["candidate_items"] == 0
    assert json.loads(path.read_text(encoding="utf-8"))[0]["translated_text"] == payload[0]["translated_text"]


def test_agent_repair_stage_runs_limited_repair_and_saves(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "page-001.json"
    payload = [
        _item(
            "p001-b001",
            (
                "The self-consistent field procedure computes the molecular orbitals before "
                "the final energy is evaluated for the system."
            ),
        )
    ]
    path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "1")

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "自洽场过程计算分子轨道，然后评估体系的最终能量。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(stages, "request_chat_content", _fake_request)
    summary = stages.run_agent_repair_stage(
        page_payloads={0: payload},
        translation_paths={0: path},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        translation_context=None,
        run_diagnostics=None,
    )

    saved = json.loads(path.read_text(encoding="utf-8"))
    assert summary["candidate_items"] == 1
    assert summary["repaired_items"] == 1
    assert saved[0]["translated_text"] == "自洽场过程计算分子轨道，然后评估体系的最终能量。"
    assert saved[0]["translation_diagnostics"]["agent_repaired"] is True
