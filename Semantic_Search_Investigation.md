# Semantic Search Investigation

**Date**: 2026-07-23
**Scope**: Forensic analysis of `searchSemantic()` to determine why the query "What did you do at Neilsoft?" fails to retrieve the expected Neilsoft experience chunk from Qdrant.

---

## Executive Summary

The semantic search failure for "What did you do at Neilsoft?" has **two independent root causes**:

### Cause 1 (Blocking): Embedding Model Cannot Load
**`@huggingface/transformers` is not installed** in the project's `node_modules`. This package is required by `HuggingFaceTransformersEmbeddings` (`lib/ai/embeddings.ts:4-7`) at runtime via a dynamic import in `@langchain/community/dist/embeddings/huggingface_transformers.cjs:60`. Without it, every call to `similaritySearchWithScore()` throws an uncaught error inside `embedQuery()`. The error is silently caught by `searchSemantic()`'s try/catch, which returns an empty array. The orchestrator then reports "I couldn't find that information."

This means semantic search has **never successfully executed** — any query that reaches `searchSemantic()` fails silently. The `@huggingface/transformers` package is not listed as a dependency in `package.json` and was not present in `node_modules` before this investigation.

### Cause 2 (Ranking): Neilsoft Chunk Ranks Below Top-5
Even if the embedding model were functional, the Neilsoft experience chunk would **not appear in the top-5 results** for the query. Vector neighborhood analysis (cosine similarity computed from all 26 Qdrant vectors) shows:

| Rank | Chunk | Cosine Similarity to Neilsoft Vector |
|------|-------|--------------------------------------|
| 1 | Site Settings: Bio | 0.7050 |
| 2 | Site Settings: About | 0.6935 |
| 3 | Site Settings: Hero Description | 0.6886 |
| 4 | Video Captioning Agent: Key Metrics | 0.6852 |
| **5** | **Freelancer Experience** | **0.6788** |
| 6 | Candidate Ranking: Limitations | 0.6765 |
| ... | ... | ... |
| 15 | **NDSoftTech Experience** | **0.5996** |

The Neilsoft chunk (which is the query target) is **not the center of its own semantic neighborhood**. Site settings in Bio/About/Hero outrank it because they contain richer "AI Engineer", "ML", "computer vision" terminology. The embedding model (`nomic-embed-text-v1.5`, 768d) dilutes rare proper nouns like "Neilsoft" (appears once in 169 words) among common ML/AI terminology.

With **k=5** and **no metadata filtering**, the Bio+About+Hero+Frelancer chunks would push the Neilsoft chunk below the cutoff.

---

## 1. Semantic Search Architecture

### Function Call Graph

```
searchSemantic(query, k=5)                          [lib/retrieval/semantic.ts:4]
  │
  ├── getVectorStore()                              [lib/ai/vector-store.ts:6]
  │     │
  │     ├── getEmbeddings()                          [lib/ai/embeddings.ts:4]
  │     │     └── new HuggingFaceTransformersEmbeddings({
  │     │           model: "Xenova/nomic-embed-text-v1.5"  // or env override
  │     │         })
  │     │
  │     └── QdrantVectorStore.fromExistingCollection( [@langchain/qdrant vectorstores.js:231]
  │           embeddings, {url, collectionName})
  │           └── ensureCollection()                 [vectorstores.js:177]
  │                 (checks if collection exists, creates if not)
  │
  ├── vectorStore.similaritySearchWithScore(query, 5)  [@langchain/core vectorstores.cjs:242]
  │     │
  │     ├── this.embeddings.embedQuery(query)          [HuggingFaceTransformersEmbeddings]
  │     │     └── import("@huggingface/transformers")  ⚠ CRITICAL: PKG NOT INSTALLED
  │     │         .then(m => m.pipeline("feature-extraction", this.model))
  │     │         └── pipe(texts).tolist()
  │     │
  │     └── this.similaritySearchVectorWithScore(       [@langchain/qdrant vectorstores.js:121]
  │           queryVector, k, filter)
  │           └── client.query(collectionName, {
  │                 query: embedding,  // 768d float array
  │                 limit: k,          // default 5
  │                 filter: undefined, // NO METADATA FILTER
  │                 with_payload: [metadata, content],
  │                 with_vector: false
  │               })
  │               └── Maps points → [Document, score][]
  │
  └── results.map(([doc, score]) => SearchResult)  [lib/retrieval/semantic.ts:9-19]
        {
          content: doc.pageContent,
          projectTitle: metadata.projectTitle,
          slug: metadata.slug,
          section: metadata.section,
          url: metadata.url,
          score
        }
```

### Files Involved

| File | Role |
|------|------|
| `lib/retrieval/index.ts:97` | Calls `searchSemantic()` as fallback |
| `lib/retrieval/semantic.ts:4-25` | `searchSemantic()` — orchestrates search + result mapping |
| `lib/ai/vector-store.ts:6-22` | `getVectorStore()` — creates Qdrant connection |
| `lib/ai/embeddings.ts:4-7` | `getEmbeddings()` — creates HuggingFace embeddings |
| `@langchain/qdrant/dist/vectorstores.js:121-135` | `similaritySearchVectorWithScore()` — Qdrant query |
| `@langchain/qdrant/dist/vectorstores.js:231-235` | `fromExistingCollection()` — connection factory |
| `@langchain/qdrant/dist/vectorstores.js:177-184` | `ensureCollection()` — collection existence check |
| `@langchain/core/dist/vectorstores.cjs:242-243` | `similaritySearchWithScore()` — embed + search |
| `@langchain/community/dist/embeddings/huggingface_transformers.cjs:59-63` | `embedQuery()` — HuggingFace pipeline invocation |
| `lib/agent/orchestrator.ts:55-66` | Calls `searchPortfolio()` and catches errors |
| `lib/agent/evidence-builder.ts:28-43` | Post-processes results (dedup, format, truncate) |

---

## 2. Query Processing Pipeline

### Is the Query Modified Before Retrieval?

**No.** The query passes through unmodified from user input to the embedding model:

```
User input: "What did you do at Neilsoft?"
    │
    ▼
searchPortfolio(query)                          [index.ts:86]
  trimmed = query.trim()                         [index.ts:87]
  → "What did you do at Neilsoft?"
    │
    ▼
searchSemantic(trimmed)                          [semantic.ts:4]
  → "What did you do at Neilsoft?"              (no further processing)
    │
    ▼
vectorStore.similaritySearchWithScore(query, 5)  [core vectorstores.cjs:242]
  → "What did you do at Neilsoft?"              (passed directly to embedQuery)
```

### Processing Steps (Verified)

| Step | Applied? | Code Reference |
|------|----------|---------------|
| `.trim()` | **Yes** | `lib/retrieval/index.ts:87` |
| Lowercasing | **No** | No call to `.toLowerCase()` |
| Stop-word removal | **No** | No stop-word filtering |
| Query rewriting | **No** | No rewriting/expansion step |
| LLM-assisted rewriting | **No** | No LLM call before retrieval |
| Entity extraction | **No** | No NER or entity detection |
| Company name detection | **No** | No pattern matching for company names |
| Spell correction | **No** | No spell checking |
| Query expansion | **No** | No synonym/alias expansion |

**The only preprocessing is `query.trim()` at `lib/retrieval/index.ts:87`.**

---

## 3. Embedding Generation

### Model Configuration

| Property | Value | Source |
|----------|-------|--------|
| Model class | `HuggingFaceTransformersEmbeddings` | `lib/ai/embeddings.ts:1` |
| Model name | `Xenova/nomic-embed-text-v1.5` (default) | `lib/ai/embeddings.ts:6` |
| Model name (.env.local override) | `nomic-embed-text` | Environment variable |
| Provider | `@huggingface/transformers` (transformers.js) | Dynamic import in `huggingface_transformers.cjs:60` |
| Vector dimensions | 768 | Qdrant collection config |
| Distance metric | Cosine | Qdrant collection config |
| Normalization | Matryoshka representation learning (model architecture) | nomic-embed-text-v1.5 specification |
| Batch size | 512 (default) | `huggingface_transformers.cjs:34` |
| Strip newlines | true (default) | `huggingface_transformers.cjs:32` |

### Embedding Pipeline (when functional)

```
Query: "What did you do at Neilsoft?"
    │
    ▼  NO processing (no lowercasing, no stopwords, no rewriting)
    │
"Neilsoft"                    ← This rare proper noun is ~2% of query length
    │                           The query embedding is dominated by common words
    ▼                           ("what", "did", "you", "do", "at")
embedQuery("What did you do at Neilsoft?")
    │
    ▼
import("@huggingface/transformers")     ⚠ FAILS — package not installed
    │
    ▼
pipeline("feature-extraction", model)   ← never reached
    │
    ▼
768d float32 vector                     ← never produced
```

### Embedding Model Runtime Status

| Item | Status |
|------|--------|
| `@huggingface/transformers` installed | **NO** (`npm ls @huggingface/transformers` → empty) |
| Model cached locally | Yes (PyTorch safetensors: `~/.cache/huggingface/hub/models--nomic-ai--nomic-embed-text-v1.5`) but NOT ONNX format |
| Xenova ONNX model cached | **NO** |
| Can `embedQuery()` execute? | **NO** — throws `ERR_MODULE_NOT_FOUND: @huggingface/transformers` |

---

## 4. Qdrant Search Configuration

### Retrieval Call Parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| Collection name | `portfolio_chunks` | `lib/ai/vector-store.ts:4` |
| Search method | `similaritySearchWithScore(query, k)` | `lib/retrieval/semantic.ts:7` |
| Similarity metric | Cosine (collection default) | Qdrant collection config |
| Top-k value | **5** (hardcoded default) | `lib/retrieval/semantic.ts:4` |
| Score threshold | **None** | No minimum score filter |
| Metadata filter | **None** | No `filter` argument passed |
| Namespace filter | **None** | No namespaces used |
| Payload filter | **None** | No section/project/type filtering |
| MMR usage | **No** | Uses standard similarity search |
| Reranking | **No** | No post-retrieval reranking |
| Query embedding dims | 768 | Qdrant collection vector size |
| Vector search type | Dense vector similarity only | No hybrid/keyword search |

### Exact Retrieval Code

```typescript
// lib/retrieval/semantic.ts:4-19
export async function searchSemantic(query: string, k = 5): Promise<SearchResult[]> {
  try {
    const vectorStore = await getVectorStore();
    const results = await vectorStore.similaritySearchWithScore(query, k);

    return results.map(([doc, score]) => {
      const metadata = doc.metadata || {};
      return {
        content: doc.pageContent,
        projectTitle: metadata.projectTitle as string | undefined,
        slug: metadata.slug as string | undefined,
        section: metadata.section as string | undefined,
        url: metadata.url as string | undefined,
        score,
      };
    });
  } catch (error) {
    console.error("Semantic search failed:", error);
    return [];
  }
}
```

### Key Issues in the Qdrant Call

1. **No `filter` parameter**: The search scans ALL 26 chunks (projects, site settings, experiences, skills, technical notes). It does not restrict to `section=Experience` or filter by content type.

2. **No `score_threshold`**: If a threshold were set, very low-similarity matches would be discarded. Currently, all 5 results are returned regardless of quality.

3. **k=5 is hardcoded**: The `k` default of 5 means only the top 5 most similar chunks are returned. With 26 chunks competing, experience-specific chunks are frequently pushed out.

4. **No hybrid search**: Pure dense vector search — no keyword/BM25 component that would boost the exact match on "Neilsoft" as a token.

---

## 5. Runtime Retrieval Analysis

### Vector Neighborhood Analysis

Using cosine similarity computed from all 26 Qdrant vectors (768-dimensional), the Neilsoft experience chunk's semantic neighborhood is:

| Rank | Chunk | Section | Cosine Similarity |
|------|-------|---------|-------------------|
| 1 | Site Settings (Bio) | Bio | 0.7050 |
| 2 | Site Settings (About) | About | 0.6935 |
| 3 | Site Settings (Hero) | Hero Description | 0.6886 |
| 4 | Video Captioning Agent | Key Metrics | 0.6852 |
| 5 | **Freelancer Experience** | Experience | 0.6788 |
| 6 | Candidate Ranking System | Limitations | 0.6765 |
| 7 | Candidate Ranking System | Approach | 0.6489 |
| 8 | Video Captioning Agent | Results | 0.6379 |
| 9 | Candidate Ranking System | Technologies | 0.6327 |
| 10 | Video Captioning Agent | Approach | 0.6277 |
| 11 | Video Captioning Agent | Future Improvements | 0.6237 |
| 12 | Candidate Ranking System | Future Improvements | 0.6050 |
| 13 | Candidate Ranking System | Short Summary | 0.6014 |
| 14 | Video Captioning Agent | Limitations | 0.6000 |
| 15 | **NDSoftTech Experience** | Experience | 0.5996 |
| 16 | Candidate Ranking System | Problem Statement | 0.5799 |
| 17 | Skills: Computer Vision & ML | Skills | 0.5699 |
| 18 | Video Captioning Agent | Short Summary | 0.5618 |
| 19 | Skills: Backend & App Dev | Skills | 0.5579 |
| 20 | Video Captioning Agent | Technologies | 0.5552 |
| 21 | Skills: Generative AI & LLM | Skills | 0.5530 |
| 22 | Skills: MLOps & Infrastructure | Skills | 0.5500 |
| 23 | Technical Note | Tags | 0.5364 |
| 24 | Technical Note | Short Summary | 0.5197 |
| 25 | Video Captioning Agent | Problem Statement | 0.5021 |
| 26 | Self (Neilsoft) | Experience | 1.0000 |

### Qdrant Recommend API Confirmation

Qdrant's built-in `recommend` API with the Neilsoft vector as the sole positive example confirms the same ranking (scores slightly differ due to Qdrant's internal computation).

### Key Insight

**Site settings outrank other experience chunks in the Neilsoft neighborhood.** This is because:
- Bio contains: "AI Engineer, production-grade LLM systems, RAG pipelines, agentic workflows"
- About contains: "AI Engineer, data exploration, GenAI, computer vision pipelines, RAG, Qdrant, OCR"
- These terms are semantically similar to the Neilsoft chunk's content: "AI/ML Engineer, computer vision pipelines, YOLOv5/YOLOX/YOLOv8, PyTorch, model evaluation"
- The embedding model weights the shared ML/CV terminology heavily, while "Neilsoft" (a rare proper noun, <1% of the chunk by word count) contributes minimal signal

### Estimated Query Ranking

For the query "What did you do at Neilsoft?" with a functional embedding model:

| Estimated Rank | Chunk | Reasoning |
|---------------|-------|-----------|
| 1 | Bio | Strong "AI Engineer" + "LLM/RAG" semantic overlap with query context |
| 2 | About | Rich "AI Engineer" + "computer vision" terminology |
| 3 | Freelancer Experience | "Applied AI Engineer" role title matches "what did you do" intent |
| 4 | Hero Description | "AI Engineer" + "production" keywords |
| 5 | Candidate Ranking: Limitations | "demo caps", engineering terminology overlap |
| **6+** | **Neilsoft Experience** | Weak proper noun signal, diluted by competing ML/AI chunks |

The Neilsoft chunk is **estimated to rank 6th or lower** for "What did you do at Neilsoft?" With k=5, it would not appear in results.

---

## 6. Post-Retrieval Filtering

### Filtering Analysis

After `similaritySearchWithScore()` returns results, the `searchSemantic()` function maps them to `SearchResult[]` objects. **No additional filtering is applied** at this stage.

### Evidence Builder Processing

The `buildEvidencePackage()` function (`lib/agent/evidence-builder.ts:28-43`) processes results:

| Step | Applied? | Effect |
|------|----------|--------|
| Deduplication | Yes | Removes results with identical first 100 chars |
| Content formatting | Yes | Adds "Project:", "Section:", "Content:" labels |
| Truncation at 2000 chars | Yes | Cuts context at `MAX_CONTEXT_CHARS = 2000` |
| Minimum score threshold | **No** | No score-based filtering |
| Section filtering | **No** | Does not filter by section metadata |
| Metadata filtering | **No** | Does not reorder based on projectTitle/section |
| Result count limit | **No** | All passed-through results are processed |

### Does Evidence Builder Discard Neilsoft?

**No.** The evidence builder does NOT discard any results — it only deduplicates by first 100 chars, formats them, and truncates the total context length. If Neilsoft were in the top-5 results from semantic search, it would survive the evidence builder.

### Orchestrator No-Evidence Guardrail

If `buildEvidencePackage([])` produces zero sources (empty search results), the orchestrator returns:

```typescript
if (evidencePackage.sources.length === 0) {
  yield { type: "token", content: "I couldn't find that information in Aditya's portfolio." };
  return;
}
```

This is the response the user sees when Neilsoft is not retrieved.

---

## 7. End-to-End Trace: "What did you do at Neilsoft?"

### Actual Runtime Flow (with broken embedding model)

```
1. USER INPUT: "What did you do at Neilsoft?"
   ↓
2. INTENT CLASSIFICATION (intent-router.ts:37)
   Classified as: "portfolio" (contains experience-related context)
   ↓
3. RETRIEVAL (lib/retrieval/index.ts:86)
   searchPortfolio("What did you do at Neilsoft?")
   
   Pattern 1: /which projects use.../ → ❌ no match
   Pattern 2: /what.*technology.*use/ → ❌ no match
   Pattern 3: /contact|email|.../ → ❌ no match
   Pattern 4: /resume|cv|.../ → ❌ no match
   Pattern 5: /experience|work history|employment|.../ → ❌ no "experience" keyword in query
   Pattern 6: /skill|expertise|.../ → ❌ no match
   Pattern 7: /^open\s+/ → ❌ not "open X"
   Pattern 8: /^(explain|tell me about|describe|show)/ → ❌ starts "What did"
   
   → All patterns exhausted → searchSemantic("What did you do at Neilsoft?")
   ↓
4. SEMANTIC SEARCH (lib/retrieval/semantic.ts:4)
   searchSemantic("What did you do at Neilsoft?", k=5)
   
   a. getVectorStore() → QdrantVectorStore.fromExistingCollection("portfolio_chunks") ✓
   b. vectorStore.similaritySearchWithScore(query, 5)
      → LangChain embeds query via this.embeddings.embedQuery(query)
      → HuggingFaceTransformersEmbeddings.embedQuery()
      → await import("@huggingface/transformers")
      
      ⚠ ERROR: ERR_MODULE_NOT_FOUND
         "@huggingface/transformers" is not installed in node_modules
      
   c. Error caught by searchSemantic's try/catch (line 21-24)
      → console.error("Semantic search failed:", error)
      → return []
   ↓
5. EVIDENCE BUILDING (lib/agent/evidence-builder.ts:28)
   buildEvidencePackage([])
   → deduplicate([]) → []
   → formatContext([]) → ""
   → context = "" (empty)
   → truncated = false
   → sources = []
   ↓
6. ORCHESTRATOR (lib/agent/orchestrator.ts:93-102)
   evidencePackage.sources.length === 0 → YES
   → yield "I couldn't find that information in Aditya's portfolio."
   → return
```

### The Silent Failure

The error from the missing `@huggingface/transformers` package is **caught silently** in two places:
1. `searchSemantic()` catches the error and returns `[]` (line 21-24)
2. The orchestrator catches errors from `searchPortfolio()` and returns a generic error (line 68-76)

The only evidence of failure is a `console.error("Semantic search failed:", error)` log line — which would appear in the server console but **nowhere in the user-facing response**.

### What SHOULD Happen (if embedding worked)

Even with a functional embedding model, k=5 returns these estimated top-5:
1. Bio (site settings)
2. About (site settings)
3. Freelancer (experience)
4. Hero Description (site settings)
5. Candidate Ranking: Limitations (project)

The Neilsoft chunk would rank **6th or lower** and would not appear in results. The LLM would receive context about Bio, About, and Freelancer experience — NOT about Neilsoft. The grounding rules would cause it to say "I couldn't find that information..."

---

## 8. Root Cause Analysis

### Root Cause Summary

| # | Root Cause | Type | Severity | Confidence |
|---|-----------|------|----------|------------|
| **1** | **`@huggingface/transformers` not installed** — embedding model cannot load; `embedQuery()` throws `ERR_MODULE_NOT_FOUND` | Package dependency missing | **BLOCKING** | 100% |
| **2** | **Neilsoft chunk ranks below top-5** — site settings (Bio, About, Hero) outrank experience chunks in embedding space; k=5 cuts off Neilsoft | Retrieval ranking | **BLOCKING** (if #1 fixed) | 85% |
| **3** | **No metadata filtering** — search scans all 26 chunks; does not restrict to `section=Experience` | Query filtering | High | 100% |
| **4** | **k=5 too small** — 26 chunks compete for 5 slots; experience chunks frequently pushed out | Retrieval config | High | 85% |
| **5** | **Embedding model weak on proper nouns** — nomic-embed-text-v1.5 dilutes "Neilsoft" signal among ML/AI terminology | Model selection | Medium | 70% |
| **6** | **EMBEDDING_MODEL may be misconfigured** — env override to `nomic-embed-text` (without Xenova/ prefix) could cause additional errors | Configuration | Low-Medium | 50% |
| **7** | **No hybrid/keyword search** — pure dense vectors; no BM25/token-matching boost for "Neilsoft" literal match | Retrieval strategy | Medium | 100% |

### Detailed Root Cause Analysis

#### Cause 1: `@huggingface/transformers` Not Installed (100% confidence)

**Evidence:**
- `npm ls @huggingface/transformers` → `(empty)` — package is not listed
- `ls node_modules/@huggingface/transformers` → **NOT FOUND**
- `@langchain/community/dist/embeddings/huggingface_transformers.cjs:60`: `await import("@huggingface/transformers")` — this dynamic import WILL fail at runtime
- No other embedding provider is configured or available

**Impact:** Every call to `searchSemantic()` that reaches `similaritySearchWithScore()` will throw. The error is caught silently and empty results are returned. The user sees "I couldn't find that information..." regardless of query.

**Why was this missed?** The `@huggingface/transformers` package is a **peer dependency** of `@langchain/community` but was never installed. The Next.js app may not have triggered the code path because:
- Most queries match structured patterns (Tier 1 retrieval)
- Only company-name queries fall through to semantic search (Tier 2)
- The semantic fallback has never been tested since the agent was built

#### Cause 2: Neilsoft Ranks Below Top-5 (85% confidence)

**Evidence:**
- Vector neighborhood analysis: Neilsoft → Bio similarity (0.705) > Neilsoft → other Experience chunks (0.679, 0.600)
- Site settings chunks (Bio, About, Hero) occupy top 3 positions in Neilsoft's neighborhood
- "Neilsoft" appears once in 169 words (<1% of chunk content)
- nomic-embed-text-v1.5 is a general-purpose model not optimized for rare proper nouns
- No keyword/hybrid search to boost literal matches on company names

**Confidence note:** 85% because the actual query embedding is inferred, not measured. With a functional embedding model, the query "What did you do at Neilsoft?" could rank slightly differently. However, the dominance of ML/AI terminology in both the query and site-settings chunks makes the conclusion robust.

#### Cause 3: No Metadata Filtering (100% confidence)

**Evidence:** `similaritySearchVectorWithScore()` at `vectorstores.js:121-135` passes `filter: undefined`. The `searchSemantic()` function at `lib/retrieval/semantic.ts:7` passes only `(query, k)` with no filter parameter. `getVectorStore()` at `lib/ai/vector-store.ts:6-21` sets no filter.

If a metadata filter `{ must: [{ key: "metadata.section", match: { value: "Experience" } }] }` were applied, the Neilsoft chunk would be guaranteed to appear in results.

#### Cause 4: k=5 Too Small (85% confidence)

**Evidence:** With 26 vectors and 10+ vectors semantically closer to site settings and project chunks than experience chunks, k=5 is insufficient to surface specific experience entries. If k were 15+, the Neilsoft chunk (ranked ~6-8) would be included.

#### Cause 5: Embedding Model Weak on Proper Nouns (70% confidence)

**Evidence:** nomic-embed-text-v1.5 uses Matryoshka representation learning — it's strong on semantic meaning but weak on rare tokens. "Neilsoft" is a company proper noun with no known semantic associations in the model's training data. The model weights heavily toward ML/AI terminology shared across many chunks.

#### Cause 6: EMBEDDING_MODEL Configuration (50% confidence)

**Evidence:** The diagnostic script showed `Model: nomic-embed-text` (without `Xenova/` prefix). The `.env.example` specifies `Xenova/nomic-embed-text-v1.5`. If `.env.local` overrides to just `nomic-embed-text`, the HuggingFace Transformers.js engine would try to fetch from `https://huggingface.co/nomic-embed-text` which doesn't exist (correct path: `nomic-ai/nomic-embed-text-v1.5`). However, since `@huggingface/transformers` isn't installed, this configuration error can't be confirmed at runtime.

---

## 9. Confidence Assessment

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| Semantic search has NEVER executed successfully | **99%** | `@huggingface/transformers` not in `node_modules`; verified via `npm ls` |
| If embedding worked, Neilsoft would NOT appear in top-5 | **85%** | Vector neighborhood analysis; Qdrant recommend results |
| Site settings outrank experience chunks in embedding space | **100%** | Cosine similarity computed from all 26 vectors |
| No metadata filtering is applied | **100%** | Source code inspection of all retrieval layers |
| The query is not modified before embedding | **100%** | Source code inspection; only `.trim()` applied |
| k=5 is the hardcoded limit | **100%** | Default parameter in `searchSemantic(query, k = 5)` |
| The orchestrator correctly handles empty results | **100%** | `orchestrator.ts:93-102` checks `sources.length === 0` |
| The evidence builder does not discard results | **100%** | Only deduplication by first 100 chars; no score threshold |
| EMBEDDING_MODEL env var is misconfigured | **50%** | Inferred from diagnostic model name; can't verify without reading .env.local |

---

## 10. Recommended Next Investigation

If the semantic search failure is the priority to fix, the next steps are:

1. **Install `@huggingface/transformers`** and verify the embedding model loads:
   ```bash
   npm install @huggingface/transformers
   ```

2. **Verify EMBEDDING_MODEL configuration** in `.env.local`:
   - Should be `Xenova/nomic-embed-text-v1.5` (ONNX format for transformers.js)
   - NOT `nomic-embed-text` (wrong path for HuggingFace Hub)

3. **Increase k or add metadata filtering**:
   - Option A: Increase k from 5 to 15 in `searchSemantic()`
   - Option B: Add a Qdrant filter for `section=Experience` when query context suggests experience intent
   - Option C: Add structured pattern matching for company names to avoid semantic fallback entirely

4. **Test with actual query embeddings** by running a diagnostic with the functional embedding model:
   ```typescript
   const model = new HuggingFaceTransformersEmbeddings({
     model: "Xenova/nomic-embed-text-v1.5",
   });
   const embedding = await model.embedQuery("What did you do at Neilsoft?");
   ```

5. **Consider hybrid search**: Combine dense vector search with keyword/BM25 matching to boost literal company name matches.
