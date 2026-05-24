import re

from services.rendering.layout.inline_content.core.inline_math import apply_to_non_math_segments
from services.rendering.layout.inline_content.core.inline_math import build_direct_typst_passthrough_markdown
from services.rendering.layout.inline_content.core.inline_math import demote_text_heavy_inline_math
from services.rendering.layout.inline_content.core.inline_math import escape_markdown_literal_asterisks
from services.rendering.layout.inline_content.core.inline_math import surround_inline_math_with_spaces
from services.rendering.layout.inline_content.fallback.latex_normalizer import normalize_formula_for_latex_math


def _normalize_text_chunk(text: str) -> str:
    normalized_lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in (text or "").strip().split("\n")]
    return "\n".join(line for line in normalized_lines if line)


def _sanitize_existing_inline_math_for_markdown(text: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        expr = match.group(0)[1:-1].strip()
        if not expr:
            return match.group(0)
        expr = normalize_formula_for_latex_math(expr)
        return f"${expr}$"

    from services.rendering.layout.inline_content.core.inline_math import INLINE_MATH_BLOCK_RE

    return INLINE_MATH_BLOCK_RE.sub(_replace, text or "")


def build_markdown_from_direct_text(
    text: str,
    *,
    normalize_existing_inline_math: bool = False,
) -> str:
    markdown = _normalize_text_chunk(text)
    markdown = demote_text_heavy_inline_math(markdown)
    markdown = apply_to_non_math_segments(markdown, escape_markdown_literal_asterisks)
    if normalize_existing_inline_math:
        markdown = _sanitize_existing_inline_math_for_markdown(markdown)
    markdown = surround_inline_math_with_spaces(markdown)
    markdown = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"$\\circ$",
        markdown,
    )
    markdown = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"$\\circ$", markdown)
    markdown = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"$\\otimes$", markdown)
    return markdown


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    from services.rendering.layout.inline_content.mode_router import build_item_render_markdown

    return build_item_render_markdown(
        item,
        protected,
        item.get("formula_map", []),
    )


def build_direct_typst_passthrough_text(text: str) -> str:
    return build_direct_typst_passthrough_markdown(text or "")


def build_plain_text(item: dict) -> str:
    text = (item.get("translated_text") or item.get("source_text") or "").strip()
    return build_plain_text_from_text(text)


def build_plain_text_from_text(text: str) -> str:
    normalized_lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in (text or "").strip().split("\n")]
    return "\n".join(line for line in normalized_lines if line)
