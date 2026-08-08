from __future__ import annotations

from specs.ids import generate_heading_id


def test_slugifies_canonical_legacy_anchor_names():
    assert generate_heading_id("Why I Built It") == "why-i-built-it"
    assert generate_heading_id("Engineering Decisions") == "engineering-decisions"
    assert generate_heading_id("Future Improvements") == "future-improvements"
    assert generate_heading_id("Example Inputs / Outputs") == "example-inputs-outputs"


def test_falls_back_to_section_for_punctuation_only():
    assert generate_heading_id("!!!") == "section"


def test_lowercases_and_trims():
    assert generate_heading_id("  System ARCHITECTURE  ") == "system-architecture"


def test_collapses_runs_of_separators():
    assert generate_heading_id("a   b___c--d") == "a-b-c-d"


def test_agrees_with_ts_headings_suite():
    """Mirrors `lib/content/headings.test.ts` bare-mode cases."""
    cases = {
        "Why I Built It": "why-i-built-it",
        "Engineering Decisions": "engineering-decisions",
        "Future Improvements": "future-improvements",
        "Example Inputs / Outputs": "example-inputs-outputs",
        "!!!": "section",
    }
    for title, expected in cases.items():
        assert generate_heading_id(title) == expected, title