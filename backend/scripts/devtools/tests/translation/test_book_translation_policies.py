import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.workflow.page_policies import finalize_page_payloads
from services.translation.services.continuation.orchestrator import review_candidate_continuation_pairs
from services.translation.services.continuation.orchestrator import annotate_layout_zones_by_page
from services.translation.services.policy.flow import apply_translation_policies
from services.translation.services.policy.config import build_translation_policy_config
from services.translation.services.policy.payload_rules.legacy_policy_mutations import apply_mixed_literal_split_policy
from services.translation.services.policy.payload_rules.legacy_policy_mutations import apply_cjk_source_keep_origin
from services.translation.services.policy.payload_rules.policy_mutations import apply_title_skip
from services.translation.services.context import TranslationDocumentContext
from services.translation.services.policy.planner import TranslationPlanner


def _page_payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    group_id: str,
    order: int,
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "",
        "bbox": bbox,
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "classification_label": "",
        "should_translate": True,
        "ocr_continuation_source": "provider",
        "ocr_continuation_group_id": group_id,
        "ocr_continuation_role": "head" if order == 0 else "tail",
        "ocr_continuation_scope": "cross_page",
        "ocr_continuation_reading_order": order,
        "layout_mode": "",
        "layout_split_x": 0.0,
        "layout_zone": "",
        "layout_zone_rank": -1,
        "layout_zone_size": 0,
        "layout_boundary_role": "",
        "continuation_group": "",
        "continuation_prev_text": "",
        "continuation_next_text": "",
        "continuation_decision": "",
        "continuation_candidate_prev_id": "",
        "continuation_candidate_next_id": "",
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
    }


def test_provider_double_column_hints_win_over_full_width_blocks() -> None:
    page_payloads = {
        0: [
            _page_payload_item(
                item_id="p001-title",
                page_idx=0,
                text="A full width article title",
                bbox=[56, 117, 561, 172],
                group_id="",
                order=0,
            ),
            _page_payload_item(
                item_id="p001-left-a",
                page_idx=0,
                text="Left column abstract body.",
                bbox=[66, 258, 310, 379],
                group_id="",
                order=1,
            ),
            _page_payload_item(
                item_id="p001-full-abstract",
                page_idx=0,
                text="A full width abstract continuation.",
                bbox=[66, 379, 558, 469],
                group_id="",
                order=2,
            ),
            _page_payload_item(
                item_id="p001-left-b",
                page_idx=0,
                text="Left column introduction tail.",
                bbox=[56, 655, 303, 758],
                group_id="",
                order=3,
            ),
            _page_payload_item(
                item_id="p001-right-a",
                page_idx=0,
                text="Right column introduction head.",
                bbox=[320, 491, 566, 548],
                group_id="",
                order=4,
            ),
            _page_payload_item(
                item_id="p001-right-b",
                page_idx=0,
                text="Right column following body.",
                bbox=[320, 548, 567, 723],
                group_id="",
                order=5,
            ),
        ],
    }
    provider_guesses = {
        "p001-title": "full",
        "p001-left-a": "left",
        "p001-full-abstract": "full",
        "p001-left-b": "left",
        "p001-right-a": "right",
        "p001-right-b": "right",
    }
    for item in page_payloads[0]:
        item["provider_column_layout_mode"] = "double"
        item["provider_column_index_guess"] = provider_guesses[item["item_id"]]

    annotate_layout_zones_by_page(page_payloads)

    zones = {item["item_id"]: item["layout_zone"] for item in page_payloads[0]}
    assert {item["layout_mode"] for item in page_payloads[0]} == {"double"}
    assert zones["p001-title"] == "full_width"
    assert zones["p001-full-abstract"] == "full_width"
    assert zones["p001-left-a"] == "left_column"
    assert zones["p001-left-b"] == "left_column"
    assert zones["p001-right-a"] == "right_column"
    assert zones["p001-right-b"] == "right_column"


def test_finalize_page_payloads_annotates_layout_before_cross_page_provider_join() -> None:
    group_id = "provider-generic-global-1"
    page_payloads = {
        0: [
            _page_payload_item(
                item_id="p001-b000",
                page_idx=0,
                text="This sentence continues with enough context",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=0,
            )
        ],
        1: [
            _page_payload_item(
                item_id="p002-b000",
                page_idx=1,
                text="and additional evidence from the next page.",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=1,
            )
        ],
    }

    with tempfile.TemporaryDirectory() as tmp:
        translation_paths = {
            0: Path(tmp) / "page-001.json",
            1: Path(tmp) / "page-002.json",
        }
        summary = finalize_page_payloads(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )

    assert summary["provider_joined_items"] == 2
    assert page_payloads[0][0]["layout_zone"] == "single_column"
    assert page_payloads[1][0]["layout_zone"] == "single_column"
    assert page_payloads[0][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[1][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[0][0]["continuation_group"] == group_id


def test_translation_planner_reuses_page_context_for_no_trans_classification() -> None:
    captured = {}

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        return "no-trans: 1"

    payload = [
        {
            "item_id": "p008-b003",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "bbox": [10, 20, 300, 80],
            "source_text": "$ source deeph/bin/activate",
            "protected_source_text": "$ source deeph/bin/activate",
            "formula_map": [],
            "lines": [{"spans": [{"content": "$ source deeph/bin/activate"}]}],
            "metadata": {"structure_role": "body"},
        }
    ]

    labels = TranslationPlanner(
        TranslationDocumentContext(mode="sci", rule_guidance="technical manual")
    ).classify_no_trans(
        payload,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        batch_size=8,
        request_label="classification page 8",
        request_chat_content_fn=_fake_request,
    )

    assert labels == {"p008-b003": "code"}
    assert "technical manual" in captured["messages"][0]["content"]
    assert "$ source deeph/bin/activate" in captured["messages"][1]["content"]


def test_finalize_page_payloads_does_not_join_figure_caption_with_body_text() -> None:
    page_payloads = {
        2: [
            {
                "item_id": "p003-b008",
                "page_idx": 2,
                "block_idx": 8,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [60, 240, 270, 360],
                "source_text": "This is a body paragraph that ends with the",
                "protected_source_text": "This is a body paragraph that ends with the",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_split_x": 300.0,
                "layout_zone": "",
                "layout_zone_rank": -1,
                "layout_zone_size": 0,
                "layout_boundary_role": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": "p003-b008",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": ["p003-b008"],
                "translation_unit_protected_source_text": "This is a body paragraph that ends with the",
                "translation_unit_formula_map": [],
            },
            {
                "item_id": "p003-b010",
                "page_idx": 2,
                "block_idx": 10,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "caption",
                "semantic_role": "caption",
                "structure_role": "figure_caption",
                "policy_translate": True,
                "raw_block_type": "figure_title",
                "normalized_sub_type": "figure_caption",
                "bbox": [330, 240, 550, 300],
                "source_text": "FIG. 3. Final electronic structure spectrum.",
                "protected_source_text": "FIG. 3. Final electronic structure spectrum.",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_split_x": 300.0,
                "layout_zone": "",
                "layout_zone_rank": -1,
                "layout_zone_size": 0,
                "layout_boundary_role": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": "p003-b010",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": ["p003-b010"],
                "translation_unit_protected_source_text": "FIG. 3. Final electronic structure spectrum.",
                "translation_unit_formula_map": [],
            },
        ],
    }

    with tempfile.TemporaryDirectory() as tmp:
        translation_paths = {2: Path(tmp) / "page-003.json"}
        summary = finalize_page_payloads(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )

    body, caption = page_payloads[2]
    assert summary["joined_items"] == 0
    assert body["continuation_group"] == ""
    assert body["continuation_candidate_next_id"] == ""
    assert caption["continuation_group"] == ""
    assert caption["continuation_candidate_prev_id"] == ""
    assert caption["translation_unit_id"] == "p003-b010"


def test_continuation_review_uses_default_wide_batches(monkeypatch) -> None:
    page_payloads = {0: []}
    for index in range(14):
        page_payloads[0].append(
            {
                "item_id": f"p001-b{index:03d}",
                "page_idx": 0,
                "block_idx": index,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [0, index * 20, 200, index * 20 + 12],
                "source_text": f"Continuation fragment {index}",
                "protected_source_text": f"Continuation fragment {index}",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "single",
                "layout_zone": "single_column",
                "layout_boundary_role": "tail" if index % 2 == 0 else "head",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": f"p001-b{index:03d}",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": [f"p001-b{index:03d}"],
                "translation_unit_protected_source_text": f"Continuation fragment {index}",
                "translation_unit_formula_map": [],
            }
        )

    fake_pairs = [
        {"prev_item_id": f"p001-b{index:03d}", "next_item_id": f"p001-b{index + 1:03d}"}
        for index in range(13)
    ]
    batch_sizes: list[int] = []

    monkeypatch.setattr(
        "services.translation.services.continuation.orchestrator.candidate_continuation_pairs",
        lambda _payload: fake_pairs,
    )
    monkeypatch.setattr(
        "services.translation.services.continuation.orchestrator.pair_join_score",
        lambda _prev, _next: 0,
    )
    monkeypatch.setattr(
        "services.translation.services.continuation.orchestrator.pair_break_score",
        lambda _prev, _next: 0,
    )

    def _fake_review(batch_pairs, **_kwargs):
        batch_sizes.append(len(batch_pairs))
        return {pair["pair_id"]: "break" for pair in batch_pairs}

    monkeypatch.setattr(
        "services.translation.services.continuation.orchestrator.review_candidate_pairs",
        _fake_review,
    )

    review_candidate_continuation_pairs(
        page_payloads=page_payloads,
        translation_paths={},
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        workers=4,
        save_pages_fn=lambda *_args, **_kwargs: None,
        request_chat_content_fn=lambda *_args, **_kwargs: "{}",
    )

    assert batch_sizes == [13]


def test_continuation_review_keeps_cross_page_middle_landing() -> None:
    page_payloads = {
        0: [
            {
                "item_id": "p011-b014",
                "page_idx": 10,
                "block_idx": 14,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [320, 650, 560, 730],
                "source_text": "The paragraph continues with",
                "protected_source_text": "The paragraph continues with",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_zone": "right_column",
                "layout_boundary_role": "tail",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "candidate_break",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "p012-b006",
            }
        ],
        1: [
            {
                "item_id": "p012-b006",
                "page_idx": 11,
                "block_idx": 6,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [60, 260, 300, 320],
                "source_text": "term. In fact, this is a later paragraph.",
                "protected_source_text": "term. In fact, this is a later paragraph.",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_zone": "left_column",
                "layout_boundary_role": "middle",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "candidate_break",
                "continuation_candidate_prev_id": "p011-b014",
                "continuation_candidate_next_id": "",
            }
        ],
    }

    applied = review_candidate_continuation_pairs(
        page_payloads=page_payloads,
        translation_paths={},
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        workers=1,
        save_pages_fn=lambda *_args, **_kwargs: None,
        request_chat_content_fn=lambda *_args, **_kwargs: "{}",
    )

    assert applied == 2


def test_apply_translation_policies_does_not_call_no_trans_classifier_by_default(monkeypatch) -> None:
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("no-trans classifier should be opt-in")

    monkeypatch.setattr(TranslationPlanner, "classify_no_trans", _fail_if_called)
    payload = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_idx": 1,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "Default: 0\nType: <INT>",
            "protected_source_text": "Default: 0\nType: <INT>",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "Default: 0\nType: <INT>",
            "translation_unit_formula_map": [],
            "formula_map": [],
            "mixed_original_protected_source_text": "",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
            "layout_zone": "",
        }
    ]

    classified, _ = apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=False,
        page_idx=0,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
    )

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""
