import path from "node:path";
import { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantConnectionError } from "../writer";
import { FileTransactionJournal } from "./journal";
import {
  bootstrapPromote,
  countPoints,
  createQdrantClient,
  createTempCollection,
  deleteCollectionIfExists,
  getCollectionVectorParams,
  isConnectionError,
  listCollectionNames,
  resolveProductionStatus,
  sweepOrphanedTempCollections,
  swapProductionAlias,
} from "./qdrant";
import type { QdrantConfig, VectorParams } from "./qdrant";
import type {
  SemanticProbe,
  TransactionJournal,
  TransactionProvenance,
  TransactionRecord,
} from "./types";
import { isTerminal } from "./types";

export interface IndexTransactionManagerConfig {
  qdrant: QdrantConfig;
  productionCollection: string;
  tempCollectionPrefix?: string;
  journalDir?: string;
  logger?: (message: string) => void;
}

export interface RunOptions {
  documents: Document[];
  embeddings: Embeddings;
  expectedCount?: number;
  provenance?: TransactionProvenance;
  semanticProbes?: SemanticProbe[];
}

export type RecoveryAction = "aborted" | "resumed" | "completed";

export interface RecoveryOutcome {
  transactionId: string;
  action: RecoveryAction;
  record: TransactionRecord;
}

export interface RecoveryResult {
  outcomes: RecoveryOutcome[];
  deletedOrphans: string[];
}

const DEFAULT_TEMP_PREFIX = "portfolio_temp_";
const LEGACY_JOURNAL_DIR = path.resolve(".agents", "index-txns");
const DEFAULT_JOURNAL_DIR = path.resolve(".state", "index-transactions");

export class IndexTransactionManager {
  private readonly qdrant: QdrantConfig;
  private readonly productionCollection: string;
  private readonly tempPrefix: string;
  private readonly journal: TransactionJournal;
  private readonly log: (message: string) => void;
  private lockDepth = 0;

  constructor(config: IndexTransactionManagerConfig) {
    this.qdrant = config.qdrant;
    this.productionCollection = config.productionCollection;
    this.tempPrefix = config.tempCollectionPrefix ?? DEFAULT_TEMP_PREFIX;
    const journalDir = config.journalDir ?? DEFAULT_JOURNAL_DIR;
    const journal = new FileTransactionJournal(journalDir);
    journal.migrateFrom(LEGACY_JOURNAL_DIR);
    this.journal = journal;
    this.log = config.logger ?? ((message) => console.log(message));
  }

  /**
   * Single-writer guard: only one transaction manager may mutate the production
   * index at a time. Reentrant so `run()` may call `recover()` while holding
   * the lock.
   */
  private acquireLock(): void {
    if (this.lockDepth > 0) {
      this.lockDepth += 1;
      return;
    }
    if (!this.journal.acquireLock()) {
      throw new Error(
        "Another indexing transaction is already in progress; " +
          "refusing to run concurrently (single-writer)."
      );
    }
    this.lockDepth = 1;
  }

  private releaseLock(): void {
    if (this.lockDepth === 0) return;
    this.lockDepth -= 1;
    if (this.lockDepth === 0) this.journal.releaseLock();
  }

  async recover(): Promise<RecoveryResult> {
    this.acquireLock();
    try {
      const outcomes: RecoveryOutcome[] = [];
      const client = createQdrantClient(this.qdrant);
      const status = await resolveProductionStatus(
        client,
        this.productionCollection
      );

      const active = this.journal.list().filter((record) => !isTerminal(record));

      for (const record of active) {
        if (record.state === "committed") {
          if (!record.cleanedAt) {
            await this.cleanup(client, record);
            record.cleanedAt = new Date().toISOString();
            this.journal.save(record);
          }
          outcomes.push({ transactionId: record.id, action: "completed", record });
          continue;
        }

        if (record.state === "promoting") {
          const productionBacking =
            status.kind === "alias" ? status.backingCollection : null;
          if (productionBacking === record.tempCollection) {
            record.state = "committed";
            record.promotedAt = new Date().toISOString();
            record.completedAt = record.promotedAt;
            this.journal.save(record);
            await this.cleanup(client, record);
            record.cleanedAt = new Date().toISOString();
            this.journal.save(record);
            outcomes.push({ transactionId: record.id, action: "resumed", record });
          } else {
            record.state = "aborted";
            record.error =
              "Promotion did not apply before restart; recovered as aborted.";
            this.journal.save(record);
            await this.discardTemp(record);
            outcomes.push({ transactionId: record.id, action: "aborted", record });
          }
          continue;
        }

        record.state = "aborted";
        record.error =
          "Transaction interrupted before promotion; recovered as aborted.";
        this.journal.save(record);
        await this.discardTemp(record);
        outcomes.push({ transactionId: record.id, action: "aborted", record });
      }

      const protectedNames = new Set<string>();
      for (const record of this.journal.list()) {
        if (!isTerminal(record)) protectedNames.add(record.tempCollection);
      }
      if (status.kind === "alias") protectedNames.add(status.backingCollection);
      protectedNames.add(this.productionCollection);

      const deletedOrphans = await sweepOrphanedTempCollections(client, {
        tempPrefix: this.tempPrefix,
        protectedNames,
      });

      return { outcomes, deletedOrphans };
    } finally {
      this.releaseLock();
    }
  }

  async run(options: RunOptions): Promise<TransactionRecord> {
    this.acquireLock();
    try {
      return await this.runLocked(options);
    } finally {
      this.releaseLock();
    }
  }

  private async runLocked(options: RunOptions): Promise<TransactionRecord> {
    await this.recover();

    const expectedCount = options.expectedCount ?? options.documents.length;
    if (options.documents.length === 0) {
      throw new Error(
        "Refusing to index an empty document set; production index preserved."
      );
    }

    const id = this.nextTransactionId();
    const tempCollection = `${this.tempPrefix}${id}`;
    const record: TransactionRecord = {
      id,
      state: "building",
      tempCollection,
      productionCollection: this.productionCollection,
      previousCollection: null,
      startedAt: new Date().toISOString(),
      documentsExpected: expectedCount,
      documentsIndexed: null,
      bootstrap: false,
      ...options.provenance,
    };
    this.journal.save(record);

    const client = createQdrantClient(this.qdrant);

    try {
      const vectorParams = await this.resolveVectorParams(
        client,
        options.embeddings
      );
      this.log(
        `[txn ${id}] Creating temporary collection "${tempCollection}"...`
      );
      await createTempCollection(client, tempCollection, vectorParams);

      this.log(`[txn ${id}] Building search index (${options.documents.length} chunks)...`);
      await QdrantVectorStore.fromDocuments(options.documents, options.embeddings, {
        client,
        collectionName: tempCollection,
      });

      record.documentsIndexed = await countPoints(client, tempCollection);
      this.journal.save(record);

      this.log(`[txn ${id}] Validating index...`);
      record.state = "validating";
      this.journal.save(record);
      await this.validate(client, record, options);

      this.log(
        `[txn ${id}] Promoting "${tempCollection}" → "${this.productionCollection}"...`
      );
      record.state = "promoting";
      this.journal.save(record);
      await this.promote(client, record);

      record.state = "committed";
      record.promotedAt = new Date().toISOString();
      record.completedAt = record.promotedAt;
      this.journal.save(record);

      this.log(`[txn ${id}] Cleaning up previous index...`);
      await this.cleanup(client, record);
      record.cleanedAt = new Date().toISOString();
      this.journal.save(record);

      this.log(
        `[txn ${id}] ✅ Index transaction committed. ` +
          `${record.documentsIndexed} chunks live at "${this.productionCollection}".`
      );
      return record;
    } catch (error) {
      record.state = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      this.journal.save(record);
      this.log(`[txn ${id}] ❌ Transaction failed: ${record.error}`);

      try {
        await this.discardTemp(record);
        this.log(`[txn ${id}] Discarded temporary collection "${tempCollection}".`);
      } catch (discardError) {
        this.log(
          `[txn ${id}] ⚠️ Could not discard temporary collection: ` +
            `${discardError instanceof Error ? discardError.message : String(discardError)}`
        );
      }

      if (isConnectionError(error)) {
        throw new QdrantConnectionError(
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  private async resolveVectorParams(
    client: ReturnType<typeof createQdrantClient>,
    embeddings: Embeddings
  ): Promise<VectorParams> {
    let existing: VectorParams | null = null;
    try {
      existing = await getCollectionVectorParams(client, this.productionCollection);
    } catch (error) {
      if (isConnectionError(error)) {
        throw new QdrantConnectionError(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    if (existing) return existing;

    const probe = await embeddings.embedQuery("vector-dimension-probe");
    return { size: probe.length, distance: "Cosine" };
  }

  private async validate(
    client: ReturnType<typeof createQdrantClient>,
    record: TransactionRecord,
    options: RunOptions
  ): Promise<void> {
    const names = await listCollectionNames(client);
    if (!names.includes(record.tempCollection)) {
      throw new Error(
        `Temporary collection "${record.tempCollection}" was not created.`
      );
    }

    const indexed = await countPoints(client, record.tempCollection);
    record.documentsIndexed = indexed;
    if (indexed !== record.documentsExpected) {
      throw new Error(
        `Expected ${record.documentsExpected} documents but found ${indexed}.`
      );
    }

    const probe = await options.embeddings.embedQuery(
      "index-transaction-embedding-probe"
    );
    const params = await getCollectionVectorParams(client, record.tempCollection);
    if (!params) {
      throw new Error(
        `Could not read vector parameters of temporary collection "${record.tempCollection}".`
      );
    }
    if (params.size !== probe.length) {
      throw new Error(
        `Embedding dimension mismatch: collection=${params.size}, model=${probe.length}.`
      );
    }

    await this.assertRetrievable(
      client,
      record,
      probe,
      "generic-embedding-probe",
      null
    );

    for (const semanticProbe of options.semanticProbes ?? []) {
      const vector = await options.embeddings.embedQuery(semanticProbe.query);
      await this.assertRetrievable(
        client,
        record,
        vector,
        semanticProbe.label,
        semanticProbe.expected
      );
    }
  }

  private async assertRetrievable(
    client: ReturnType<typeof createQdrantClient>,
    record: TransactionRecord,
    queryVector: number[],
    label: string,
    expected: string | null
  ): Promise<void> {
    const result = await client.query(record.tempCollection, {
      query: queryVector,
      limit: expected ? 3 : 1,
      with_payload: true,
    });
    if (!result.points?.length) {
      throw new Error(
        `Semantic retrieval probe "${label}" returned no results; refusing to promote.`
      );
    }

    if (!expected) return;

    const match = result.points.find((point) => {
      const payload = point.payload;
      if (!payload) return false;
      return JSON.stringify(payload).includes(expected);
    });
    if (!match) {
      throw new Error(
        `Semantic retrieval probe "${label}" failed: expected content ` +
          `referencing "${expected}" was not retrievable from the temporary ` +
          `collection; refusing to promote.`
      );
    }
  }

  private async promote(
    client: ReturnType<typeof createQdrantClient>,
    record: TransactionRecord
  ): Promise<void> {
    const status = await resolveProductionStatus(
      client,
      this.productionCollection
    );

    if (status.kind === "real" || status.kind === "missing") {
      record.previousCollection = null;
      record.bootstrap = status.kind === "real";
      await bootstrapPromote(client, this.qdrant, {
        tempCollection: record.tempCollection,
        productionCollection: this.productionCollection,
        legacyCollection:
          status.kind === "real" ? status.collectionName : null,
      });
      return;
    }

    record.previousCollection = status.backingCollection;
    record.bootstrap = false;
    await swapProductionAlias(client, {
      tempCollection: record.tempCollection,
      productionCollection: this.productionCollection,
    });
  }

  private async cleanup(
    client: ReturnType<typeof createQdrantClient>,
    record: TransactionRecord
  ): Promise<void> {
    if (record.previousCollection) {
      await deleteCollectionIfExists(client, record.previousCollection);
    }
  }

  private async discardTemp(record: TransactionRecord): Promise<void> {
    const client = createQdrantClient(this.qdrant);
    await deleteCollectionIfExists(client, record.tempCollection);
  }

  private nextTransactionId(): string {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");
    const prefix = `txn_${stamp}`;
    const existing = this.journal.list().filter((record) =>
      record.id.startsWith(prefix)
    );
    let seq = existing.length + 1;
    let id = `${prefix}_${String(seq).padStart(3, "0")}`;
    while (this.journal.load(id)) {
      seq += 1;
      id = `${prefix}_${String(seq).padStart(3, "0")}`;
    }
    return id;
  }
}
