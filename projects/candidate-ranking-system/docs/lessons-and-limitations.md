---
order: 8
---

## Limitations

- The demo caps at `MAX_CANDIDATES = 100` and runs in memory, skipping the 100K path, artifact caching, and streaming top-N loader.
- Demo semantic normalization is relative to the uploaded set, so scores are not comparable across runs.
- Uploads with missing fields fall back to neutral defaults (`avg_response_time → 280.0`, `notice_period → 90`, `github → -1`), which can flatter or penalize partial profiles.
- [field_map.py](field_map.py) hardcodes EDA-derived ranges (`GITHUB_SCORE_MAX = 96.9`, `LAST_ACTIVE` 23–263 days, `RESPONSE_TIME` 2.1–280h, `ENDORSEMENTS_MAX = 242`) that won't transfer to other distributions.
- `_JD_OFFICE_CITIES = {'pune', 'noida'}` is hardcoded because the parser can't separate "office location" from "welcome to apply."
- `interview_completion_rate` and standalone `skill_assessment_scores` are excluded for sparsity; `current_company_size`, India-based `willing_to_relocate`, and certifications carry little weight.
- A missing/unparseable `last_active_date` scores 0.0 (fully stale, not neutral).
- `consulting_penalty` falls back to current-company matching when career history is empty.
- Consulting detection is substring-based, so a non-consulting firm whose name contains a flagged token can be mismatched.
