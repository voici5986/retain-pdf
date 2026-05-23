from __future__ import annotations

from concurrent.futures import Future
import threading
import time

from services.translation.services.results.applier import TranslationResultApplier
from services.translation.llm.shared.control_context import build_translation_control_context
from services.translation.llm.shared.tail_retry_queue import DeferredTransportTailItem
from services.translation.workflow import batch_runner


class _FlushState:
    def __init__(self) -> None:
        self.dirty_pages: set[int] = set()
        self.progress: list[tuple[int, set[int]]] = []
        self.flush_labels: list[str] = []
        self.final_flushed = False
        self.total_batches = 0

    def mark_dirty(self, pages: set[int]) -> None:
        self.dirty_pages.update(pages)

    def record_progress(self, completed: int, touched_pages: set[int]) -> None:
        self.progress.append((completed, set(touched_pages)))

    def flush_if_due(self, _completed: int, *, label: str) -> None:
        self.flush_labels.append(label)

    def final_flush(self) -> None:
        self.final_flushed = True


def _done_future(result=None, exc: Exception | None = None) -> Future:
    future: Future = Future()
    if exc is not None:
        future.set_exception(exc)
    else:
        future.set_result(result)
    return future


def test_parallel_batch_runner_drains_successes_after_one_future_exception(monkeypatch) -> None:
    good_batch = [{"item_id": "a", "page_idx": 0, "source_text": "A"}]
    bad_batch = [{"item_id": "b", "page_idx": 1, "source_text": "B"}]

    def _translate(batch, **_kwargs):
        if batch[0]["item_id"] == "b":
            raise ValueError("broken result parser")
        return {"a": {"decision": "translate", "translated_text": "甲", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    payload = [
        {"item_id": "a", "page_idx": 0, "source_text": "A", "translated_text": ""},
        {"item_id": "b", "page_idx": 1, "source_text": "B", "translated_text": ""},
    ]
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0, "b": 1},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=[good_batch, bad_batch],
        single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 1},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[0]["translated_text"] == "甲"
    assert payload[0]["final_status"] == "translated"
    assert payload[1]["final_status"] == "failed"
    assert payload[1]["translation_diagnostics"]["degradation_reason"] == "batch_unhandled_exception"
    assert flush_state.final_flushed is True
    assert len(flush_state.progress) == 2


def test_parallel_batch_runner_drains_global_transport_tail_retry_queue(monkeypatch) -> None:
    context = build_translation_control_context()
    payload = [
        {"item_id": "a", "page_idx": 0, "source_text": "A", "translated_text": ""},
        {"item_id": "b", "page_idx": 1, "source_text": "B", "translated_text": ""},
    ]
    context.transport_tail_retry_queue.push(
        DeferredTransportTailItem(
            item=payload[1],
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://example.test",
            request_label="tail",
            context=context,
            diagnostics=None,
            single_item_translator=lambda item, **_kwargs: {
                item["item_id"]: {
                    "decision": "translate",
                    "translated_text": "乙",
                    "final_status": "translated",
                }
            },
            store_cached_batch_fn=lambda *_args, **_kwargs: None,
        )
    )
    monkeypatch.setattr(
        batch_runner,
        "translate_batch",
        lambda batch, **_kwargs: {
            batch[0]["item_id"]: {
                "decision": "translate",
                "translated_text": "甲",
                "final_status": "translated",
            }
        },
    )
    flush_state = _FlushState()
    flush_state.total_batches = 1
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0, "b": 1},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=[[payload[0]]],
        single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 1},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=context,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[0]["translated_text"] == "甲"
    assert payload[1]["translated_text"] == "乙"
    assert len(context.transport_tail_retry_queue) == 0
    assert flush_state.total_batches == 2
    assert flush_state.progress[-1] == (2, {1})


def test_parallel_batch_runner_only_keeps_worker_count_futures_active(monkeypatch) -> None:
    batches = [[{"item_id": f"i{index}", "page_idx": index, "source_text": str(index)}] for index in range(6)]
    payload = [
        {"item_id": f"i{index}", "page_idx": index, "source_text": str(index), "translated_text": ""}
        for index in range(6)
    ]
    lock = threading.Lock()
    active = 0
    peak_active = 0

    def _translate(batch, **_kwargs):
        nonlocal active, peak_active
        with lock:
            active += 1
            peak_active = max(peak_active, active)
        time.sleep(0.01)
        with lock:
            active -= 1
        item_id = batch[0]["item_id"]
        return {item_id: {"decision": "translate", "translated_text": f"译{item_id}", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={item["item_id"]: item["page_idx"] for item in payload},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=batches,
        single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 2, "single_slow": 0},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert peak_active <= 2
    assert len(flush_state.progress) == 6
