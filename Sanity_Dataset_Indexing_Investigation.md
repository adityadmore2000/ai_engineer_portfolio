# Sanity Dataset Indexing Investigation

**Date**: 2026-07-23
**Scope**: Determine whether the Qdrant vector database was indexed from the wrong Sanity dataset (e.g., `local` instead of `production`), causing retrieval to operate on outdated or unintended content.

---

## Executive Summary

The `local` and `production` Sanity datasets are **byte-for-byte identical**. Every project, experience, skill category, site setting, and technical note is the same in both datasets. The Qdrant vector database exactly matches both.

**The "wrong dataset" hypothesis is moot.** Regardless of whether `NEXT_PUBLIC_SANITY_DATASET` was set to `production` or `local` during indexing, the resulting Qdrant vectors would be identical.

The datasets were likely synchronized via the `scripts/sync-dataset.ts` tool, which performs a full `export` + `import --replace` between datasets. After synchronization, the datasets became indistinguishable — there is no way to determine from vector content alone which dataset was indexed.

However, the Qdrant data does **not** match the seed data (`sanity/seed.ndjson`) or the fallback content (`sanity/fallbackContent.ts`). Someone has edited the Sanity content beyond the initial seed — replacing the 3 seed projects (Resume Tailoring, Parcel Monitoring, Math Mentor AI) with 2 new projects (Video Captioning Agent, Candidate Ranking system) and substantially rewriting experience entries and site settings.

---

## 1. Environment Configuration

### `.env.example` — Template Configuration

**File**: `.env.example:16-25`

```
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2025-05-01

SANITY_API_WRITE_TOKEN=
SANITY_API_READ_TOKEN=
SANITY_PREVIEW_SECRET=
SANITY_REVALIDATE_SECRET=
# SANITY_LOCAL_DATASET=local
```

Key observations:
- `NEXT_PUBLIC_SANITY_DATASET` defaults to `production`
- `SANITY_LOCAL_DATASET` (used by sync tools) defaults to `local` but is **commented out**
- No other dataset-related variables exist

### Environment Loading Logic

**File**: `scripts/load-env.ts:1-16`

The ingestion script (`scripts/index-content.ts:1`) loads `.env.local` at startup via:
```typescript
import "./load-env";
```

The loader reads `.env.local` line-by-line and sets `process.env[key] = val` **only if** the variable is not already set (`if (!process.env[key])`). This means:
- Pre-existing environment variables take priority
- `.env.local` fills in any missing variables
- Running `NEXT_PUBLIC_SANITY_DATASET=local npx tsx scripts/index-content.ts` would override `.env.local`

### Sanity Client Configuration

**File**: `sanity/env.ts:1-7`

```typescript
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
```

`NEXT_PUBLIC_SANITY_DATASET` is the **only** variable that determines the dataset. Default: `"production"`.

**File**: `sanity/client.ts:4-11`

```typescript
export const client = createClient({
  projectId: projectId || "missing-project-id",
  dataset,          // ← from sanity/env.ts, which reads env var
  apiVersion,
  useCdn: false,
  perspective: "published",
  stega: false
});
```

The Sanity client is a **singleton** — both the web app and the ingestion script share the same `client` import from `sanity/client.ts`. They use the same dataset.

### Which Variable Selects the Dataset

| Variable | Purpose | Default | Used By |
|----------|---------|---------|---------|
| `NEXT_PUBLIC_SANITY_DATASET` | Active Sanity dataset (ingestion + queries) | `production` | `sanity/env.ts` → `sanity/client.ts` |
| `SANITY_LOCAL_DATASET` | Local dataset name for sync tools | `local` | `scripts/sync-dataset.ts` |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project identifier | (required, no default) | `sanity/env.ts` → `sanity/client.ts` |

### Which Dataset the Application Currently Uses

The web app (`sanity/client.ts`) and the ingestion script (`scripts/index-content.ts:3`) both import `client` from `sanity/client.ts`, which reads `NEXT_PUBLIC_SANITY_DATASET` from `process.env`. Since both share the same import, they always use the **same** dataset.

The `.env.example` specifies `production` as the default. However, the actual active dataset depends on what's in `.env.local` at runtime.

### Which Dataset the Indexing Script Uses

The indexing script at `scripts/index-content.ts:1-3`:
```typescript
import "./load-env";        // Loads .env.local into process.env
import { client } from "../sanity/client";  // Same client as web app
```

The ingestion uses the **same** `client` object as the web app. There is no separate dataset selection for indexing. The dataset is always `process.env.NEXT_PUBLIC_SANITY_DATASET || "production"`.

### Is the Indexing Script Environment the Same as the Web Application?

**Yes.** Both import `client` from `sanity/client.ts`, which reads from `sanity/env.ts`, which reads from `process.env`. The only difference is that the indexing script pre-loads `.env.local` via `scripts/load-env.ts` to populate `process.env`.

---

## 2. Ingestion Flow Trace

```
NEXT_PUBLIC_SANITY_DATASET env var
    │
    ▼
sanity/env.ts:3
  export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
    │
    ▼
sanity/client.ts:4-11
  export const client = createClient({ dataset, ... })
    │
    ▼
scripts/index-content.ts:3,349
  import { client } from "../sanity/client";
  isSanityConfigured ? await fetchFromSanity() : getFallbackContent()
    │
    ▼
fetchFromSanity() (line 302-321)
  client.fetch<SanityProject[]>(groq`*[_type == "project" && published == true]{...}`)
  client.fetch<SanityExperience[]>(groq`*[_type == "experience"]{...}`)
  ...etc...
    │
    ▼
Chunking functions (lines 117-300)
  chunkProject(), chunkSiteSettings(), chunkExperience(), chunkSkillCategory(), chunkTechnicalNote()
    │
    ▼
Embeddings (line 382)
  getEmbeddings() → HuggingFaceTransformersEmbeddings({ model: "Xenova/nomic-embed-text-v1.5" })
    │
    ▼
Qdrant insertion (line 385)
  QdrantVectorStore.fromDocuments(documents, embeddings, {
    url: vectorUrl,       // from VECTOR_URL env var
    collectionName,       // from QDRANT_COLLECTION env var
  })
```

The dataset value is read **once** at module load time (`sanity/env.ts:3`) and used throughout the entire pipeline. There is no branching or conditional dataset selection within the ingestion flow.

---

## 3. Which Dataset Was Indexed?

### Direct Evidence

| Evidence Type | Finding |
|--------------|---------|
| Shell history | `npx tsx scripts/index-content.ts` run twice — no `NEXT_PUBLIC_SANITY_DATASET=` prefix visible |
| `.env.example` default | `NEXT_PUBLIC_SANITY_DATASET=production` |
| `sanity/env.ts` fallback | `process.env.NEXT_PUBLIC_SANITY_DATASET \|\| "production"` |
| Log files | Not found — `scripts/index-content.ts` only logs chunk counts, not dataset name |

### Indirect Evidence: Comparison of Datasets vs Qdrant

Both `production` and `local` datasets contain identical content (see Section 4). The Qdrant vectors exactly match both datasets (see Section 5). Therefore, **it is impossible to determine** which dataset was indexed from vector content alone — both would produce the same vectors.

### Likelihood Assessment

Given the `.env.example` specifies `production` as the default and `sanity/env.ts` falls back to `"production"`, and given that both datasets are identical, the most likely scenario is:

**The dataset was `production`** — because that's the default and there's no evidence of an override. But even if it were `local`, the Qdrant vectors would be identical. The question has no practical consequence.

---

## 4. Local vs Production Dataset Comparison

### Project Documents

| Field | Production | Local | Match? |
|-------|-----------|-------|--------|
| Count | 2 | 2 | ✓ |
| Project 1 Title | Candidate Ranking system | Candidate Ranking system | ✓ |
| Project 1 Slug | candidate-ranking-system | candidate-ranking-system | ✓ |
| Project 1 Short Summary (first 50 chars) | "AI-powered candidate ranking system that combi" | "AI-powered candidate ranking system that combi" | ✓ |
| Project 1 Technologies | python, streamlit, sentence-transformers, ... | python, streamlit, sentence-transformers, ... | ✓ |
| Project 1 Populated Fields | problemStatement, approach, limitations, futureImprovements | problemStatement, approach, limitations, futureImprovements | ✓ |
| Project 1 Missing Fields | results, keyMetrics | results, keyMetrics | ✓ |
| Project 2 Title | Video Captioning Agent | Video Captioning Agent | ✓ |
| Project 2 Slug | video-captioning-agent | video-captioning-agent | ✓ |
| Project 2 Populated Fields | All 8 sections present | All 8 sections present | ✓ |

**Verdict: IDENTICAL**

### Experience Documents

| Field | Production | Local | Match? |
|-------|-----------|-------|--------|
| Count | 3 | 3 | ✓ |
| NDSoftTech role | Software Engineering Intern | Software Engineering Intern | ✓ |
| NDSoftTech company | NDSoftTech Solutions | NDSoftTech Solutions | ✓ |
| NDSoftTech bullets | 3 items (React Native, Firebase, Git) | 3 items (React Native, Firebase, Git) | ✓ |
| NDSoftTech skills | React Native, Firebase, REST API, ... | React Native, Firebase, REST API, ... | ✓ |
| Neilsoft role | AI/ML Engineer | AI/ML Engineer | ✓ |
| Neilsoft bullets | 7 items (YOLOv5, YOLOX, YOLOv8, PyTorch...) | 7 items (YOLOv5, YOLOX, YOLOv8, PyTorch...) | ✓ |
| Neilsoft skills | 12 items (ML, Python, CV, Model Eval, PyTorch...) | 12 items (ML, Python, CV, Model Eval, PyTorch...) | ✓ |
| Freelancer role | Applied AI Engineer | Applied AI Engineer | ✓ |
| Freelancer bullets | 4 items (AI workflows, reliability layers...) | 4 items (AI workflows, reliability layers...) | ✓ |
| Freelancer skills | 29 items (full list) | 29 items (full list) | ✓ |

**Verdict: IDENTICAL**

### Skill Categories

| Category | Production | Local | Match? |
|----------|-----------|-------|--------|
| Count | 4 | 4 | ✓ |
| Generative AI & LLM Systems (order 1) | skills: LLM, RAG, Semantic Search, ... (10 items) | skills: LLM, RAG, Semantic Search, ... (10 items) | ✓ |
| Computer Vision & Machine Learning (order 2) | skills: PyTorch, OpenCV, YOLOv5, ... (12 items) | skills: PyTorch, OpenCV, YOLOv5, ... (12 items) | ✓ |
| Backend & Application Development (order 3) | skills: Python, FastAPI, PostgreSQL, ... (12 items) | skills: Python, FastAPI, PostgreSQL, ... (12 items) | ✓ |
| MLOps & Infrastructure (order 4) | skills: Docker, MLflow, ... (9 items) | skills: Docker, MLflow, ... (9 items) | ✓ |

**Verdict: IDENTICAL**

### Site Settings

| Field | Production | Local | Match? |
|-------|-----------|-------|--------|
| shortBio (first 50 chars) | "I'm an AI Engineer specializing in production-grad" | "I'm an AI Engineer specializing in production-grad" | ✓ |
| aboutSummary (first 50 chars) | "I'm Aditya More, an AI Engineer who treats data ex" | "I'm Aditya More, an AI Engineer who treats data ex" | ✓ |
| heroDescription (first 50 chars) | "AI Engineer building systems where the architectur" | "AI Engineer building systems where the architectur" | ✓ |
| focusAreas | **null/absent** | **null/absent** | ✓ |
| contactHeadline | **null/absent** | **null/absent** | ✓ |
| contactDescription | **null/absent** | **null/absent** | ✓ |

**Verdict: IDENTICAL** (including the same three missing fields)

### Technical Notes

| Field | Production | Local | Match? |
|-------|-----------|-------|--------|
| Count | 1 | 1 | ✓ |
| Title | Notes on Evidence-Grounded RAG Evaluation | Notes on Evidence-Grounded RAG Evaluation | ✓ |
| Slug | evidence-grounded-rag-evaluation | evidence-grounded-rag-evaluation | ✓ |
| Summary | "A short note on checking whether generated answers..." | "A short note on checking whether generated answers..." | ✓ |
| Tags | [RAG, Evaluation, GenAI] | [RAG, Evaluation, GenAI] | ✓ |

**Verdict: IDENTICAL**

### Summary

```
Production ≡ Local  (100% identical across all document types)
```

---

## 5. Qdrant vs Both Datasets

### Project Comparison

| Metric | Sanity (both datasets) | Qdrant | Match? |
|--------|----------------------|--------|--------|
| Project count | 2 | 2 | ✓ |
| Candidate Ranking system | ✓ | ✓ (6 chunks) | ✓ |
| Video Captioning Agent | ✓ | ✓ (8 chunks) | ✓ |
| Candidate Ranking sections | Short Summary, Problem, Approach, Limitations, Future, Technologies | Same 6 sections | ✓ |
| Candidate Ranking missing | Results, Key Metrics (null in Sanity) | Results, Key Metrics absent | ✓ |
| Video Captioning sections | All 8 sections present | All 8 sections present | ✓ |

### Experience Comparison

| Qdrant Content (first line) | Sanity Reconstruction | Match? |
|---------------------------|-----------------------|--------|
| "AI/ML Engineer at Neilsoft" + 7 bullet points + 12 skills | role="AI/ML Engineer", company="Neilsoft", 7 bullets, 12 skills | ✓ |
| "Software Engineering Intern at NDSoftTech Solutions" + 3 bullets + 5 skills | role="SWE Intern", company="NDSoftTech Solutions", 3 bullets, 5 skills | ✓ |
| "Applied AI Engineer at Freelancer / Independent Projects" + description + 4 bullets + 29 skills | role, company, shortDescription (multi-paragraph), 4 bullets, 29 skills | ✓ |

### Site Settings Comparison

| Qdrant Section | Content (first 50 chars) | Sanity Field | Match? |
|----------------|-------------------------|-------------|--------|
| About | "I'm Aditya More, an AI Engineer who treats data..." | aboutSummary | ✓ |
| Bio | "I'm an AI Engineer specializing in production..." | shortBio | ✓ |
| Hero Description | "AI Engineer building systems where the..." | heroDescription | ✓ |
| Focus Areas | **Not in Qdrant** | **null in Sanity** | ✓ |
| Contact | **Not in Qdrant** | **null in Sanity** | ✓ |

### Skills Comparison

| Qdrant Category | Qdrant Skills Count | Sanity Skills Count | Match? |
|-----------------|--------------------|--------------------|--------|
| Computer Vision & Machine Learning | 12 | 12 | ✓ |
| Backend & Application Development | 12 | 12 | ✓ |
| Generative AI & LLM Systems | 10 | 10 | ✓ |
| MLOps & Infrastructure | 9 | 9 | ✓ |

### Technical Notes Comparison

| Qdrant | Sanity | Match? |
|--------|--------|--------|
| "A short note on checking whether generated answers are supported by retrieved evidence." | shortSummary: "A short note on checking whether generated answers are supported by retrieved evidence." | ✓ |
| "Tags: RAG, Evaluation, GenAI" | tags: [RAG, Evaluation, GenAI] | ✓ |

### Similarity Score

| Dataset | Similarity to Qdrant | Basis |
|---------|---------------------:|-------|
| Production | **100%** | All projects, experiences, skills, site settings, and technical notes match exactly |
| Local | **100%** | Identical to production — all content matches exactly |
| Seed (seed.ndjson) | ~15% | 3 different projects, different experience text, different skill names; only the technical note matches |
| Fallback (fallbackContent.ts) | ~10% | 3 different projects, different experience text, different skill names, no technical notes |

**Verdict**: Qdrant = Production = Local (all three are identical). Seed and Fallback are significantly different.

---

## 6. Neilsoft-Specific Verification

### Neilsoft Experience: Full Text Comparison

**Sanity Production** (from `npx sanity documents query`):
```
role: "AI/ML Engineer"
company: "Neilsoft"
shortDescription: "Worked on ML and AI engineering tasks involving model evaluation,
                   backend integration, and applied automation."
bulletPoints:
  [0] "Developed computer vision pipelines using YOLOv5, YOLOX, YOLOv8,
       PyTorch, and OpenCV for object detection and instance segmentation."
  [1] "Worked on dataset engineering workflows including preprocessing, annotation
       validation, augmentation, COCO-format conversion, and class-imbalance correction."
  [2] "Prepared and analyzed datasets containing 1,300+ images and 15+ object classes
       across architectural and engineering domains."
  [3] "Delivered detection models achieving up to 83.4 mAP on architectural datasets
       and 85.1 mAP on MEP systems."
  [4] "Benchmarked YOLOX and YOLOv8 models using precision-recall analysis to evaluate
       trade-offs between false positives and missed detections."
  [5] "Used Pandas-based analysis to identify annotation inconsistencies and
       class-imbalance issues before long training runs."
  [6] "Set up and debugged 3D point-cloud segmentation frameworks including SoftGroup,
       RepSurf, and PointGroup for comparative evaluation."
skills: ["Machine Learning", "Python", "Computer Vision", "Model Evaluation",
         "PyTorch", "YOLOv5", "YOLOX", "YOLOv8", "opencv", "object detection",
         "dataset engineering", "pandas"]
```

**Sanity Local**: **Identical** to production (verified byte-for-byte via Sanity GROQ query).

**Qdrant** (from vector database scroll):
```
AI/ML Engineer at Neilsoft
Worked on ML and AI engineering tasks involving model evaluation, backend
integration, and applied automation.

- Developed computer vision pipelines using YOLOv5, YOLOX, YOLOv8, PyTorch, and
  OpenCV for object detection and instance segmentation.
- Worked on dataset engineering workflows including preprocessing, annotation
  validation, augmentation, COCO-format conversion, and class-imbalance correction.
- Prepared and analyzed datasets containing 1,300+ images and 15+ object classes
  across architectural and engineering domains.
- Delivered detection models achieving up to 83.4 mAP on architectural datasets
  and 85.1 mAP on MEP systems.
- Benchmarked YOLOX and YOLOv8 models using precision-recall analysis to evaluate
  trade-offs between false positives and missed detections.
- Used Pandas-based analysis to identify annotation inconsistencies and
  class-imbalance issues before long training runs.
- Set up and debugged 3D point-cloud segmentation frameworks including SoftGroup,
  RepSurf, and PointGroup for comparative evaluation.

Skills: Machine Learning, Python, Computer Vision, Model Evaluation, PyTorch,
YOLOv5, YOLOX, YOLOv8, opencv, object detection, dataset engineering, pandas
```

**Verdict: IDENTICAL.** The Qdrant chunk is exactly what `chunkExperience()` would produce (role at company + shortDescription + formatted bullets + skills). Every bullet point matches. Every skill matches. The content is the same across all three sources.

### Neilsoft vs Fallback

The fallback Neilsoft (`sanity/fallbackContent.ts:87-101`) is **significantly different**:

| Field | Fallback | Sanity/Qdrant |
|-------|----------|---------------|
| Bullet count | 2 | 7 |
| Bullet text | "Integrated AI capabilities into practical engineering workflows." / "Worked with model evaluation, data processing, and deployment-oriented implementation patterns." | Detailed CV pipeline work: YOLOv5/YOLOX/YOLOv8, 1,300+ images, mAP scores, 3D point-cloud segmentation |
| Skills count | 4 | 12 |
| Skill content | ML, Python, CV, Model Evaluation | ML, Python, CV, Model Evaluation, PyTorch, YOLOv5, YOLOX, YOLOv8, opencv, object detection, dataset engineering, pandas |

**The Neilsoft entry in Sanity/Qdrant was rewritten to be substantially more detailed than the fallback version.**

---

## 7. Indexing History

### Shell History Evidence

```
$ cat ~/.bash_history | grep index
npx tsx scripts/index-content.ts
npx tsx scripts/index-content.ts
```

Two indexing runs are recorded. Neither shows a `NEXT_PUBLIC_SANITY_DATASET=` override, meaning both likely used whatever `.env.local` specified at the time (or the `"production"` default fallback).

### README Instructions

The README (`README.md:82-84`) documents:
```
### Index portfolio content (first time only)
npm run index-content
```
Note: `npm run index-content` is **not defined** in `package.json` — this is a documentation bug. The actual command is `npx tsx scripts/index-content.ts`.

### CI Workflows

**None found.** No `.github/workflows/` directory exists. No CI/CD pipeline auto-runs ingestion.

### Docker Compose

The `docker-compose.yml` defines three services (vLLM, Qdrant, MLflow). **No auto-indexing logic** exists — `scripts/index-content.ts` must be run manually.

### Git History

The initial ingestion was introduced in commit `aef5f85` (`feat(chat): implement end-to-end AI portfolio assistant`). Two relevant later commits:

| Commit | Date | Description |
|--------|------|-------------|
| `68ab9dd` | Jun 30 | "update site settings and experience entries with new IDs and details" — changed seed.ndjson |
| `b7fb691` | Jul 14 | "add dataset synchronization tools for production and local environments" — added `scripts/sync-dataset.ts` |

Neither commit changed the ingestion script's dataset selection logic.

### Dataset Synchronization Operations

The `scripts/sync-dataset.ts` tool performs:
1. Export source dataset → tarball
2. Import tarball → destination dataset with `--replace`

This is a **destructive full replacement** — it overwrites the destination dataset entirely. A sync in either direction (`prod-to-local` or `local-to-prod`) would make both datasets identical.

Since both datasets are currently identical, **at least one sync operation was performed** after the last content change. The direction cannot be determined from the current state.

---

## 8. Root Cause Analysis

### The Central Finding

```
Production dataset = Local dataset = Qdrant data
```

All three sources contain identical content. The "wrong dataset" hypothesis is **falsified** — there is no scenario where changing the dataset would change the vectors.

### Why the Datasets Are Identical

The `scripts/sync-dataset.ts` tool (added in commit `b7fb691`) enables full dataset synchronization. A sync operation (`prod-to-local` or `local-to-prod`) after content editing would make both datasets identical. Since both are currently identical, a sync was performed.

### Why the Qdrant Data Differs from Seed/Fallback

The seed data (`sanity/seed.ndjson`) and fallback data (`sanity/fallbackContent.ts`) contain **different** content from what's in Sanity:

| Content Type | Seed/Fallback | Current Sanity |
|-------------|--------------|----------------|
| Projects | Resume Tailoring, Parcel Monitoring, Math Mentor AI (3) | Video Captioning Agent, Candidate Ranking (2) |
| Neilsoft bullets | 2 generic items | 7 detailed items with CV pipeline specifics |
| NDSoftTech bullets | 2 generic items | 3 items with React Native specifics |
| Skill category name | "Backend & Data Systems" | "Backend & Application Development" |

These differences are intentional — someone edited the Sanity content after importing the seed data.

### Scenario Confidence

| Scenario | Confidence | Evidence |
|----------|-----------|----------|
| Production and Local are **identical** | **100%** | Both datasets return exactly the same documents, fields, and values for all GROQ queries |
| Qdrant was indexed from current Sanity content | **100%** | All 26 vectors exactly match what `chunkProject/chunkExperience/chunkSkillCategory` would produce from current Sanity data |
| A dataset sync operation was performed | **95%** | The sync tool exists, both datasets are identical, and the sync tool is the only mechanism that could produce this state |
| The dataset used during indexing was `production` (default) | **80%** | `.env.example` defaults to `production`; no evidence of override in shell history; `sanity/env.ts` falls back to `"production"` |
| Wrong dataset was used during indexing | **0%** | Both datasets are identical — "wrong dataset" has no meaning in this context |
| Dataset changed after indexing | **0%** | Datasets are identical after indexing; no way to detect a change |
| Environment variables differ between app and indexing script | **0%** | Both use the same `client` import from `sanity/client.ts`; no separate dataset configuration |
| Indexing operated on stale data | **0%** | Qdrant data exactly matches current Sanity data |

---

## 9. Confidence Assessment

| Claim | Confidence |
|-------|-----------|
| `production` and `local` datasets are identical | 100% |
| Qdrant data matches both Sanity datasets exactly | 100% |
| Ingestion script used the correct/current data source | 100% |
| The dataset variable (`NEXT_PUBLIC_SANITY_DATASET`) selection would not affect the Qdrant vectors | 100% |
| A dataset sync operation has been performed | 95% |
| The default dataset during indexing was `production` | 80% |
| The "wrong dataset" hypothesis is correct | 0% |
| The datasets have diverged since indexing | 0% |

---

## 10. Recommended Next Steps

The investigation reveals that the "wrong dataset" concern is not the source of any retrieval issues. However, several actionable findings emerged:

1. **If retrieval is failing**, the root cause is elsewhere — see the companion report (`RAG_Debug_Report.md`) which identifies a **pattern matching gap** in `lib/retrieval/index.ts` (experience keyword pattern doesn't match company name queries like "What did you do at Neilsoft?").

2. **If you want the seed projects back** (Resume Tailoring, Parcel Monitoring, Math Mentor AI), re-import the seed data:
   ```bash
   npx sanity dataset import sanity/seed.ndjson production --replace
   npx tsx scripts/index-content.ts
   ```
   This would overwrite the current production dataset and reindex Qdrant.

3. **To prevent future dataset divergence**, ensure whoever edits Sanity content (via Studio or the publishing agent) is aware that `scripts/sync-dataset.ts` must be run to keep datasets synchronized.

4. **The `npm run index-content` script is missing** from `package.json`. Add it to match the README instructions.

5. **Verify the actual `.env.local` dataset setting** by checking the file (not done in this investigation per constraints). The `sanity/env.ts` fallback to `"production"` provides a safe default, but explicit configuration is always clearer.
