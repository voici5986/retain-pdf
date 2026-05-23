from __future__ import annotations

from services.translation.llm.shared.control_context import build_translation_control_context
from services.translation.llm.shared.orchestration.batched_plain_single import retry_deferred_transport_items


class _Diagnostics:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def emit(self, **kwargs) -> None:
        self.events.append(kwargs)


def test_tail_retry_item_exception_marks_only_that_item_failed() -> None:
    context = build_translation_control_context()
    diagnostics = _Diagnostics()
    stored: list[dict] = []
    items = [
        {"item_id": "a", "page_idx": 0, "source_text": "A"},
        {"item_id": "b", "page_idx": 0, "source_text": "B"},
    ]

    def translator(item: dict, **_kwargs):
        if item["item_id"] == "a":
            raise RuntimeError("parser failed")
        return {
            "b": {
                "decision": "translate",
                "translated_text": "乙",
                "final_status": "translated",
            }
        }

    result = retry_deferred_transport_items(
        items,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        request_label="tail-test",
        context=context,
        diagnostics=diagnostics,
        single_item_translator=translator,
        store_cached_batch_fn=lambda batch, payload, **_kwargs: stored.append({"batch": batch, "payload": payload}),
    )

    assert result["a"]["final_status"] == "failed"
    assert result["a"]["translation_diagnostics"]["dead_letter"] is True
    assert result["a"]["translation_diagnostics"]["degradation_reason"] == "transport_tail_retry_item_exception"
    assert result["b"]["translated_text"] == "乙"
    assert diagnostics.events[0]["kind"] == "transport_tail_retry_item_failed"
    assert len(stored) == 1
    assert stored[0]["batch"][0]["item_id"] == "b"
