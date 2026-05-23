from __future__ import annotations

from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import FIRST_COMPLETED, wait

from services.translation.llm.shared.control_context import TranslationControlContext
from services.translation.llm.shared.orchestration import translate_batch
from services.translation.llm.shared.orchestration.batched_plain_single import retry_deferred_transport_items
import services.translation.llm.shared.orchestration.terminal_payloads as terminal_payloads
from services.translation.llm.shared.tail_retry_queue import DeferredTransportTailItem
from services.translation.services.memory import JobMemoryStore

from services.translation.workflow.batching.executor import _submit_parallel_translation_batches
from services.translation.workflow.batching.executor import _translate_batch_or_keep_origin
from services.translation.services.results.flush import TranslationFlushState
from services.translation.services.results.applier import TranslationResultApplier


def run_translation_batches_sequential(
    batches: list[list[dict]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
) -> None:
    total_batches = len(batches)
    for index, batch in enumerate(batches, start=1):
        batch_label = f"book: batch {index}/{total_batches}"
        translated = _translate_batch_or_keep_origin(
            batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=batch_label,
            domain_guidance=domain_guidance,
            mode=mode,
            context=translation_context,
            memory_store=memory_store,
            translate_fn=translate_batch,
        )
        touched_pages = result_applier.apply_batch(batch, translated)
        flush_state.record_progress(index, touched_pages)
        flush_state.flush_if_due(index, label=f"flushed after batch {index}/{total_batches}")
    _drain_transport_tail_retry_queue(
        translation_context=translation_context,
        result_applier=result_applier,
        flush_state=flush_state,
        tail_workers=1,
    )
    flush_state.final_flush()


def _submit_all_parallel_batches(
    *,
    batched_fast_batches: list[list[dict]],
    single_fast_batches: list[list[dict]],
    single_slow_batches: list[list[dict]],
    queue_workers: dict[str, int],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    executors: list[ThreadPoolExecutor],
) -> dict[object, tuple[str, list[dict]]]:
    futures: dict[object, tuple[str, list[dict]]] = {}
    queue_specs = (
        ("batched_fast", batched_fast_batches),
        ("single_fast", single_fast_batches),
        ("single_slow", single_slow_batches),
    )
    for queue_name, batches in queue_specs:
        futures.update(
            _submit_parallel_translation_batches(
                batches,
                worker_count=queue_workers[queue_name],
                queue_name=queue_name,
                api_key=api_key,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                mode=mode,
                translation_context=translation_context,
                memory_store=memory_store,
                executors=executors,
                translate_fn=translate_batch,
            )
        )
    return futures


def _submit_queue_batch(
    executor: ThreadPoolExecutor,
    *,
    queue_name: str,
    queue_total: int,
    index: int,
    batch: list[dict],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
) -> Future:
    return executor.submit(
        _translate_batch_or_keep_origin,
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=f"book: {queue_name} batch {index}/{queue_total}",
        domain_guidance=domain_guidance,
        mode=mode,
        context=translation_context,
        memory_store=memory_store,
        translate_fn=translate_batch,
    )


def _submit_initial_queue_batches(
    *,
    queue_name: str,
    batches: list[list[dict]],
    worker_count: int,
    executor: ThreadPoolExecutor,
    next_index_by_queue: dict[str, int],
    active: dict[Future, tuple[str, list[dict]]],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
) -> None:
    initial_count = min(max(1, worker_count), len(batches))
    for index in range(1, initial_count + 1):
        batch = batches[index - 1]
        future = _submit_queue_batch(
            executor,
            queue_name=queue_name,
            queue_total=len(batches),
            index=index,
            batch=batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            memory_store=memory_store,
        )
        active[future] = (queue_name, batch)
    next_index_by_queue[queue_name] = initial_count + 1


def _submit_replacement_batch(
    *,
    queue_name: str,
    batches_by_queue: dict[str, list[list[dict]]],
    executors_by_queue: dict[str, ThreadPoolExecutor],
    next_index_by_queue: dict[str, int],
    active: dict[Future, tuple[str, list[dict]]],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
) -> None:
    batches = batches_by_queue[queue_name]
    next_index = next_index_by_queue.get(queue_name, 1)
    if next_index > len(batches):
        return
    batch = batches[next_index - 1]
    future = _submit_queue_batch(
        executors_by_queue[queue_name],
        queue_name=queue_name,
        queue_total=len(batches),
        index=next_index,
        batch=batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
        translation_context=translation_context,
        memory_store=memory_store,
    )
    active[future] = (queue_name, batch)
    next_index_by_queue[queue_name] = next_index + 1


def run_translation_batches_parallel(
    *,
    batched_fast_batches: list[list[dict]],
    single_fast_batches: list[list[dict]],
    single_slow_batches: list[list[dict]],
    queue_workers: dict[str, int],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
) -> None:
    executors: list[ThreadPoolExecutor] = []
    batches_by_queue = {
        "batched_fast": batched_fast_batches,
        "single_fast": single_fast_batches,
        "single_slow": single_slow_batches,
    }
    total_batches = sum(len(batches) for batches in batches_by_queue.values())
    active: dict[Future, tuple[str, list[dict]]] = {}
    next_index_by_queue: dict[str, int] = {}
    executors_by_queue: dict[str, ThreadPoolExecutor] = {}
    for queue_name, batches in batches_by_queue.items():
        if not batches:
            continue
        worker_count = max(1, int(queue_workers.get(queue_name, 0) or 0))
        executor = ThreadPoolExecutor(max_workers=worker_count)
        executors.append(executor)
        executors_by_queue[queue_name] = executor
        _submit_initial_queue_batches(
            queue_name=queue_name,
            batches=batches,
            worker_count=worker_count,
            executor=executor,
            next_index_by_queue=next_index_by_queue,
            active=active,
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            memory_store=memory_store,
        )
    completed = 0
    try:
        while active:
            done, _pending = wait(active, return_when=FIRST_COMPLETED)
            for future in done:
                _queue_name, batch = active.pop(future)
                _submit_replacement_batch(
                    queue_name=_queue_name,
                    batches_by_queue=batches_by_queue,
                    executors_by_queue=executors_by_queue,
                    next_index_by_queue=next_index_by_queue,
                    active=active,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    domain_guidance=domain_guidance,
                    mode=mode,
                    translation_context=translation_context,
                    memory_store=memory_store,
                )
                try:
                    translated = future.result()
                except Exception as exc:
                    print(
                        f"book: {_queue_name} batch failed, preserving remaining completed results: {type(exc).__name__}: {exc}",
                        flush=True,
                    )
                    translated = _failed_results_for_unhandled_batch_exception(batch, exc)
                touched_pages = result_applier.apply_batch(batch, translated)
                completed += 1
                flush_state.record_progress(completed, touched_pages)
                flush_state.flush_if_due(completed, label=f"flushed after completed batch {completed}/{total_batches}")
                print(f"book: completed batch {completed}/{total_batches}", flush=True)
    finally:
        for executor in executors:
            executor.shutdown(wait=True, cancel_futures=False)
    _drain_transport_tail_retry_queue(
        translation_context=translation_context,
        result_applier=result_applier,
        flush_state=flush_state,
        tail_workers=max(1, min(16, sum(max(0, value) for value in queue_workers.values()) // 8 or 1)),
    )
    flush_state.final_flush()


def _failed_results_for_unhandled_batch_exception(
    batch: list[dict],
    exc: Exception,
) -> dict[str, dict[str, str]]:
    error_code = type(exc).__name__ or "UNHANDLED_BATCH_EXCEPTION"
    degraded: dict[str, dict[str, str]] = {}
    for item in batch:
        degraded.update(
            terminal_payloads.translation_failed_payload(
                item,
                route_path=["block_level", "batch_runner", "failed"],
                degradation_reason="batch_unhandled_exception",
                error_taxonomy="protocol",
                error_trace=[
                    {
                        "type": "protocol",
                        "code": error_code,
                        "message": str(exc),
                    }
                ],
                fallback_to="retry_required",
            )
        )
    return degraded


def _drain_transport_tail_retry_queue(
    *,
    translation_context: TranslationControlContext | None,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
    tail_workers: int,
) -> None:
    queue = getattr(translation_context, "transport_tail_retry_queue", None)
    if queue is None:
        return
    tail_items = queue.drain()
    if not tail_items:
        return
    print(
        f"book: transport tail retry queue start items={len(tail_items)} workers={max(1, tail_workers)}",
        flush=True,
    )
    completed = 0
    base_completed = int(flush_state.total_batches)
    flush_state.total_batches = base_completed + len(tail_items)
    if max(1, tail_workers) <= 1:
        for tail_item in tail_items:
            translated = _run_transport_tail_retry_item(tail_item)
            touched_pages = result_applier.apply_batch([tail_item.item], translated)
            completed += 1
            flush_state.record_progress(base_completed + completed, touched_pages)
            flush_state.flush_if_due(completed, label=f"flushed after transport tail retry {completed}/{len(tail_items)}")
        return

    with ThreadPoolExecutor(max_workers=max(1, tail_workers)) as executor:
        futures: dict[Future, DeferredTransportTailItem] = {
            executor.submit(_run_transport_tail_retry_item, tail_item): tail_item
            for tail_item in tail_items
        }
        for future in as_completed(futures):
            tail_item = futures[future]
            try:
                translated = future.result()
            except Exception as exc:
                print(
                    f"book: transport tail retry wrapper failed for {tail_item.item.get('item_id', '')}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                translated = _failed_results_for_unhandled_batch_exception([tail_item.item], exc)
            touched_pages = result_applier.apply_batch([tail_item.item], translated)
            completed += 1
            flush_state.record_progress(base_completed + completed, touched_pages)
            flush_state.flush_if_due(completed, label=f"flushed after transport tail retry {completed}/{len(tail_items)}")


def _run_transport_tail_retry_item(tail_item: DeferredTransportTailItem) -> dict[str, dict[str, str]]:
    return retry_deferred_transport_items(
        [tail_item.item],
        api_key=tail_item.api_key,
        model=tail_item.model,
        base_url=tail_item.base_url,
        request_label=tail_item.request_label,
        context=tail_item.context,
        diagnostics=tail_item.diagnostics,
        single_item_translator=tail_item.single_item_translator,
        store_cached_batch_fn=tail_item.store_cached_batch_fn,
    )


__all__ = [
    "run_translation_batches_parallel",
    "run_translation_batches_sequential",
]
