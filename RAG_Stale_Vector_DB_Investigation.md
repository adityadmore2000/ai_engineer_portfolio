# RAG Stale Vector Database Investigation

**Date**: 2026-07-23
**Scope**: Determine whether the Qdrant `portfolio_chunks` collection contains stale data from an older ingestion pipeline or accurately reflects the current codebase.

---

## Executive Summary

**The vector database is NOT stale.** It was populated by the **current ingestion pipeline** (`scripts/index-content.ts`) using **live Sanity CMS content**. The database does NOT contain data from an older ingestion implementation — there is no legacy ingestion code anywhere in the repository.

However, the database content does **not match the fallback content** (`sanity/fallbackContent.ts`) or the **seed data** (`sanity/seed.ndjson`). The 26 vectors contain 2 projects not present in either fallback or seed data, and the experience/site-settings text is substantially different. This means the database was indexed from a Sanity dataset that has been edited beyond the initial seed.

A separate **architectural concern** exists: `QdrantVectorStore.fromDocuments()` does **not clear** the collection before re-indexing. Running `scripts/index-content.ts` multiple times will **accumulate duplicate vectors** in the database — there is no mechanism to delete old vectors before inserting new ones.

---

## 1. Current Ingestion Architecture

### Ingestion Entrypoint

**File**: `scripts/index-content.ts:335-411` (the `main()` function)

```typescript
async function main() {
  const [projects, settings, experiences, skillCategories, technicalNotes] =
    isSanityConfigured ? await fetchFromSanity() : getFallbackContent();
  // ... chunk each data type ...
  await QdrantVectorStore.fromDocuments(documents, embeddings, {
    url: vectorUrl,
    collectionName,
  });
}
```

**Execution**: `npx tsx scripts/index-content.ts` (documented in README:83 but script not defined in `package.json`)

### Data Source Selection (`scripts/index-content.ts:349`)

```typescript
isSanityConfigured ? await fetchFromSanity() : getFallbackContent();
```

`isSanityConfigured` checks `NEXT_PUBLIC_SANITY_PROJECT_ID` (`sanity/env.ts`). When configured, live Sanity data is fetched via GROQ queries at lines 305-319. Otherwise, hardcoded fallback data from `sanity/fallbackContent.ts` is used.

### Document Loader

There is **no document loader** in the traditional sense. Content is fetched via `client.fetch()` (Sanity GROQ queries) or read from TypeScript constants (`fallbackContent.ts`). No file-based loaders (DirectoryLoader, TextLoader, etc.) exist.

### Preprocessing

**None.** Raw text from Sanity/fallback is passed directly to chunking functions. No text cleaning, normalization, or transformation.

### Chunking Implementation

**Deterministic section-based chunking** — five custom functions in `scripts/index-content.ts`:

| Function | Lines | Strategy |
|----------|-------|----------|
| `chunkProject` | 117-175 | 6 named sections (Short Summary, Problem Statement, Approach, Results, Limitations, Future Improvements) + Technologies + Key Metrics → up to 8 chunks |
| `chunkSiteSettings` | 177-226 | 5 sections (Bio, About, Hero Description, Focus Areas, Contact) → up to 5 chunks |
| `chunkExperience` | 228-252 | 1 monolithic chunk per experience (role + company + description + bullets + skills) |
| `chunkSkillCategory` | 254-264 | 1 chunk per skill category (title + skills) |
| `chunkTechnicalNote` | 266-300 | Short Summary + Tags → up to 2 chunks per note |

### Embedding Step

**File**: `lib/ai/embeddings.ts:4-7`
**Model**: `Xenova/nomic-embed-text-v1.5` (HuggingFace Transformers.js, 768d vectors, runs locally)
**Default**: confirmed by `.env.example:8`

### Vector Store Insertion

**File**: `scripts/index-content.ts:385-388`
```typescript
await QdrantVectorStore.fromDocuments(documents, embeddings, {
  url: vectorUrl,
  collectionName,
});
```

**Qdrant configuration** (from `.env.example` and `docker-compose.yml`):
- Collection: `portfolio_chunks` (default at `lib/ai/vector-store.ts:4`)
- URL: `http://localhost:6333`
- Distance: Cosine
- Vector size: 768

---

## 2. Expected Documents (from fallback/sanity sources)

### Fallback Content Expected Documents

If Sanity is unconfigured (`NEXT_PUBLIC_SANITY_PROJECT_ID` not set), the ingestion produces these documents:

| # | Document Type | Source | Title | Estimated Tokens | Chunked? | Expected Chunks |
|---|---------------|--------|-------|------------------|----------|-----------------|
| 1-8 | Project: Resume Tailoring | `fallbackContent.ts:104-125` | Evidence-Grounded Resume Tailoring Platform | ~60 each | Yes (8 sections) | 8 |
| 9-16 | Project: Parcel Monitoring | `fallbackContent.ts:127-145` | Warehouse Parcel Monitoring System | ~60 each | Yes (8 sections) | 8 |
| 17-24 | Project: Math Mentor AI | `fallbackContent.ts:147-167` | Math Mentor AI | ~60 each | Yes (8 sections) | 8 |
| 25 | Site Settings: Bio | `fallbackContent.ts:13-14` | — | ~30 | No (1 chunk) | 1 |
| 26 | Site Settings: About | `fallbackContent.ts:35-36` | — | ~50 | No (1 chunk) | 1 |
| 27 | Site Settings: Hero | `fallbackContent.ts:15-16` | — | ~25 | No (1 chunk) | 1 |
| 28 | Site Settings: Focus | `fallbackContent.ts:37-43` | — | ~40 | No (1 chunk) | 1 |
| 29 | Site Settings: Contact | `fallbackContent.ts:45-46` | — | ~20 | No (1 chunk) | 1 |
| 30 | Experience: NDSoftTech | `fallbackContent.ts:53-69` | Software Engineering Intern at NDSoftTech Solutions | ~70 | No (1 chunk) | 1 |
| 31 | Experience: Freelancer | `fallbackContent.ts:71-85` | Applied AI Engineer at Freelancer | ~65 | No (1 chunk) | 1 |
| 32 | Experience: Neilsoft | `fallbackContent.ts:87-101` | AI/ML Engineer at Neilsoft | ~85 | No (1 chunk) | 1 |
| 33-36 | Skill Categories (4) | `fallbackContent.ts:170-237` | GenAI, CV/ML, Backend, MLOps | ~30 each | No (1 each) | 4 |
| — | Technical Notes | N/A | None (fallback has none) | — | — | 0 |

**Total fallback expected: 36 chunks**

### Seed Content Expected Documents

If Sanity is configured AND `seed.ndjson` is imported:

Same as fallback above (36 chunks) plus:
| 37-38 | Technical Note | `seed.ndjson:12` | Notes on Evidence-Grounded RAG Evaluation | ~30 each | Yes (2 sections) | 2 |

**Total seed expected: 38 chunks**

---

## 3. Current Chunking Logic Analysis

### Is RecursiveCharacterTextSplitter used?

**No.** The codebase contains zero references to `RecursiveCharacterTextSplitter`, `CharacterTextSplitter`, `TokenTextSplitter`, `SemanticChunker`, or any LangChain text splitter class.

### Which splitter is used?

**None. There is no splitter.** Chunking is done by five deterministic custom functions (`chunkProject`, `chunkSiteSettings`, `chunkExperience`, `chunkSkillCategory`, `chunkTechnicalNote`) in `scripts/index-content.ts:117-300`. Each function manually creates `Document` instances with hardcoded section boundaries.

### Which documents are passed into it?

All documents shown in section 2 above are passed through these functions:

- **Projects** → `chunkProject()` → up to 8 chunks each (line 354)
- **Site settings** → `chunkSiteSettings()` → up to 5 chunks (line 358)
- **Experiences** → `chunkExperience()` → 1 chunk each (line 362)
- **Skill categories** → `chunkSkillCategory()` → 1 chunk each (line 366)
- **Technical notes** → `chunkTechnicalNote()` → up to 2 chunks each (line 370)

### Which documents bypass chunking?

**None.** Every document type goes through a chunking function. However:
- `chunkExperience` returns exactly 1 document per input (monolithic)
- `chunkSkillCategory` returns exactly 1 document per input (monolithic)

### Are projects intentionally chunked?

**Yes.** `chunkProject()` at `scripts/index-content.ts:117-175` explicitly splits projects into separate documents by section name (Short Summary, Problem Statement, Approach, Results, Limitations, Future Improvements, Technologies, Key Metrics). Each section becomes a separate vector in Qdrant. This is the intended behavior — confirmed by the metadata `section` field that labels each chunk.

### Are experiences intentionally chunked?

**No.** `chunkExperience()` at `scripts/index-content.ts:228-252` returns a **single monolithic document** per experience:

```typescript
return [
  new Document({
    pageContent: [
      `${role} at ${company}`,
      exp.shortDescription,
      bullets || undefined,
      skills || undefined,
    ].filter(Boolean).join("\n"),
    metadata: { section: "Experience", url: ... }
  }),
];
```

One experience → one vector. This is the intended behavior.

---

## 4. Documents Before Embedding (from current ingestion)

The ingestion pipeline assembles all chunked documents into a flat `documents: Document[]` array at `scripts/index-content.ts:351-371`, then passes it directly to `QdrantVectorStore.fromDocuments()` at line 385.

There is no intermediate inspection or logging of individual document contents before insertion. The only log line is `Generated ${documents.length} document chunks.` (line 373).

**Based on what produced the current 26 vectors, the document list before embedding contained:**

| # | Type | Metadata | First 150 chars | Length |
|---|------|----------|------------------|--------|
| 1 | Project: Video Captioning Agent | projectTitle=Video Captioning Agent, section=Short Summary, slug=video-captioning-agent | "A hackathon project that watches a short, unseen video..." | ~180 chars |
| 2 | Project: Video Captioning Agent | section=Problem Statement | "The brief was to take a video the system has never seen..." | ~300 chars |
| 3 | Project: Video Captioning Agent | section=Approach | "It's a two-stage pipeline..." | ~320 chars |
| 4 | Project: Video Captioning Agent | section=Results | "The full pipeline works end-to-end..." | ~280 chars |
| 5 | Project: Video Captioning Agent | section=Limitations | "There's no automated check..." | ~350 chars |
| 6 | Project: Video Captioning Agent | section=Future Improvements | "The most valuable next step..." | ~200 chars |
| 7 | Project: Video Captioning Agent | section=Technologies | "Technologies used in Video Captioning Agent: Python..." | ~180 chars |
| 8 | Project: Video Captioning Agent | section=Key Metrics | "Key metrics for Video Captioning Agent: 27 commits..." | ~250 chars |
| 9 | Project: Candidate Ranking | projectTitle=Candidate Ranking system, section=Short Summary | "AI-powered candidate ranking system..." | ~150 chars |
| 10 | Project: Candidate Ranking | section=Problem Statement | "- Traditional recruiting tools rank by keyword overlap..." | ~250 chars |
| 11 | Project: Candidate Ranking | section=Approach | "### Two-phase architecture: precompute once, rank many" | ~600 chars |
| 12 | Project: Candidate Ranking | section=Limitations | "- The demo caps at MAX_CANDIDATES = 100..." | ~250 chars |
| 13 | Project: Candidate Ranking | section=Future Improvements | "- Add a cross-encoder second pass..." | ~280 chars |
| 14 | Project: Candidate Ranking | section=Technologies | "Technologies used in Candidate Ranking system: python..." | ~160 chars |
| 15 | Site Settings: About | section=About | "I'm Aditya More, an AI Engineer who treats data..." | ~300 chars |
| 16 | Site Settings: Bio | section=Bio | "I'm an AI Engineer specializing in production-grade..." | ~250 chars |
| 17 | Site Settings: Hero | section=Hero Description | "AI Engineer building systems where the architecture..." | ~200 chars |
| 18 | Experience: Neilsoft | section=Experience | "AI/ML Engineer at Neilsoft\nWorked on ML and AI..." | ~400 chars |
| 19 | Experience: NDSoftTech | section=Experience | "Software Engineering Intern at NDSoftTech Solutions..." | ~350 chars |
| 20 | Experience: Freelancer | section=Experience | "Applied AI Engineer at Freelancer / Independent..." | ~400 chars |
| 21 | Skills: CV & ML | section=Skills | "Computer Vision & Machine Learning: PyTorch, OpenCV..." | ~150 chars |
| 22 | Skills: Backend | section=Skills | "Backend & Application Development: Python, FastAPI..." | ~150 chars |
| 23 | Skills: GenAI | section=Skills | "Generative AI & LLM Systems: LLM, RAG, Semantic..." | ~150 chars |
| 24 | Skills: MLOps | section=Skills | "MLOps & Infrastructure: Docker, MLflow, DVC..." | ~130 chars |
| 25 | Technical Note | section=Short Summary, title=Notes on Evidence-Grounded RAG Evaluation | "A short note on checking whether generated answers..." | ~80 chars |
| 26 | Technical Note | section=Tags, title=Notes on Evidence-Grounded RAG Evaluation | "Tags: RAG, Evaluation, GenAI" | ~30 chars |

**Projects are NOT split before insertion beyond what `chunkProject()` produces.** Each project appears as 6-8 section-level chunks — this is the intended design.

---

## 5. Vector Store Inventory

### Collection Information

| Property | Value | Source |
|----------|-------|--------|
| Name | `portfolio_chunks` | Qdrant API: `/collections` |
| Point count | **26** | Qdrant API: `points_count` |
| Vector size | 768 | Qdrant API: `config.params.vectors.size` |
| Distance metric | Cosine | Qdrant API: `config.params.vectors.distance` |
| Status | green | Qdrant API |
| Indexed vectors | 0 (on-disk) | Qdrant API: `indexed_vectors_count: 0` |
| Segments | 6 | Qdrant API |

### Payload Schema

LangChain Qdrant uses a dynamic JSON payload structure with two root keys:

```
{
  "content": "<string>",     // Document.pageContent
  "metadata": {
    "projectTitle": "<string>",  // only on project chunks
    "slug": "<string>",          // only on projects and tech notes
    "section": "<string>",       // all chunks
    "url": "<string>",           // all chunks
    "title": "<string>"          // only on technical notes
  }
}
```

### Unique Sections

| Section | Count | Document Types |
|---------|-------|---------------|
| Short Summary | 3 | 2 projects + 1 technical note |
| Problem Statement | 2 | 2 projects |
| Approach | 2 | 2 projects |
| Results | 1 | Video Captioning Agent only |
| Limitations | 2 | 2 projects |
| Future Improvements | 2 | 2 projects |
| Technologies | 2 | 2 projects |
| Key Metrics | 1 | Video Captioning Agent only |
| Experience | 3 | 3 experience entries |
| Skills | 4 | 4 skill categories |
| About | 1 | 1 site setting |
| Bio | 1 | 1 site setting |
| Hero Description | 1 | 1 site setting |
| Tags | 1 | 1 technical note |

### Unique Project Names

| Project | Chunks | Missing Sections |
|---------|--------|-----------------|
| Video Captioning Agent | 8 | None (all 8 possible sections present) |
| Candidate Ranking system | 6 | Results (likely null/empty in Sanity), Key Metrics (likely null/empty in Sanity) |

### Non-Project Chunks (12)

- 3 experiences (Neilsoft, NDSoftTech, Freelancer)
- 4 skill categories
- 3 site settings (About, Bio, Hero Description)
- 2 technical note sections

---

## 6. Expected vs Actual Comparison

### Fallback Content vs Database

| Metric | Fallback Expected | Actual Qdrant | Match? |
|--------|-------------------|---------------|--------|
| Total chunks | 36 | 26 | **No** |
| Project count | 3 (Resume Tailoring, Parcel Monitoring, Math Mentor AI) | 2 (Video Captioning Agent, Candidate Ranking) | **No** |
| Project chunks | 24 | 14 | **No** |
| Site settings chunks | 5 | 3 | **No** |
| Experience chunks | 3 | 3 | Yes (count only) |
| Skill category chunks | 4 | 4 | Yes (count only) |
| Technical note chunks | 0 | 2 | **No** |

**Project-level comparison:**

| Fallback Project | In Database? |
|------------------|-------------|
| Evidence-Grounded Resume Tailoring Platform | **NO** |
| Warehouse Parcel Monitoring System | **NO** |
| Math Mentor AI | **NO** |

| Database Project | In Fallback? |
|------------------|-------------|
| Video Captioning Agent | **NO** |
| Candidate Ranking system | **NO** |

### Seed Content vs Database

| Seed Project | In Database? |
|-------------|-------------|
| Evidence-Grounded Resume Tailoring Platform | **NO** |
| Warehouse Parcel Monitoring System | **NO** |
| Math Mentor AI | **NO** |

### Content-Level Comparison

**Experience content is DIFFERENT:**

| Experience | Fallback Text (first 40 chars) | Database Text (first 40 chars) |
|-----------|-------------------------------|-------------------------------|
| NDSoftTech | "Contributed to software engineering tasks" | "Worked on mobile application features..." |
| Neilsoft | "Worked on ML and AI engineering tasks" | Same start, but database version adds "Developed computer vision pipelines using YOLOv5, YOLOX..." |
| Freelancer | "Built applied AI prototypes and MVPs" | "Built end-to-end Generative AI systems for document..." |

**Skill category names are DIFFERENT:**

| Seed/Fallback Name | Database Name |
|--------------------|--------------|
| Backend & Data Systems | Backend & Application Development |

**Site settings are DIFFERENT:**
- Database Bio: "I'm an AI Engineer specializing in production-grade LLM systems, RAG pipelines, and agentic workflows..."
- Fallback Bio: "Applied AI Engineer building reliable GenAI, RAG, Computer Vision, OCR, and Python backend systems..."

### Key Conclusions

1. **The database does NOT contain fallback content.**
2. **The database does NOT contain seed content.**
3. **The database contains live Sanity content that has been substantially edited.**
4. **The fallback/seed projects (Resume Tailoring, Parcel Monitoring, Math Mentor AI) are NOT in the database.**
5. **Two projects exist in the database that are NOT in fallback or seed (Video Captioning Agent, Candidate Ranking system).**
6. **The chunking structure (section-based, 6-8 chunks per project) is identical to what the current ingestion produces.**

---

## 7. Collection Rebuild Behaviour

### How Indexing Is Executed

The ingestion script (`scripts/index-content.ts:385`) calls:

```typescript
await QdrantVectorStore.fromDocuments(documents, embeddings, {
  url: vectorUrl,
  collectionName,
});
```

### Does it delete the collection?

**No.** `fromDocuments()` at `node_modules/@langchain/qdrant/dist/vectorstores.js:216-222`:

```javascript
static async fromDocuments(docs, embeddings, dbConfig) {
  const instance = new this(embeddings, dbConfig);
  await instance.addDocuments(docs);
  return instance;
}
```

### Does it recreate the collection?

**No.** `ensureCollection()` at `vectorstores.js:177-184`:

```javascript
async ensureCollection() {
  if (!(await this.client.getCollections()).collections
    .map((c) => c.name).includes(this.collectionName)) {
    await this.client.createCollection(this.collectionName, collectionConfig);
  }
}
```

It ONLY creates the collection if it doesn't exist. If it exists, it does nothing.

### Does it clear existing vectors?

**No.** `addVectors()` at `vectorstores.js:65-84`:

```javascript
async addVectors(vectors, documents, documentOptions) {
  if (vectors.length === 0) return;
  await this.ensureCollection();
  const points = vectors.map((embedding, idx) => ({
    id: documents[idx].id ?? v4(),  // NEW UUID each time
    vector: embedding,
    payload: { ... }
  }));
  await this.client.upsert(this.collectionName, { wait: true, points });
}
```

Points are inserted with **new UUIDs** each time. Old points are **never deleted**.

### Does it upsert into an existing collection?

**Yes, but with caveats.** `client.upsert()` inserts points by UUID. Since UUIDs are unique and freshly generated each run, upserting the same logical content twice creates **duplicate points** (different UUIDs, same content). Old vectors remain indefinitely.

### Does it skip indexing when the collection exists?

**No.** There is no existence check or skip logic anywhere in `scripts/index-content.ts`. The script always runs the full pipeline regardless of collection state.

### Accumulation Risk

Running `npx tsx scripts/index-content.ts` twice without deleting the collection produces:

```
Run 1: 26 vectors (fresh collection)
Run 2: 52 vectors (26 old + 26 new duplicates)
Run 3: 78 vectors (52 old + 26 new duplicates)
```

This is a confirmed accumulation bug. There is **no mechanism** to purge the collection before re-indexing.

---

## 8. Legacy Code Investigation

### Search Results Summary

| Legacy Artifact | Found? | Evidence |
|-----------------|--------|----------|
| Previous chunking implementations | **No** | Zero references to `RecursiveCharacterTextSplitter`, `CharacterTextSplitter`, `TokenTextSplitter`, `SemanticChunker`, or any LangChain text splitter |
| Deprecated ingestion scripts | **No** | Only `scripts/index-content.ts` writes to Qdrant; other 12 scripts in `scripts/` are Sanity publishing tools |
| Multiple ingestion entrypoints | **No** | Single entrypoint: `scripts/index-content.ts` |
| Old indexing commands | **No** | `package.json` has no `index-content` script defined (README references it but it's absent — bug) |
| Python ingestion scripts | **No** | Only Python file is `agent/publish_agent.py` (Sanity CMS publisher, no Qdrant/vector references) |
| Deleted ingestion files in git | **No** | Only deletions: `lib/agent/graph.ts` and `lib/agent/tools.ts` (LangGraph agent, not ingestion) |
| Multiple splitter configs | **No** | No `chunkSize`, `chunkOverlap`, `chunk_size`, or `chunk_overlap` parameters anywhere |
| Other vector store integrations | **No** | Only Qdrant (no FAISS, ChromaDB, Pinecone, Weaviate, Milvus references) |

### Git History

```
05a9007 fix(intent-router): Fixed bug in intent router
14e31ab feat(vercel-analytics): Integrated vercel analytics
37dc620 Merge branch 'feature/observability-langfuse'
6877320 refactor(observability): ...
f0a59a0 feat(observability): integrate MLflow ...
947fad2 feat: update portfolio assistant to use vLLM ...
dced397 refactor(agent): replace LangGraph with ...
aef5f85 feat(chat): implement end-to-end AI portfolio assistant ← initial ingestion
```

The initial ingestion was introduced in commit `aef5f85` and has been modified only to add Sanity fallback support. No prior ingestion system ever existed.

### No Legacy Chunking Strategy

The current deterministic section-based chunking is the **only** chunking strategy that has ever existed in this codebase. There was no previous "RecursiveCharacterTextSplitter with chunkSize=1000" implementation that was replaced.

---

## 9. Root Cause Analysis

### Scenario Assessment

The question: *"Why does the database have different content than the fallback/seed?"*

**Answer**: The database was indexed from **live Sanity CMS content** (not fallback), and the Sanity project has been edited beyond the initial seed. Projects were added (Video Captioning Agent, Candidate Ranking), existing projects were removed (Resume Tailoring, Parcel Monitoring, Math Mentor AI), and site/experience content was rewritten.

This is **expected behavior** — the ingestion pipeline correctly reads from whatever data source is configured. When `NEXT_PUBLIC_SANITY_PROJECT_ID` is set, it fetches live Sanity data and uses it. When unset, it uses fallback.

### Scenario Confidence

| Scenario | Confidence | Evidence |
|----------|-----------|----------|
| Database reflects live Sanity (not stale ingestion) | **95%** | 26 vectors form coherent set; projects/skills/experiences all differ from fallback in consistent ways; no duplicate/ghost vectors; chunk structure matches current code; no legacy ingestion code exists |
| Database was populated by current ingestion code | **95%** | Chunk structure (section names, metadata keys) exactly matches `scripts/index-content.ts` output; no evidence of any other indexing mechanism |
| Fallback would produce different database content | **100%** | 36 fallback chunks vs 26 actual chunks; 3 different project names; different skill category names; different experience text |
| Old vectors were never deleted | **0%** | No evidence of old vectors coexisting with new ones (26 vectors is a clean, coherent set); no duplicate content from fallback or seed projects |
| Multiple ingestion pipelines exist | **0%** | Single ingestion script; no other Qdrant writers anywhere in codebase |
| Current code is not being executed | **5%** | Low but possible — someone could have used a different script/process, but structure matches current code exactly |
| Stale data from old pipeline | **0%** | No old pipeline ever existed; no evidence of legacy chunking code in git history or current source |

### What's Actually Happening

The user's concern about "Resume Tailoring → 6 chunks, Parcel Monitoring → 6 chunks, Math Mentor AI → 4 chunks" may have been based on:

1. **Reading the fallback code** (`sanity/fallbackContent.ts`) and calculating expected chunks, OR
2. **Reading the earlier RAG debug report** (`RAG_Debug_Report.md` section 4.1) which projected these counts

Neither the seed data nor the fallback matches what's actually in Qdrant. The database was populated from a live Sanity instance with different content.

### The Real Risk: Future Staleness

While the database is NOT stale today, the architecture has a **staleness risk** for the future:

1. `QdrantVectorStore.fromDocuments()` never clears the collection (line 177-184 of `vectorstores.js`)
2. Running `npx tsx scripts/index-content.ts` multiple times **accumulates** vectors
3. Deleting a project from Sanity and re-indexing **will NOT remove** the old project's vectors
4. Editing a project and re-indexing will create **duplicate** vectors (different UUIDs, slightly different content)
5. There is no versioning or timestamp metadata on vectors to identify stale ones

---

## 10. Confidence Assessment

| Claim | Confidence |
|-------|-----------|
| Vector database is built by current ingestion code | 95% |
| No legacy ingestion pipeline ever existed | 99% |
| Database contains live Sanity content (not fallback/seed) | 95% |
| Chunking strategy matches current `scripts/index-content.ts` | 99% |
| `fromDocuments()` does not clear the collection before re-indexing | 100% (confirmed from source code) |
| Re-running ingestion without deleting collection first would cause duplicates | 100% |
| The "6/6/4 chunks" pattern user observed is NOT in the current database | 100% |
| No evidence of stale vectors currently in the database | 95% |

---

## 11. Evidence

### Source Files Inspected

| File | Lines | Evidence Type |
|------|-------|---------------|
| `scripts/index-content.ts` | 1-416 | Full ingestion pipeline |
| `scripts/index-content.ts:117-175` | 59 | `chunkProject()` — section-based project chunking |
| `scripts/index-content.ts:228-252` | 25 | `chunkExperience()` — monolithic experience chunking |
| `scripts/index-content.ts:385` | 1 | `QdrantVectorStore.fromDocuments()` — insertion point |
| `sanity/fallbackContent.ts` | 1-245 | Fallback data (3 projects, 3 experiences, 4 skill cats) |
| `sanity/seed.ndjson` | 1-12 | Seed data (same 3 projects, 1 technical note) |
| `lib/ai/vector-store.ts` | 1-22 | Query-time Qdrant connection |
| `lib/ai/embeddings.ts` | 1-8 | Embedding model factory |
| `lib/retrieval/semantic.ts` | 1-25 | Semantic search consumer |
| `node_modules/@langchain/qdrant/dist/vectorstores.js:65-84` | 20 | `addVectors()` — no clearing |
| `node_modules/@langchain/qdrant/dist/vectorstores.js:177-184` | 8 | `ensureCollection()` — create only |
| `node_modules/@langchain/qdrant/dist/vectorstores.js:216-222` | 7 | `fromDocuments()` — static factory |

### Runtime Evidence

- Qdrant API `GET /collections` → 1 collection: `portfolio_chunks`
- Qdrant API `GET /collections/portfolio_chunks` → 26 points, status green, cosine distance, 768d
- Qdrant API `POST /collections/portfolio_chunks/points/scroll` → 26 points with `{"content": "...", "metadata": {...}}` payload

---

## 12. Recommended Next Debugging Step

The database is not stale from a code perspective, but it doesn't match the fallback content. The recommended next step is:

1. **Verify what's actually in Sanity**: Run `npx sanity documents query '*[_type == "project" && published == true]{title, "slug": slug.current}' --api-version 2025-05-01` to list current Sanity projects. If the output shows "Video Captioning Agent" and "Candidate Ranking system", the database is correctly synced with Sanity.

2. **Verify Sanity content matches database**: For each project returned from Sanity, compare the field values against the Qdrant vectors to confirm they match.

3. **Address the accumulation risk**: If re-indexing is ever needed, **delete the Qdrant collection first**:
   ```bash
   curl -X DELETE http://localhost:6333/collections/portfolio_chunks
   npx tsx scripts/index-content.ts
   ```
   Or add a `deleteCollection` call to the beginning of `main()` in `scripts/index-content.ts`.

4. **If Sanity has different projects than expected**: The Sanity dataset may need to be re-imported from seed to match fallback content: `npx sanity dataset import sanity/seed.ndjson production --replace`.
