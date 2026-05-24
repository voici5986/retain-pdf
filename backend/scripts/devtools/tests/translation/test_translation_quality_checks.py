import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.services.quality import review_translation_batch
from services.translation.services.quality import review_translation_item
from services.translation.services.terms import GlossaryEntry


def _body_item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source_text,
    }
    item.update(overrides)
    return item


def test_quality_checks_collect_placeholder_and_english_issues() -> None:
    item = _body_item(
        "p001-b001",
        (
            "The self-consistent field procedure computes the molecular orbitals <f1-abc/> before "
            "the final energy is evaluated for the system."
        ),
    )

    report = review_translation_batch(
        [item],
        {
            "p001-b001": {
                "decision": "translate",
                "translated_text": (
                    "The self-consistent field procedure computes the molecular orbitals <f2-def/> before "
                    "the final energy is evaluated for the system."
                ),
            }
        },
    )

    kinds = {issue.kind for issue in report.issues}
    assert report.has_errors
    assert "english_residue" in kinds
    assert "unexpected_placeholder" in kinds
    assert "placeholder_inventory_mismatch" in kinds


def test_quality_checks_collect_glossary_issues() -> None:
    item = _body_item(
        "p002-b003",
        "The SCF cycle is initialized from Hartree-Fock orbitals and then iterated.",
    )

    report = review_translation_item(
        item,
        {
            "decision": "translate",
            "translated_text": "该循环由轨道初始化，然后迭代。",
        },
        glossary_entries=[
            GlossaryEntry(source="SCF", target="自洽场", level="preferred"),
            GlossaryEntry(source="Hartree-Fock", target="Hartree-Fock", level="preserve", match_mode="case_insensitive"),
        ],
    )

    glossary_issues = [issue for issue in report.issues if issue.kind == "glossary_term_missing"]
    assert [issue.details["source"] for issue in glossary_issues] == ["Hartree-Fock", "SCF"]


def test_quality_allows_fast_path_short_non_body_empty_translation() -> None:
    item = {
        "item_id": "p004-b002",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "caption",
        "semantic_role": "metadata",
        "raw_block_type": "figure_title",
        "normalized_sub_type": "figure_caption",
        "policy_translate": True,
        "translation_unit_protected_source_text": "A",
    }

    report = review_translation_item(
        item,
        {
            "decision": "keep_origin",
            "translated_text": "",
            "final_status": "kept_origin",
            "translation_diagnostics": {
                "route_path": ["block_level", "fast_path_keep_origin"],
                "fallback_to": "keep_origin",
                "degradation_reason": "short_non_body_label",
                "final_status": "kept_origin",
            },
        },
    )

    assert not report.has_errors
    assert report.issues == []


def test_quality_still_blocks_body_empty_translation() -> None:
    item = _body_item(
        "p002-b005",
        "To enhance ROS generation, various strategies have been developed to mitigate hypoxia.",
    )

    report = review_translation_item(
        item,
        {
            "decision": "translate",
            "translated_text": "",
        },
    )

    assert report.has_errors
    assert [issue.kind for issue in report.issues] == ["empty_translation"]
