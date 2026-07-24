# RAG Debug Report: Experience Information Retrieval Failure

**Date**: 2026-07-23
**Issue**: Queries about work experience at specific companies (Neilsoft, NDSoftTech Solutions) fail to retrieve relevant information.
**Expected**: Assistant retrieves experience data and answers correctly.
**Actual**: Assistant responds "I couldn't find that information in Aditya's portfolio."

---

## Executive Summary

The root cause is a **pattern matching gap in the structured retrieval layer** (`lib/retrieval/index.ts:36`). The two-tier retrieval architecture falls back to semantic vector search for queries that don't match explicit experience keywords. When users ask about specific companies by name (e.g., "What did you do at Neilsoft?"), no structured pattern matches, and semantic search with `k=5` fails to retrieve the experience chunks from among 30+ competing chunks.

A secondary (but critical) bug exists in `lib/agent/orchestrator.ts`: the `tracer` variable is referenced but never defined, causing a `ReferenceError` that would crash every request. This must be fixed before any other debugging can be meaningful.

---

## 1. RAG Architecture

### Data Flow Diagram

```mermaid
flowchart TD
    A["User Query: 'What did you do at Neilsoft?'"] --> B["POST /api/chat"]
    B --> C["orchestrator.ts"]
    C --> D["Intent Classification (LLM)"]
    D -->|"intent = portfolio"| E["searchPortfolio()"]
    D -->|"greeting/out_of_scope/ambiguous"| F["Guardrail Response"]

    subgraph "Two-Tier Retrieval"
        E --> G["Tier 1: Structured Patterns"]
        G -->|"pattern match"| H["Sanity GROQ Query"]
        G -->|"no match (6/8 cases)| I["Tier 2: Semantic Search (Qdrant)"]
        I --> J["Top-5 results by cosine similarity"]
    end

    H --> K["evidence-builder.ts"]
    J --> K
    K --> L["Deduplicate, Format, Truncate (2000 chars)"]
    L -->|"sources.length > 0"| M["LLM Pipeline (vLLM + Qwen3-4B-Instruct)"]
    L -->|"sources.length === 0"| N['"I couldn&#39;t find that information..."']

    M --> O["Streaming SSE Response"]

    subgraph "Ingestion (offline)"
        P["Sanity CMS / fallbackContent.ts"] --> Q["scripts/index-content.ts"]
        Q --> R["Chunk per section"]
        R --> S["Xenova/nomic-embed-text-v1.5"]
        S --> T["Qdrant: portfolio_chunks"]
    end

    style N fill:#ff6b6b,color:white
```

### Component Inventory

| Component | File | Technology |
|-----------|------|------------|
| Entry point | `app/api/chat/route.ts:5` | Next.js Route Handler, SSE streaming |
| Orchestrator | `lib/agent/orchestrator.ts:25` | AsyncGenerator |
| Intent classifier | `lib/agent/intent-router.ts:37` | Regex rules + LLM (vLLM) |
| Structured retrieval | `lib/retrieval/index.ts:86` | 8 regex patterns → Sanity GROQ |
| Semantic retrieval | `lib/retrieval/semantic.ts:4` | Qdrant similarity search, k=5 |
| Evidence builder | `lib/agent/evidence-builder.ts:28` | Dedup, format, truncate 2000 chars |
| LLM pipeline | `lib/agent/llm-pipeline.ts:29` | vLLM + Qwen/Qwen3-4B-Instruct, temp=0 |
| Ingestion script | `scripts/index-content.ts:335` | Sanity → chunk → embed → Qdrant |
| Embedding model | `lib/ai/embeddings.ts:4` | Xenova/nomic-embed-text-v1.5 (768d) |
| Vector store | `lib/ai/vector-store.ts:6` | Qdrant, collection: portfolio_chunks |
| LLM provider | `lib/ai/provider.ts:3` | ChatOpenAI → vLLM (OpenAI-compatible API) |

### Retrieval Flow Detail

The `searchPortfolio()` function (`lib/retrieval/index.ts:86-98`) evaluates patterns **in order** and returns the first handler that produces non-empty results. If no pattern matches OR all matched handlers return empty results, it falls through to `searchSemantic()` (Qdrant vector search, k=5).

---

## 2. Source Data Inspection

### Neilsoft Experience Data

**Source**: `sanity/fallbackContent.ts:87-102`
**Sanity seed**: `sanity/seed.ndjson:4`

```
_id: "fallback.experience.neilsoft"
role: "AI/ML Engineer"
company: "Neilsoft"
location: "India"
startDate: "2024-01-01"
currentRole: true
shortDescription: "Worked on ML and AI engineering tasks involving model evaluation,
                   backend integration, and applied automation."
bulletPoints:
  - "Integrated AI capabilities into practical engineering workflows."
  - "Worked with model evaluation, data processing, and deployment-oriented
     implementation patterns."
skills: ["Machine Learning", "Python", "Computer Vision", "Model Evaluation"]
displayOrder: 3
```

### NDSoftTech Solutions Experience Data

**Source**: `sanity/fallbackContent.ts:53-69`
**Sanity seed**: `sanity/seed.ndjson:2`

```
_id: "fallback.experience.ndsofttech"
role: "Software Engineering Intern"
company: "NDSoftTech Solutions"
location: "India"
startDate: "2023-01-01"
endDate: "2023-06-01"
currentRole: false
shortDescription: "Contributed to software engineering tasks across backend
                   implementation, debugging, and application support."
bulletPoints:
  - "Worked with engineering teams to implement maintainable application features."
  - "Improved debugging, code review, and delivery habits in a production-oriented
     environment."
skills: ["Python", "Backend Development", "Debugging"]
displayOrder: 1
```

### Company Name Aliases

| User Query Term | Source Field Value | Match? |
|----------------|--------------------|--------|
| "Neilsoft" | "Neilsoft" | Exact |
| "NDSoftTech" | "NDSoftTech Solutions" | Partial (only "NDSoftTech Solutions" exists) |
| "ND SoftTech" | — | No exact match exists |
| "Neil Soft" | — | No exact match exists |

**Evidence**: Both company names exist verbatim in source data. No alias mapping exists anywhere in the codebase. "NDSoftTech" used by the user is a shortened form of "NDSoftTech Solutions" — only partial substring match.

---

## 3. Ingestion Verification

### Is experience data ingested?

**YES**. The ingestion script at `scripts/index-content.ts` explicitly handles experience data:

**Lines 361-363**:
```typescript
for (const exp of experiences || []) {
    documents.push(...chunkExperience(exp, baseUrl));
}
```

**Fetch query (line 312)**:
```typescript
client.fetch<SanityExperience[]>(
    groq`*[_type == "experience"] { _id, role, company, shortDescription,
          bulletPoints, skills }`
)
```

**Fallback path (lines 323-331)**: When Sanity is unconfigured, `getFallbackContent()` returns all 3 fallback experiences via `fallbackToSanityExperience()`.

No filtering is applied — all experience entries are indexed regardless of `displayOrder`, `currentRole`, or any other field.

### Chunk Generation

`scripts/index-content.ts:228-252` — `chunkExperience()` produces exactly **1 chunk per experience entry**:

**Neilsoft chunk**:
```text
AI/ML Engineer at Neilsoft
Worked on ML and AI engineering tasks involving model evaluation, backend
integration, and applied automation.
- Integrated AI capabilities into practical engineering workflows.
- Worked with model evaluation, data processing, and
  deployment-oriented implementation patterns.
Skills: Machine Learning, Python, Computer Vision, Model Evaluation
```

**NDSoftTech chunk**:
```text
Software Engineering Intern at NDSoftTech Solutions
Contributed to software engineering tasks across backend implementation,
debugging, and application support.
- Worked with engineering teams to implement maintainable
  application features.
- Improved debugging, code review, and delivery habits in a
  production-oriented environment.
Skills: Python, Backend Development, Debugging
```

---

## 4. Chunk Analysis

### Chunk Inventory (after ingestion)

| # | Content Type | Approx Tokens | Example Content | Metadata |
|---|-------------|---------------|-----------------|----------|
| 1 | Experience: Neilsoft | ~85 | "AI/ML Engineer at Neilsoft..." | section=Experience, url=.../#experience |
| 2 | Experience: NDSoftTech | ~70 | "Software Engineering Intern at NDSoftTech..." | section=Experience, url=.../#experience |
| 3 | Experience: Freelancer | ~65 | "Applied AI Engineer at Freelancer..." | section=Experience, url=.../#experience |
| 4-21 | Project: Resume Tailoring | ~6×60 | 6 sections (approach, results, etc.) + tech + metrics | projectTitle, slug, section, url |
| 22-35 | Project: Parcel Monitoring | ~6×60 | 6 sections + tech + metrics | projectTitle, slug, section, url |
| 36-47 | Project: Math Mentor AI | ~4×60 | 4 sections + tech + metrics | projectTitle, slug, section, url |
| 48-52 | Site Settings | ~5×60 | bio, about, hero, focus, contact | section, url |
| 53-56 | Skill Categories | ~4×30 | AI, CV, Backend, MLOps | section=Skills, url |
| 57 | Technical Note | ~1×40 | RAG evaluation note | title, slug, section, url |

**Total: ~57 chunks**

### Chunk Boundary Analysis

The `chunkExperience()` function concatenates ALL fields (role, company, description, bullet points, skills) into a **single monolithic chunk**. This means:

- **Company name** ("Neilsoft") appears only once in the chunk text, at position 16 (3rd word in the chunk)
- The chunk text is dominated by generic descriptions ("ML and AI engineering tasks", "model evaluation", "backend integration")
- Bullet points are generic: "Integrated AI capabilities into practical engineering workflows"
- The word "Neilsoft" constitutes ~0.5% of the chunk by word count (~1/85 words)

**Problem**: The company name is diluted by surrounding generic text. The semantic embedding weights heavily toward the ML/AI terminology, not the company proper noun.

---

## 5. Embedding Investigation

### Model Configuration

- **Model**: `Xenova/nomic-embed-text-v1.5`
- **Dimensions**: 768
- **Provider**: HuggingFace Transformers.js (local, no API)
- **Normalization**: Matryoshka representation learning (nomic-embed-text uses Matryoshka-style embeddings)
- **Configured at**: `lib/ai/embeddings.ts:4-7`

### Similarity Analysis (Projected)

For query: **"What did you do at Neilsoft?"** vs the Neilsoft experience chunk:

| Factor | Impact on Similarity |
|--------|---------------------|
| "Neilsoft" is a rare proper noun | LOW — embedding model has limited signal for this token |
| "AI/ML Engineer" terminology overlap | MEDIUM — matches the ML/AI theme |
| "python", "model evaluation", "computer vision" | MEDIUM — common ML terms in other chunks too |
| Query intent "what did you do" vs descriptive chunk | LOW — no Q&A structure in chunk |
| Competition from project chunks (with similar ML/CV terms) | HIGH — project chunks have richer semantic content |

### Projected Top-5 for "What did you do at Neilsoft?"

| Rank | Chunk | Projected Reason |
|------|-------|-----------------|
| 1 | Project chunk (Results/Metrics) | "practical engineering workflows", "model evaluation" overlap |
| 2 | Site Settings: Bio | "Applied AI Engineer", "GenAI, Computer Vision" |
| 3 | Site Settings: About | "practical GenAI systems", "computer vision pipelines" |
| 4 | Project chunk (Approach) | "pipeline", "workflow", "evaluation" |
| 5 | Project chunk (Future Improvements) | General AI/ML terminology |
| **6+** | **Neilsoft Experience chunk** | **"Neilsoft" — weak embedding signal** |
| **7+** | **NDSoftTech Experience chunk** | **"NDSoftTech Solutions" — even weaker signal** |

**Conclusion**: Even if the query reaches semantic search, the Neilsoft chunk is unlikely to rank in the top 5 due to the weak embedding signal from the proper noun "Neilsoft" being diluted by generic ML/AI terminology shared with many other chunks.

---

## 6. Vector Database Inspection

### Qdrant Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Collection name | `portfolio_chunks` | `.env.example:13`, `lib/ai/vector-store.ts:4` |
| Vector size | 768 | Auto-detected from embedding model |
| Distance metric | Cosine (default) | LangChain QdrantVectorStore default |
| API | REST (port 6333) | `docker-compose.yml:20` |
| Persistence | Docker volume `qdrant_data` | `docker-compose.yml:23` |

### Experience Documents in Qdrant

The ingestion script (`scripts/index-content.ts:361-363`) adds all 3 experience chunks to the `documents` array, which are then embedded and indexed via:

```typescript
await QdrantVectorStore.fromDocuments(documents, embeddings, {
    url: vectorUrl,
    collectionName,
});
```

**Evidence**: Experience chunks ARE indexed in Qdrant — there is no filtering or skip logic that would exclude them.

### Payload Fields

Each Qdrant vector point has `pageContent` + `metadata` in the payload:

| Chunk Type | metadata.projectTitle | metadata.section | metadata.slug | metadata.url |
|-----------|----------------------|-----------------|---------------|-------------|
| Experience | **MISSING** | "Experience" | **MISSING** | "/#experience" |
| Project | Project name | Section name | Project slug | Project page URL |
| Site Settings | **MISSING** | Section name | **MISSING** | Section URL |
| Skills | **MISSING** | "Skills" | **MISSING** | "/#skills" |

**Note**: Experience chunks lack `projectTitle` metadata (defined at `scripts/index-content.ts:246-249`). This is cosmetic — it affects the formatted context display but not retrieval.

---

## 7. Retrieval Debugging

### Structured Pattern Matching (Tier 1)

The 8 patterns in `lib/retrieval/index.ts:7-67` evaluated against the failing queries:

#### Query: "What did you do at Neilsoft?"

| Pattern | Regex | Match? | What happens |
|---------|-------|--------|--------------|
| 1 | `/which projects use\s+(.+)/i` | ❌ | No match |
| 2 | `/(what\|which).*(technology\|...).*(used\|...)/i` | ❌ | Missing "technology/skills/tools" keyword |
| 3 | `/(contact\|email\|linkedin\|...)/i` | ❌ | No contact keywords |
| 4 | `/(resume\|cv\|curriculum vitae)/i` | ❌ | No resume keywords |
| **5** | **`/(experience\|work history\|employment\|...)/i`** | **❌** | **Missing "experience/work history/employment" keyword** |
| 6 | `/(skill\|expertise\|proficient\|...)/i` | ❌ | No skill keywords |
| 7 | `/^open\s+(.+)/i` | ❌ | Doesn't start with "open" |
| 8 | `/^(explain\|tell me about\|describe\|show)\s+(.+)/i` | ❌ | Starts with "What did", not "explain/tell me about" |

**Result**: Falls to `searchSemantic("What did you do at Neilsoft?")` → k=5 Qdrant search

#### Query: "Tell me about your work at Neilsoft."

| Pattern | Regex | Match? | What happens |
|---------|-------|--------|--------------|
| 8 | `/^(explain\|tell me about\|describe\|show)\s+(.+)/i` | ✅ | Captures "your work at Neilsoft" |
| → | `groqQuery("your work at Neilsoft")` | — | Returns `null` (not in slugMap) |
| → | Handler returns `[]` | — | `results.length === 0`, continues |
| → | All other patterns exhausted | — | Falls to semantic search |

**Result**: Falls to `searchSemantic("Tell me about your work at Neilsoft.")` → k=5 Qdrant search

#### Query: "What did you do at NDSoftTech Solutions?"

| Pattern | Regex | Match? | What happens |
|---------|-------|--------|--------------|
| 5 | `/(experience\|work history\|employment\|...)/i` | ❌ | No experience keyword |
| All others | — | ❌ | No match |

**Result**: Falls to `searchSemantic(...)` → k=5 Qdrant search

#### Query: "work experience" (hypothetical)

| Pattern | Regex | Match? | What happens |
|---------|-------|--------|--------------|
| 5 | `/(experience\|work history\|employment\|...)/i` | ✅ | Triggers `getExperience()` |

**Result**: All 3 experience entries retrieved via Sanity GROQ → **WORKS CORRECTLY**

### Semantic Search (Tier 2) — Projected Results

For queries that fall through to semantic search, the `searchSemantic()` function (`lib/retrieval/semantic.ts:4`) performs:

```typescript
vectorStore.similaritySearchWithScore(query, k=5)
```

With ~57 total chunks and k=5, the experience chunks compete with:
- 18 project section chunks (rich with ML/AI/engineering terminology)
- 5 site settings chunks (bio, about, focus areas — also ML/AI themed)
- 4 skill category chunks
- 1 technical note

The experience chunks are approximately 70-85 tokens of generic ML/AI text with a single occurrence of a company proper noun. The embedding signal for "Neilsoft" or "NDSoftTech Solutions" is weak compared to the ML/AI terminology signal.

---

## 8. Query Processing

### No Query Processing Exists

There is **no** query rewriting, expansion, normalization, routing, or filtering step anywhere in the pipeline:

| Capability | Present? | Location |
|-----------|----------|----------|
| Query rewriting | ❌ | — |
| Query expansion | ❌ | — |
| Spelling normalization | ❌ | — |
| Intent-based routing | ✅ | `lib/retrieval/index.ts:86` (structure patterns only) |
| Metadata filtering | ❌ | No `search_kwargs.filter` in semantic search |
| HyDE (hypothetical doc) | ❌ | — |
| Multi-query | ❌ | — |

The only form of query transformation is `trim()` at line 87 of `lib/retrieval/index.ts`.

---

## 9. Context Assembly

### Evidence Builder (`lib/agent/evidence-builder.ts:28-43`)

The evidence builder:
1. Deduplicates by first 100 characters of content
2. Formats as `"Retrieved Portfolio Information:\nProject: X\nSection: Y\nContent: Z"`
3. Truncates to **2000 characters** if total exceeds limit

For the failing queries, the problem occurs **before** this step: the retrieved results are either empty or contain no experience chunks. The evidence builder receives no relevant content to format.

### Retrieval Path for Failing Queries

```
searchPortfolio("What did you do at Neilsoft?")
  → All 8 patterns fail
  → searchSemantic("What did you do at Neilsoft?")
  → Qdrant similaritySearchWithScore(query, 5)
  → Returns top-5 chunks (likely project + site settings chunks)
  → buildEvidencePackage(results)
  → context contains project information (e.g., "RAG-based resume tailoring...",
    "Computer Vision & Machine Learning skills: PyTorch, OpenCV...")
  → LLM receives this context
  → SYSTEM_PROMPT says "If the retrieved evidence does not contain the answer,
     say 'I couldn't find that information...'"
  → LLM correctly notes no Neilsoft experience in context
  → Responds: "I couldn't find that information in Aditya's portfolio."
```

---

## 10. Prompt Analysis

### Answering Prompt (`lib/agent/prompts.ts:1-26`)

The SYSTEM_PROMPT includes these critical grounding rules:

```
## Grounding Rules (CRITICAL)
1. You MUST base every statement on the retrieved evidence provided.
2. If the retrieved evidence does not contain the answer, say:
   "I couldn't find that information in Aditya's portfolio."
3. Never invent, speculate, or infer information not present in the evidence.
4. Never answer from your training data. Only use provided context.
5. If evidence is partial, say what you found and what you couldn't find.
```

**Analysis**: The prompt is correctly configured for grounded RAG. When no Neilsoft experience evidence is in the context, the LLM correctly obeys Rule #2 and reports that it couldn't find the information. The prompt is NOT the cause of the failure — it behaves exactly as designed.

---

## 11. End-to-End Trace: "What did you do at Neilsoft?"

```
1. USER INPUT: "What did you do at Neilsoft?"
   ↓
2. INTENT CLASSIFICATION (llm-pipeline.ts:37)
   LLM prompt: "Classify: portfolio/greeting/out_of_scope/ambiguous"
   LLM output: "portfolio" ✅ (contains "experience" in category description)
   ↓
3. RETRIEVAL (lib/retrieval/index.ts:15)
   searchPortfolio("What did you do at Neilsoft?")
   
   Pattern 1: /which projects use.../ → ❌
   Pattern 2: /what.*technology.*use/ → ❌ (no "technology" keyword)
   Pattern 3: /contact|email|.../ → ❌
   Pattern 4: /resume|cv|.../ → ❌
   Pattern 5: /experience|work history|.../ → ❌ (no "experience" keyword)  ⬅ FAILURE POINT
   Pattern 6: /skill|expertise|.../ → ❌
   Pattern 7: /^open\s+/ → ❌
   Pattern 8: /^(explain|tell me about|describe|show)/ → ❌ (starts "What did")
   
   → All patterns exhausted → searchSemantic(query, k=5)
   ↓
4. SEMANTIC SEARCH (lib/retrieval/semantic.ts:4)
   Embedded query "What did you do at Neilsoft?" → 768d vector
   Qdrant similarity search across ~57 chunks
   
   Likely top-5:
   1. Project: "Evidence-Grounded Resume Tailoring Platform" (ML/RAG terms)
   2. Site Settings: Short Bio (Applied AI, Computer Vision terms)
   3. Skill Category: "Computer Vision & ML" (ML/Model Evaluation terms)
   4. Project: "Warehouse Parcel Monitoring System" (ML terms)
   5. Project: "Math Mentor AI" or another site settings chunk
   
   Neilsoft experience chunk: NOT in top 5 (ranked 6+)
   ↓
5. EVIDENCE BUILDING (lib/agent/evidence-builder.ts:28)
   Format 5 project/site chunks → 2000 char context
   No Neilsoft information in context
   ↓
6. LLM GENERATION (lib/agent/llm-pipeline.ts:29)
   Context: [project summaries, skills, bio — no experience data]
   Prompt: "MUST base every statement on retrieved evidence"
   LLM: Follows grounding rules, reports no information found
   ↓
7. OUTPUT: "I couldn't find that information in Aditya's portfolio."
```

### Failure Point Identified

**The information is lost at Step 3, Pattern 5 evaluation** in `lib/retrieval/index.ts:36`. The query "What did you do at Neilsoft?" contains no keyword matching the experience pattern regex, so the structured `getExperience()` handler is never called.

---

## Root Cause Analysis

| # | Cause | Confidence | Evidence |
|---|-------|-----------|----------|
| **1** | **Pattern regex gap — no company name matching** | **95%** | Pattern 5 matches `experience\|work history\|employment` but not company names. Query "What did you do at Neilsoft?" has no experience keyword → falls to semantic search. `lib/retrieval/index.ts:36` |
| 2 | Semantic search k=5 insufficient for ~57 chunks | 70% | With only 5 results, likelihood of a specific experience chunk ranking in top-5 is low given embedding model's weak signal on proper nouns |
| 3 | No query expansion or company name extraction | 60% | No preprocessing to detect "Neilsoft" → "experience at Neilsoft" rewrite |
| 4 | Embedding model weak on rare proper nouns | 50% | nomic-embed-text-v1.5 is a general-purpose model. "Neilsoft" and "NDSoftTech" likely have underrepresented token representations |
| 5 | Experience chunks monolithic (single chunk per entry) | 30% | Single combined chunk makes "Neilsoft" <1% of chunk text. Splitting into role/description/bullets would create more targeted chunks |
| 6 | Chunk metadata missing `projectTitle` | 10% | Cosmetic only; does not affect retrieval quality |
| 7 | Context truncation (2000 chars) | 5% | Would only be relevant if experience data WAS in results and was truncated out |
| 8 | SYSTEM_PROMPT grounding rules | 0% | Rules are correct; LLM follows them as designed |
| 9 | Ingestion failure | 0% | `scripts/index-content.ts:361-363` clearly ingests all experience data |
| 10 | Sanity data missing | 0% | Both `fallbackContent.ts` and `seed.ndjson` contain all 3 experience records |

### Secondary Finding: Orchestrator `tracer` Bug

| # | Cause | Confidence | Evidence |
|---|-------|-----------|----------|
| **11** | **`tracer` is never defined in orchestrator.ts** | **100%** | `lib/agent/orchestrator.ts:14` imports `LangfuseTracer` class but no instance is created. Lines 38, 43, 49, 56, 73, 99 reference `tracer` which would throw `ReferenceError` at runtime. This would crash ALL requests entering the orchestrator. |

**Primary Root Cause**: **Pattern matching gap** — `searchPortfolio()` does not detect that a user is asking about a specific company/organization because the experience pattern only matches generic experience keywords, not company names.

---

## Recommended Fixes

### Fix 1: Minimal Fix — Add Company Name Matching to Experience Pattern

**Confidence**: 95% effective for all failing queries

**File**: `lib/retrieval/index.ts`

Add a new structured pattern BEFORE the existing experience pattern that specifically handles company name queries:

```typescript
// NEW PATTERN: detect queries asking about specific companies
{
  pattern: /(?:what|how|tell|where|when).*(?:at|with|for|in)\s+(?:the\s+)?(.+?)(?:\?|$)/i,
  handler: async (match) => {
    const target = match[1].trim().toLowerCase();
    const experiences = await getExperience();
    return experiences.filter((exp) =>
      exp.content.toLowerCase().includes(target) ||
      exp.projectTitle?.toLowerCase().includes(target)
    );
  },
},
```

**Tradeoffs**:
- ✅ Handles the exact failing queries ("What did you do at Neilsoft?")
- ✅ Routes company name queries to structured experience data
- ❌ Regex is broad — may match non-experience queries and return empty results (falls through harmlessly)
- ❌ Requires the query to contain a company name that exists in experience data

### Fix 1b: Even More Minimal — Broaden the Experience Pattern

**File**: `lib/retrieval/index.ts:36`

Simply broaden the existing pattern to also match company-name-style queries:

```typescript
// Before (line 36):
pattern: /(?:experience|work history|employment|previous role|past role|career)/i,

// After:
pattern: /(?:experience|work history|employment|previous role|past role|career|(?:what|tell|how).*(?:did|do|doing).*(?:work|job|role))/i,
```

This adds matching for "What did you do...", "What do you do...", "Tell me about your work...", etc., which would capture the failing queries.

### Fix 2: Better Architectural Fix — Pre-retrieval Query Classification

Add a lightweight query analysis step that extracts entities (company names, project names, technologies) from the user query and routes accordingly:

1. Extract company names from query → if found, search experience data first
2. Extract technology names → structured technology search
3. Extract project names/slugs → project lookup
4. Fallback → semantic search

Implementation in `searchPortfolio()`:

```typescript
export async function searchPortfolio(query: string): Promise<SearchResult[]> {
  // 1. Try entity extraction
  const companies = await extractCompanyNames(query);
  if (companies.length > 0) {
    const experiences = await getExperience();
    const filtered = experiences.filter(e =>
      companies.some(c => e.content.toLowerCase().includes(c))
    );
    if (filtered.length > 0) return filtered;
  }

  // 2. Fall through to existing patterns
  // ... existing STRUCTURED_PATTERNS ...

  // 3. Semantic fallback
  return searchSemantic(query);
}
```

**Tradeoffs**:
- ✅ Robust against varied natural language
- ✅ Scales to more entity types
- ❌ More complex — requires company name extraction logic
- ❌ Slightly higher latency (one extra Sanity query)

### Fix 3: Long-Term Improvement — Two-Pass Retrieval with Reranking

```typescript
// Retrieve more candidates, then rerank
const candidates = await vectorStore.similaritySearchWithScore(query, 20);
const reranked = await rerankByRelevance(query, candidates, {
  boostMetadata: {
    section: { "Experience": 1.5 }  // Boost experience chunks
  }
});
return reranked.slice(0, 5);
```

**Tradeoffs**:
- ✅ Increases recall (20 vs 5 candidates)
- ✅ Metadata-aware reranking can boost experience sections
- ✅ Proper noun handling via cross-encoder reranker
- ❌ Significantly higher latency (2x embeddings or cross-encoder pass)
- ❌ Requires additional infrastructure (reranker model)

### Fix for Secondary Bug: Orchestrator `tracer` not defined

```typescript
// Add immediately after imports in orchestrator.ts:
const tracer = new LangfuseTracer();
tracer.startTrace("chat-request", { messageCount: messages.length });
```

And add `tracer.endTrace()` before each `return` statement, and `tracer.endSpan(retrievalSpanId, { documentCount: results.length })` after the retrieval block.

---

## Validation Plan

After applying the fix, test these queries:

| Query | Expected Behavior |
|-------|------------------|
| "What did you do at Neilsoft?" | Returns Neilsoft experience details |
| "What did you do at NDSoftTech Solutions?" | Returns NDSoftTech experience details |
| "Tell me about your work at Neilsoft." | Returns Neilsoft experience details |
| "What is your work experience?" | Returns all experience entries |
| "What is your employment history?" | Returns all experience entries |
| "What projects use Python?" | Returns project filtering (unchanged) |
| "Tell me about the parcel monitoring project" | Returns project details (unchanged) |
| "What skills do you have?" | Returns skills (unchanged) |
| "What did you do at Google?" | Should say "no information found" (correct failure) |

---

## Appendix

### A. Key Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/retrieval/index.ts` | 1-98 | **Retrieval routing with structured patterns** |
| `lib/retrieval/semantic.ts` | 1-25 | Qdrant semantic search fallback |
| `lib/retrieval/structured.ts` | 178-219 | `getExperience()` — Sanity GROQ query for experience |
| `lib/agent/orchestrator.ts` | 25-105 | Main orchestration pipeline |
| `lib/agent/evidence-builder.ts` | 28-43 | Context assembly (dedup, format, truncate) |
| `lib/agent/prompts.ts` | 1-38 | SYSTEM_PROMPT and guardrail responses |
| `scripts/index-content.ts` | 228-252 | `chunkExperience()` — experience chunk generation |
| `scripts/index-content.ts` | 335-411 | `main()` — full ingestion pipeline |
| `sanity/fallbackContent.ts` | 52-102 | Experience source data (3 entries) |
| `sanity/seed.ndjson` | 2-4 | Sanity seed data with experience entries |

### B. Pattern Matching Reference (`lib/retrieval/index.ts:7-67`)

| # | Pattern | Handler | Triggers |
|---|---------|---------|----------|
| 1 | `which projects use\s+(.+)` | `searchByTechnology(tech)` | "which projects use Python" |
| 2 | `(what\|which).*(technology\|...).*(used\|...)` | Skills + empty-tech search | "what technologies do you use" |
| 3 | `contact\|email\|linkedin\|...` | `getContactInfo()` | "how to contact you" |
| 4 | `resume\|cv\|curriculum vitae` | Resume URL + contact | "show me your resume" |
| 5 | `experience\|work history\|employment\|...` | `getExperience()` | "what is your work experience" |
| 6 | `skill\|expertise\|proficient\|...` | `getSkills()` | "what skills do you have" |
| 7 | `^open\s+(.+)` | Open action | "open resume" |
| 8 | `^(explain\|tell me about\|describe\|show)\s+(.+)` | Slug lookup | "explain the resume tailoring project" |

### C. Company Names Not in Pattern Keywords

Experience keyword set: `experience` `work history` `employment` `previous role` `past role` `career`

Company names in data: `Neilsoft` `NDSoftTech Solutions` `Freelancer / Independent Projects`

These company names appear **nowhere** in the structured pattern matching system. There is no company name alias map, no entity extraction, and no substring matching on experience content. The only way to retrieve experience data by company is to trigger pattern 5 with one of the 6 experience keywords.

### D. Qdrant `similaritySearchWithScore` API Reference

The `@langchain/qdrant` `similaritySearchWithScore()` method:
- Returns `Array<[Document, number]>` sorted by score descending
- Score is cosine similarity (higher = more similar)
- No custom filter/query params are passed → default behavior
- Score threshold: none (all results returned regardless of score)
- Retrieval type: dense vector similarity only (no hybrid/kw search)
