---
schema_version: 1
type: project
slug: candidate-ranking-system
title: Candidate Ranking System
status: completed
shortSummary: Rank 100K+ candidate profiles against a job description into a shortlist CSV.
featured: true
displayOrder: 0
technologies:
  - Python 3.10
  - PyTorch
keyMetrics:
  - "Ranked 100K+ profiles in minutes"
githubUrl: https://github.com/theule-home/candidate-ranking
coverImage: /images/cover.png
coverImageAlt: Pipeline overview
---

## Why I built it {#overview}

The problem it solves: ranking hundreds of thousands of candidate profiles.

## System architecture {#architecture}

```mermaid
graph TD
  A[job description] --> B[parsed JD]
  B --> E[composite scoring]
  E --> F[ranked CSV]
```

## Conclusion and results {#results}

- High-precision ranking vs an internal benchmark set.