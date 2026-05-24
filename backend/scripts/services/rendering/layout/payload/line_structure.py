from __future__ import annotations

import re

from services.document_schema.text_flow import TEXT_FLOW_PRESERVE_LINES
from services.document_schema.text_flow import classify_text_flow
from services.document_schema.text_flow import line_texts_from_lines
from services.rendering.layout.model.models import RenderLineBox

TOKEN_RE = re.compile(r"[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[^\S\r\n]+|.")
PUNCTUATION_RE = re.compile(r"^[，。！？；：、,.!?;:()\[\]{}<>《》“”‘’\"']$")
PRESERVED_LINE_LEADING_CANDIDATES = (0.12, 0.16, 0.2, 0.24, 0.28, 0.32)
PRESERVED_LINE_HEIGHT_FILL = 0.96
PRESERVED_LINE_MIN_FONT_PT = 7.2
PRESERVED_LINE_IDEAL_LEADING = 0.22
PRESERVED_LINE_IDEAL_FONT_PT = 10.6


def source_line_texts(item: dict) -> list[str]:
    explicit = item.get("source_line_texts")
    if isinstance(explicit, list):
        return [str(line).strip() for line in explicit if str(line).strip()]
    return line_texts_from_lines(item.get("lines") or [])


def preserved_line_boxes_for_item(item: dict, translated_text: str) -> list[RenderLineBox]:
    if not bool(item.get("_render_preserve_line_breaks")):
        return []
    text_lines = [str(line).strip() for line in str(translated_text or "").splitlines() if str(line).strip()]
    raw_lines = item.get("lines") or []
    if not text_lines or not isinstance(raw_lines, list) or len(raw_lines) < len(text_lines):
        return []

    boxes: list[RenderLineBox] = []
    for text, raw_line in zip(text_lines, raw_lines, strict=False):
        if not isinstance(raw_line, dict):
            return []
        bbox = raw_line.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            return []
        try:
            line_bbox = [float(value) for value in bbox]
        except (TypeError, ValueError):
            return []
        if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
            return []
        boxes.append(RenderLineBox(text=text, bbox=line_bbox))
    return boxes


def looks_like_structured_line_block(item: dict, lines: list[str] | None = None) -> bool:
    semantic_role = str(item.get("semantic_role") or item.get("layout_role") or "").strip().lower()
    structure_role = str(item.get("structure_role") or "").strip().lower()
    if structure_role != "table_of_contents" and semantic_role in {"body", "abstract"}:
        return False
    if str(item.get("text_flow", "") or "").strip().lower() == TEXT_FLOW_PRESERVE_LINES:
        return True
    source_text = str(item.get("protected_source_text") or item.get("source_text") or "")
    del lines
    return classify_text_flow(text=source_text, lines=item.get("lines") or []) == TEXT_FLOW_PRESERVE_LINES


def _token_units(token: str) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return max(0.12, len(token) * 0.18)
    if re.fullmatch(r"[\u4e00-\u9fff]", token):
        return 1.0
    if re.fullmatch(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", token):
        return max(0.8, len(token) * 0.55)
    if PUNCTUATION_RE.fullmatch(token):
        return 0.5
    return 0.55


def _text_units(text: str) -> float:
    return sum(_token_units(token) for token in TOKEN_RE.findall(text or ""))


def _clean_line(tokens: list[str]) -> str:
    return re.sub(r"\s+", " ", "".join(tokens)).strip()


def split_text_by_source_line_weights(translated_text: str, source_lines: list[str]) -> list[str]:
    source_weights = [max(1.0, _text_units(line)) for line in source_lines if line.strip()]
    if not source_weights:
        return [translated_text.strip()] if translated_text.strip() else []
    tokens = TOKEN_RE.findall(translated_text or "")
    if not tokens:
        return []
    token_units = [_token_units(token) for token in tokens]
    total_units = sum(token_units)
    if total_units <= 0:
        return [_clean_line(tokens)]

    total_source_weight = sum(source_weights)
    chunks: list[str] = []
    start = 0
    running_units = 0.0
    source_running = 0.0
    token_index = 0
    for source_weight in source_weights[:-1]:
        source_running += source_weight
        target_units = total_units * (source_running / total_source_weight)
        while token_index < len(tokens) and running_units + token_units[token_index] < target_units:
            running_units += token_units[token_index]
            token_index += 1
        split_index = max(start + 1, min(len(tokens), token_index))
        while split_index < len(tokens) and tokens[split_index].isspace():
            split_index += 1
        chunks.append(_clean_line(tokens[start:split_index]))
        start = split_index
    chunks.append(_clean_line(tokens[start:]))
    return [chunk for chunk in chunks if chunk]


def maybe_preserve_structured_line_breaks(item: dict, translated_text: str) -> str:
    text = str(translated_text or "").strip()
    if not text:
        return text
    if "\n" in text:
        if looks_like_structured_line_block(item):
            item["_render_preserve_line_breaks"] = True
            item["_render_line_structure"] = "structured_lines"
            return text
        return re.sub(r"[ \t]*[\r\n]+[ \t]*", " ", text).strip()
    lines = source_line_texts(item)
    if not looks_like_structured_line_block(item, lines):
        return text
    chunks = split_text_by_source_line_weights(text, lines)
    if len(chunks) < 2:
        return text
    item["_render_preserve_line_breaks"] = True
    item["_render_line_structure"] = "structured_lines"
    return "\n".join(chunks)


def fit_preserved_line_block_metrics(
    inner: list[float],
    protected_text: str,
    font_size_pt: float,
    leading_em: float,
) -> tuple[float, float]:
    if len(inner) != 4:
        return font_size_pt, leading_em
    line_count = max(1, len([line for line in str(protected_text or "").splitlines() if line.strip()]))
    if line_count <= 1:
        return font_size_pt, leading_em
    height = max(1.0, float(inner[3]) - float(inner[1]))
    if height <= 0:
        return font_size_pt, leading_em

    best: tuple[float, float, float] | None = None
    source_font_hint = max(float(font_size_pt or 0.0), PRESERVED_LINE_IDEAL_FONT_PT)
    for candidate_leading in PRESERVED_LINE_LEADING_CANDIDATES:
        candidate_font = height * PRESERVED_LINE_HEIGHT_FILL / max(1.0, line_count * (1.0 + candidate_leading))
        if candidate_font < PRESERVED_LINE_MIN_FONT_PT:
            continue
        line_pitch = candidate_font * (1.0 + candidate_leading)
        target_pitch = height / max(1.0, line_count)
        pitch_error = abs(line_pitch - target_pitch) / max(1.0, target_pitch)
        leading_error = abs(candidate_leading - PRESERVED_LINE_IDEAL_LEADING) * 0.9
        font_error = abs(candidate_font - min(source_font_hint, PRESERVED_LINE_IDEAL_FONT_PT + 1.0)) / 18.0
        score = pitch_error + leading_error + font_error
        if best is None or score < best[0]:
            best = (score, candidate_font, candidate_leading)

    if best is None:
        fallback_leading = PRESERVED_LINE_LEADING_CANDIDATES[0]
        fallback_font = height * PRESERVED_LINE_HEIGHT_FILL / max(1.0, line_count * (1.0 + fallback_leading))
        return round(max(PRESERVED_LINE_MIN_FONT_PT, fallback_font), 2), fallback_leading
    return round(best[1], 2), round(best[2], 2)


__all__ = [
    "fit_preserved_line_block_metrics",
    "looks_like_structured_line_block",
    "maybe_preserve_structured_line_breaks",
    "preserved_line_boxes_for_item",
    "source_line_texts",
    "split_text_by_source_line_weights",
]
