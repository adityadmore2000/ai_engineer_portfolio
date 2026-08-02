---
order: 9
---

## Future Improvements

- Add a cross-encoder second pass re-scoring only the top-K (~200), slotting between [rank_top_n](phase2/rank.py#L167) and reasoning.
- Fine-tune `bge-base-en-v1.5` (LoRA/QLoRA) on recruiter relevance labels for sharper JD-to-candidate discrimination.
- Promote `skill_assessment_scores` to a weighted credibility component once coverage is higher.
- Use `company_size`, `current_industry`, and the parsed `seniority_level` (currently unused in scoring) as additional fit signals.
- Learn Track-1 weights and the combination from ground-truth labels (e.g. learning-to-rank) instead of hand-tuning.
- Add explicit honeypot checks: YOE-vs-career-duration consistency, boilerplate-description detection beyond [_career_clause](phase2/rank.py#L287), and outlier endorsement/GitHub combinations.
