from __future__ import annotations

import re

from services.rendering.layout.model.models import RenderTocEntry


def _translated_lines(text: str) -> list[str]:
    return [line.strip() for line in str(text or "").splitlines() if line.strip()]


def _strip_toc_page_label(text: str, page_label: str) -> str:
    value = str(text or "").strip()
    page = re.escape(str(page_label or "").strip())
    if page:
        value = re.sub(rf"(?:\.{{2,}}|…+)?\s*{page}\s*$", "", value).strip()
    return value.strip(" .\t")


def _strip_toc_number(text: str, number: str) -> str:
    value = str(text or "").strip()
    number_text = str(number or "").strip()
    if number_text and value.startswith(number_text):
        return value[len(number_text) :].strip()
    return value


def _bbox_from_line(item: dict, entry: dict) -> list[float] | None:
    try:
        line_index = int(entry.get("line_index"))
    except (TypeError, ValueError):
        return None
    lines = item.get("lines") or []
    if line_index < 0 or line_index >= len(lines):
        return None
    line = lines[line_index]
    if not isinstance(line, dict):
        return None
    bbox = line.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    try:
        line_bbox = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None
    if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
        return None
    return line_bbox


def _bbox_from_entry(entry: dict) -> list[float] | None:
    bbox = entry.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    try:
        line_bbox = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None
    if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
        return None
    return line_bbox


def render_toc_entries_for_item(item: dict, translated_text: str) -> list[RenderTocEntry]:
    entries = item.get("toc_entries") or []
    if not isinstance(entries, list) or not entries:
        return []
    lines = _translated_lines(translated_text)
    rendered: list[RenderTocEntry] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        line_bbox = _bbox_from_line(item, entry) or _bbox_from_entry(entry)
        if line_bbox is None:
            continue
        source_title = str(entry.get("title") or "").strip()
        page_label = str(entry.get("page_label") or "").strip()
        number = str(entry.get("number") or "").strip()
        translated_line = lines[index] if index < len(lines) else ""
        title = _strip_toc_number(_strip_toc_page_label(translated_line, page_label), number) or source_title
        try:
            level = int(entry.get("level") or 1)
        except (TypeError, ValueError):
            level = 1
        rendered.append(
            RenderTocEntry(
                title=title,
                page_label=page_label,
                bbox=line_bbox,
                number=number,
                level=max(1, min(6, level)),
            )
        )
    return rendered


__all__ = ["render_toc_entries_for_item"]
