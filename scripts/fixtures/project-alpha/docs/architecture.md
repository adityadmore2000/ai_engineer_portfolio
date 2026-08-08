---
order: 2
---

## System Architecture

![Architecture diagram](/architecture-diagram.png)

## Data Flow

- A job description is parsed into a structured profile.
- Composite scoring ranks every candidate deterministically.
- The top-K shortlist is exported to CSV.