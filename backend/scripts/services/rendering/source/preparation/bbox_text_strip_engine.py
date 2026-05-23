from __future__ import annotations

import fitz
import pikepdf
from pikepdf import Name

from services.rendering.source.preparation.bbox_text_strip_hit_test import RectIndex
from services.rendering.source.preparation.bbox_text_strip_hit_test import is_protected_text_op
from services.rendering.source.preparation.bbox_text_strip_pdf_math import IDENTITY_MATRIX
from services.rendering.source.preparation.bbox_text_strip_pdf_math import PdfMatrix
from services.rendering.source.preparation.bbox_text_strip_pdf_math import matrix_from_object
from services.rendering.source.preparation.bbox_text_strip_pdf_math import matrix_from_operands
from services.rendering.source.preparation.bbox_text_strip_pdf_math import matrix_point
from services.rendering.source.preparation.bbox_text_strip_pdf_math import mul_matrix
from services.rendering.source.preparation.bbox_text_strip_pdf_math import to_float
from services.rendering.source.preparation.bbox_text_strip_text_ops import TEXT_DEFAULT_RENDER_MODE
from services.rendering.source.preparation.bbox_text_strip_text_ops import TEXT_SHOW_OPERATORS
from services.rendering.source.preparation.bbox_text_strip_text_ops import TextOperandMetrics
from services.rendering.source.preparation.bbox_text_strip_text_ops import TextState
from services.rendering.source.preparation.bbox_text_strip_text_ops import estimated_user_text_geometry
from services.rendering.source.preparation.bbox_text_strip_text_ops import text_advance_tx
from services.rendering.source.preparation.bbox_text_strip_text_ops import text_operand_metrics


def strip_bbox_text_from_page(
    page: pikepdf.Page,
    rects: list[fitz.Rect],
    *,
    protected_rects: list[fitz.Rect] | None = None,
    recurse_forms: bool = True,
) -> tuple[bytes | None, int, int]:
    return strip_bbox_text_from_stream(
        page,
        rects,
        protected_rects=protected_rects,
        recurse_forms=recurse_forms,
    )


def strip_bbox_text_from_stream(
    stream_obj: pikepdf.Page | pikepdf.Object,
    rects: list[fitz.Rect],
    *,
    protected_rects: list[fitz.Rect] | None = None,
    recurse_forms: bool = True,
    initial_ctm: PdfMatrix = IDENTITY_MATRIX,
    visited_forms: set[tuple[int, int]] | None = None,
) -> tuple[bytes | None, int, int]:
    instructions = list(pikepdf.parse_content_stream(stream_obj))
    if not instructions or not rects:
        return None, 0, 0

    output: list[tuple] = []
    protected_rects = protected_rects or []
    strip_index = RectIndex.build(rects)
    protected_index = RectIndex.build(protected_rects)
    removed = 0
    forms_changed = 0
    ctm: PdfMatrix = initial_ctm
    ctm_stack: list[PdfMatrix] = []
    text_matrix: PdfMatrix = IDENTITY_MATRIX
    line_matrix: PdfMatrix = IDENTITY_MATRIX
    leading = 0.0
    text_state = TextState(render_mode=TEXT_DEFAULT_RENDER_MODE)
    text_state_stack: list[TextState] = []

    xobjects = _xobject_dict(stream_obj)

    def move_text(tx: float, ty: float) -> None:
        nonlocal text_matrix, line_matrix
        move = (1, 0, 0, 1, tx, ty)
        line_matrix = mul_matrix(line_matrix, move)
        text_matrix = line_matrix

    def advance_text(
        operands: object,
        *,
        text_metrics: TextOperandMetrics | None = None,
    ) -> None:
        nonlocal text_matrix
        text_matrix = mul_matrix(
            text_matrix,
            (
                1,
                0,
                0,
                1,
                text_advance_tx(
                    text_matrix,
                    operands,
                    text_metrics=text_metrics,
                    text_state=text_state,
                ),
                0,
            ),
        )

    for operands, operator in instructions:
        op = str(operator)
        if op == "q":
            ctm_stack.append(ctm)
            text_state_stack.append(text_state.copy())
            output.append((operands, operator))
            continue
        if op == "Q":
            ctm = ctm_stack.pop() if ctm_stack else IDENTITY_MATRIX
            text_state = text_state_stack.pop() if text_state_stack else TextState(render_mode=TEXT_DEFAULT_RENDER_MODE)
            output.append((operands, operator))
            continue
        if op == "cm":
            matrix = matrix_from_operands(operands)
            if matrix is not None:
                ctm = mul_matrix(ctm, matrix)
            output.append((operands, operator))
            continue
        if op == "Do" and operands:
            xobject_name = operands[0]
            xobject = None
            if xobjects is not None:
                try:
                    xobject = xobjects.get(xobject_name)
                except Exception:
                    xobject = None
            if recurse_forms and xobject is not None and str(xobject.get(Name("/Subtype"))) == "/Form":
                objgen = getattr(xobject, "objgen", None)
                form_key = tuple(objgen) if objgen is not None else (id(xobject), 0)
                if visited_forms is None:
                    visited_forms = set()
                if form_key not in visited_forms:
                    visited_forms.add(form_key)
                    form_matrix = matrix_from_object(xobject.get(Name("/Matrix"), []))
                    form_content, form_removed, nested_forms_changed = strip_bbox_text_from_stream(
                        xobject,
                        rects,
                        protected_rects=protected_rects,
                        recurse_forms=recurse_forms,
                        initial_ctm=mul_matrix(ctm, form_matrix),
                        visited_forms=visited_forms,
                    )
                    if form_content and form_removed > 0:
                        xobject.write(form_content)
                        forms_changed += 1
                        removed += form_removed
                    forms_changed += nested_forms_changed
                    visited_forms.remove(form_key)
            output.append((operands, operator))
            continue
        if op == "BT":
            text_matrix = IDENTITY_MATRIX
            line_matrix = text_matrix
            output.append((operands, operator))
            continue
        if op == "Tm":
            matrix = matrix_from_operands(operands)
            if matrix is not None:
                text_matrix = matrix
                line_matrix = matrix
            output.append((operands, operator))
            continue
        if op in {"Td", "TD"} and len(operands) >= 2:
            tx = to_float(operands[0])
            ty = to_float(operands[1])
            if op == "TD":
                leading = -ty
            move_text(tx, ty)
            output.append((operands, operator))
            continue
        if op == "TL" and operands:
            leading = to_float(operands[0])
            output.append((operands, operator))
            continue
        if op == "Tf" and len(operands) >= 2:
            text_state.set_font_size(to_float(operands[1], text_state.font_size))
            output.append((operands, operator))
            continue
        if op == "Tc" and operands:
            text_state.set_char_spacing(to_float(operands[0], text_state.char_spacing))
            output.append((operands, operator))
            continue
        if op == "Tw" and operands:
            text_state.set_word_spacing(to_float(operands[0], text_state.word_spacing))
            output.append((operands, operator))
            continue
        if op == "Tz" and operands:
            text_state.set_horizontal_scaling(to_float(operands[0], text_state.horizontal_scaling * 100.0))
            output.append((operands, operator))
            continue
        if op == "Ts" and operands:
            text_state.set_rise(to_float(operands[0], text_state.rise))
            output.append((operands, operator))
            continue
        if op == "Tr" and operands:
            text_state.set_render_mode(int(to_float(operands[0], TEXT_DEFAULT_RENDER_MODE)))
            output.append((operands, operator))
            continue
        if op == "T*":
            move_text(0, -leading)
            output.append((operands, operator))
            continue
        if op in {"'", '"'}:
            if op == '"' and len(operands) >= 3:
                text_state.set_word_spacing(to_float(operands[0], text_state.word_spacing))
                text_state.set_char_spacing(to_float(operands[1], text_state.char_spacing))
            move_text(0, -leading)

        if op in TEXT_SHOW_OPERATORS:
            text_metrics = text_operand_metrics(operands)
            user_point, text_rect = estimated_user_text_geometry(
                ctm,
                text_matrix,
                text_state,
                text_length=text_metrics[0],
            )
            should_remove = strip_index.contains_point_or_intersects(
                user_point[0],
                user_point[1],
                text_rect,
            ) and not is_protected_text_op(
                user_point=user_point,
                text_rect=text_rect,
                protected_index=protected_index,
            )
            advance_text(operands, text_metrics=text_metrics)
            if should_remove:
                removed += 1
                continue

        output.append((operands, operator))

    if removed <= 0:
        return None, 0, forms_changed
    return pikepdf.unparse_content_stream(output), removed, forms_changed


def _xobject_dict(container: pikepdf.Page | pikepdf.Object) -> object | None:
    try:
        resources = container.obj.get(Name("/Resources")) if isinstance(container, pikepdf.Page) else container.get(Name("/Resources"))
        if resources is None:
            return None
        return resources.get(Name("/XObject"))
    except Exception:
        return None
