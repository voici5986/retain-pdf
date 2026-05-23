from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Callable


@dataclass(frozen=True)
class DeferredTransportTailItem:
    item: dict
    api_key: str
    model: str
    base_url: str
    request_label: str
    context: object
    diagnostics: object
    single_item_translator: Callable
    store_cached_batch_fn: Callable


class TransportTailRetryQueue:
    def __init__(self) -> None:
        self._items: list[DeferredTransportTailItem] = []
        self._lock = Lock()

    def push(self, item: DeferredTransportTailItem) -> None:
        with self._lock:
            self._items.append(item)

    def drain(self) -> list[DeferredTransportTailItem]:
        with self._lock:
            items = list(self._items)
            self._items.clear()
        return items

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


__all__ = [
    "DeferredTransportTailItem",
    "TransportTailRetryQueue",
]
