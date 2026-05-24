from __future__ import annotations

from collections import deque

import fitz

from services.rendering.layout.font_roles import is_title_like_block
from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.source.background.color_sampling import sample_local_background_fill


DARK_BACKGROUND_BRIGHTNESS_MAX = 0.42
TITLE_COLOR_SAMPLE_SCALE = 3.0
TITLE_COLOR_MIN_DISTANCE = 42.0
TITLE_COLOR_QUANTUM = 16


def relative_brightness(color: tuple[float, float, float]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def text_color_for_fill(fill: tuple[float, float, float]) -> tuple[float, float, float]:
    if relative_brightness(fill) <= DARK_BACKGROUND_BRIGHTNESS_MAX:
        return (1, 1, 1)
    return (0, 0, 0)


def _color_distance_sq(
    left: tuple[int, int, int],
    right: tuple[int, int, int],
) -> int:
    return sum((a - b) * (a - b) for a, b in zip(left, right))


def _quantize_color(color: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(int(component // TITLE_COLOR_QUANTUM) for component in color)


def _title_foreground_color_from_pixmap(
    pix: fitz.Pixmap,
    background: tuple[float, float, float],
) -> tuple[float, float, float] | None:
    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return None

    bg = tuple(max(0, min(255, int(round(component * 255)))) for component in background)
    threshold_sq = int(TITLE_COLOR_MIN_DISTANCE * TITLE_COLOR_MIN_DISTANCE)
    samples = pix.samples
    stride = pix.n
    width = pix.width
    height = pix.height
    total_pixels = width * height

    foreground = bytearray(total_pixels)
    for idx in range(total_pixels):
        offset = idx * stride
        rgb = (samples[offset], samples[offset + 1], samples[offset + 2])
        if _color_distance_sq(rgb, bg) >= threshold_sq:
            foreground[idx] = 1

    visited = bytearray(total_pixels)
    buckets: dict[tuple[int, int, int], list[int]] = {}
    min_component_pixels = max(3, int(total_pixels * 0.0004))
    max_component_pixels = max(24, int(total_pixels * 0.35))

    for start in range(total_pixels):
        if not foreground[start] or visited[start]:
            continue

        queue: deque[int] = deque([start])
        visited[start] = 1
        component: list[int] = []
        min_x = width
        min_y = height
        max_x = -1
        max_y = -1

        while queue:
            current = queue.popleft()
            component.append(current)
            y, x = divmod(current, width)
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

            if x > 0:
                neighbor = current - 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = current + 1
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = current - width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = current + width
                if foreground[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)

        component_pixels = len(component)
        component_width = max_x - min_x + 1
        component_height = max_y - min_y + 1
        if component_pixels < min_component_pixels or component_pixels > max_component_pixels:
            continue
        if component_width >= width * 0.82 and component_height <= max(3, height * 0.08):
            continue
        if component_width >= width * 0.92 and component_height >= height * 0.55:
            continue

        for idx in component:
            offset = idx * stride
            rgb = (samples[offset], samples[offset + 1], samples[offset + 2])
            key = _quantize_color(rgb)
            bucket = buckets.setdefault(key, [0, 0, 0, 0])
            bucket[0] += rgb[0]
            bucket[1] += rgb[1]
            bucket[2] += rgb[2]
            bucket[3] += 1

    if not buckets:
        return None

    _key, bucket = max(buckets.items(), key=lambda entry: entry[1][3])
    count = bucket[3]
    if count <= 0:
        return None
    return (
        bucket[0] / count / 255.0,
        bucket[1] / count / 255.0,
        bucket[2] / count / 255.0,
    )


def title_text_color_from_visual_components(
    page: fitz.Page,
    rect: fitz.Rect,
    background: tuple[float, float, float],
) -> tuple[float, float, float] | None:
    if rect.is_empty or rect.is_infinite:
        return None
    clipped = rect & page.rect
    if clipped.is_empty or clipped.is_infinite:
        return None

    try:
        pix = page.get_pixmap(
            matrix=fitz.Matrix(TITLE_COLOR_SAMPLE_SCALE, TITLE_COLOR_SAMPLE_SCALE),
            clip=clipped,
            alpha=False,
        )
    except Exception:
        return None
    return _title_foreground_color_from_pixmap(pix, background)


def apply_adaptive_overlay_colors(
    page: fitz.Page,
    items: list[dict],
    *,
    precomputed_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None,
) -> list[dict]:
    adapted: list[dict] = []
    for item in items:
        next_item = dict(item)
        item_id = str(next_item.get("item_id") or "")
        precomputed = (precomputed_colors_by_item_id or {}).get(item_id) if item_id else None
        if precomputed is not None:
            next_item["_render_cover_fill"] = precomputed.get("cover_fill", next_item.get("_render_cover_fill", (1, 1, 1)))
            next_item["_render_text_color"] = precomputed.get("text_color", next_item.get("_render_text_color", (0, 0, 0)))
            adapted.append(next_item)
            continue
        bbox = cover_bbox(next_item)
        rect: fitz.Rect | None = None
        if len(bbox) != 4:
            fill = (1, 1, 1)
        else:
            rect = fitz.Rect(bbox)
            if rect.is_empty or rect.is_infinite:
                fill = (1, 1, 1)
            else:
                fill = sample_local_background_fill(page, rect)
        next_item["_render_cover_fill"] = fill
        text_color = text_color_for_fill(fill)
        if rect is not None and is_title_like_block(next_item):
            title_color = title_text_color_from_visual_components(page, rect, fill)
            if title_color is not None:
                text_color = title_color
        next_item["_render_text_color"] = text_color
        adapted.append(next_item)
    return adapted


__all__ = [
    "apply_adaptive_overlay_colors",
    "relative_brightness",
    "text_color_for_fill",
    "title_text_color_from_visual_components",
]
