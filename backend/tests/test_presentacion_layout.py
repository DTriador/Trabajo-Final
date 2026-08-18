from app.api.contenido_generadores import (
    _clean_ppt_items,
    _normalize_ppt_slide_payload,
    _validate_slide_bounds,
)


def test_clean_ppt_items_removes_empty_values():
    items = ["Idea 1", "", "   ", None, "Idea 2", "  ", "Idea 3"]

    result = _clean_ppt_items(items)

    assert result == ["Idea 1", "Idea 2", "Idea 3"]


def test_normalize_ppt_slide_payload_splits_long_content():
    slides = [
        {
            "subtitulo": "Dinámica",
            "contenido": [
                "Idea 1",
                "Idea 2",
                "Idea 3",
                "Idea 4",
                "Idea 5",
                "Idea 6",
                "Idea 7",
                "Idea 8",
            ],
        }
    ]

    result = _normalize_ppt_slide_payload(slides)

    assert len(result) >= 2
    assert all(len(_clean_ppt_items(item.get("contenido", []))) <= 6 for item in result)


def test_validate_slide_bounds_accepts_valid_dimensions():
    assert _validate_slide_bounds(left=0.5, top=0.5, width=10, height=4, slide_width=13.33, slide_height=7.5) is True
    assert _validate_slide_bounds(left=0.5, top=0.5, width=13.0, height=7.0, slide_width=13.33, slide_height=7.5) is True
    assert _validate_slide_bounds(left=0.5, top=0.5, width=13.5, height=7.0, slide_width=13.33, slide_height=7.5) is False
