from __future__ import annotations

from dataclasses import replace

from services.translation.llm.shared.orchestration.metadata import should_store_translation_result
import services.translation.llm.shared.orchestration.terminal_payloads as terminal_payloads
from services.translation.llm.shared.orchestration.transport import DeferredTransportRetry
from services.translation.llm.shared.orchestration.transport import build_transport_tail_retry_context
from services.translation.llm.shared.orchestration.transport import mark_transport_result_dead_letter
from services.translation.llm.shared.tail_retry_queue import DeferredTransportTailItem


def translate_uncached_items_single(
    uncached_batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    merged: dict[str, dict[str, str]] = {}
    total_items = len(uncached_batch)
    deferred_transport_items: list[dict] = []
    for index, item in enumerate(uncached_batch, start=1):
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        item_context = context.scoped_to_item(item)
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=item_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=item_context.fallback_policy.transport_tail_retry_passes > 0,
            )
        except DeferredTransportRetry:
            deferred_transport_items.append(item)
            continue
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=item_context.cache_guidance,
                mode=item_context.mode,
                target_lang=item_context.target_lang,
                target_language_name=item_context.target_language_name,
            )
        merged.update(result)
    return merged, deferred_transport_items


def retry_deferred_transport_items(
    deferred_transport_items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    if not deferred_transport_items or context.fallback_policy.transport_tail_retry_passes <= 0:
        return merged
    tail_context = build_transport_tail_retry_context(context)
    if request_label:
        print(
            f"{request_label}: start transport tail retry pass items={len(deferred_transport_items)} timeout={tail_context.timeout_policy.plain_text_seconds}s",
            flush=True,
        )
    for index, item in enumerate(deferred_transport_items, start=1):
        item_label = f"{request_label} tail item {index}/{len(deferred_transport_items)} {item['item_id']}" if request_label else ""
        item_context = replace(
            tail_context.scoped_to_item(item),
            fallback_policy=replace(
                tail_context.fallback_policy,
                main_http_retry_attempts=max(
                    tail_context.fallback_policy.main_http_retry_attempts,
                    tail_context.fallback_policy.tail_http_retry_attempts,
                ),
            ),
        )
        try:
            result = single_item_translator(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=item_label,
                context=item_context,
                diagnostics=diagnostics,
                allow_transport_tail_defer=False,
            )
            result = mark_transport_result_dead_letter(
                result,
                item=item,
                context=item_context,
                diagnostics=diagnostics,
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{item_label}: tail retry item failed without blocking batch: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if diagnostics is not None:
                diagnostics.emit(
                    kind="transport_tail_retry_item_failed",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message=f"Tail retry item failed: {type(exc).__name__}: {exc}",
                    retryable=True,
                )
            result = terminal_payloads.translation_failed_payload(
                item,
                context=item_context,
                route_path=["block_level", "plain_text", "tail_retry", "failed"],
                degradation_reason="transport_tail_retry_item_exception",
                error_taxonomy="transport",
                error_trace=[
                    {
                        "type": "transport",
                        "code": type(exc).__name__ or "TAIL_RETRY_EXCEPTION",
                        "message": str(exc),
                    }
                ],
                fallback_to="dead_letter_queue",
                dead_letter=True,
            )
        payload = result.get(item["item_id"], {})
        if should_store_translation_result(payload):
            store_cached_batch_fn(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=item_context.cache_guidance,
                mode=item_context.mode,
                target_lang=item_context.target_lang,
                target_language_name=item_context.target_language_name,
            )
        merged.update(result)
    return merged


def enqueue_deferred_transport_items(
    deferred_transport_items: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics,
    single_item_translator,
    store_cached_batch_fn,
) -> bool:
    queue = getattr(context, "transport_tail_retry_queue", None)
    if not deferred_transport_items or context.fallback_policy.transport_tail_retry_passes <= 0 or queue is None:
        return False
    for item in deferred_transport_items:
        queue.push(
            DeferredTransportTailItem(
                item=item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                single_item_translator=single_item_translator,
                store_cached_batch_fn=store_cached_batch_fn,
            )
        )
    if request_label:
        print(
            f"{request_label}: queued transport tail retry items={len(deferred_transport_items)}",
            flush=True,
        )
    return True
