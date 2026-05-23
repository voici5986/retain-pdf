from __future__ import annotations

from .models import FinalStatus


ALLOWED_UNTRANSLATED_ROUTE_NAMES = {
    "fast_path_keep_origin",
}
ALLOWED_UNTRANSLATED_REASONS = {
    "code",
    "keep_origin",
    "no_trans",
    "skip_interline_equation",
    "skip_display_formula",
    "skip_model_keep_origin",
}


def translation_artifact_text(item: dict) -> str:
    return str(
        item.get("translated_text")
        or item.get("protected_translated_text")
        or item.get("translation_unit_translated_text")
        or item.get("translation_unit_protected_translated_text")
        or ""
    ).strip()


def has_translation_artifact(item: dict) -> bool:
    return bool(translation_artifact_text(item))


def has_repaired_translation_artifact(item: dict, diagnostics: dict | None = None) -> bool:
    if not has_translation_artifact(item):
        return False
    diagnostics = dict(diagnostics or item.get("translation_diagnostics") or {})
    if diagnostics.get("garbled_reconstructed") is True:
        return True
    if str(item.get("classification_label", "") or "").strip() == "llm_reconstructed_garbled":
        return True
    if diagnostics.get("agent_repaired") is True:
        return True
    return False


def is_allowed_untranslated(item: dict, diagnostics: dict | None = None, route_path: list | None = None) -> bool:
    diagnostics = dict(diagnostics or {})
    if item.get("should_translate") is False:
        return True
    if str(item.get("policy_translate", "") or "").strip().lower() == "false":
        return True
    if str(item.get("block_kind", "") or "").strip().lower() == "formula":
        return True
    route_names = {str(route or "").strip() for route in (route_path if route_path is not None else diagnostics.get("route_path") or [])}
    if route_names & ALLOWED_UNTRANSLATED_ROUTE_NAMES:
        return True
    reasons = {
        str(item.get("skip_reason", "") or "").strip(),
        str(item.get("classification_label", "") or "").strip(),
        str(diagnostics.get("degradation_reason", "") or "").strip(),
        str(diagnostics.get("fallback_to", "") or "").strip(),
    }
    return bool(reasons & ALLOWED_UNTRANSLATED_REASONS)


def item_final_status(item: dict, diagnostics: dict | None = None) -> str:
    diagnostics = diagnostics or {}
    return str(diagnostics.get("final_status", "") or item.get("final_status", "") or "").strip()


def is_blocking_untranslated(item: dict, diagnostics: dict | None = None, route_path: list | None = None) -> bool:
    if has_repaired_translation_artifact(item, diagnostics):
        return False
    final_status = item_final_status(item, diagnostics)
    if final_status in {FinalStatus.KEPT_ORIGIN.value, FinalStatus.FAILED.value}:
        return not is_allowed_untranslated(item, diagnostics, route_path)
    if final_status == FinalStatus.TRANSLATED.value and not has_translation_artifact(item):
        return not is_allowed_untranslated(item, diagnostics, route_path)
    return False


__all__ = [
    "ALLOWED_UNTRANSLATED_REASONS",
    "ALLOWED_UNTRANSLATED_ROUTE_NAMES",
    "has_translation_artifact",
    "has_repaired_translation_artifact",
    "is_allowed_untranslated",
    "is_blocking_untranslated",
    "item_final_status",
    "translation_artifact_text",
]
