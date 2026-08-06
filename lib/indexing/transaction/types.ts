export type TransactionState =
  | "building"
  | "validating"
  | "promoting"
  | "committed"
  | "failed"
  | "aborted";

export interface TransactionProvenance {
  trigger?: string;
  initiatedBy?: string;
  sanityRevision?: string;
  embeddingModel?: string;
}

export interface TransactionRecord extends TransactionProvenance {
  id: string;
  state: TransactionState;
  tempCollection: string;
  productionCollection: string;
  previousCollection: string | null;
  startedAt: string;
  documentsExpected: number;
  documentsIndexed: number | null;
  bootstrap: boolean;
  promotedAt?: string;
  cleanedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface SemanticProbe {
  label: string;
  query: string;
  expected: string;
}

export interface TransactionJournal {
  list(): TransactionRecord[];
  load(id: string): TransactionRecord | null;
  save(record: TransactionRecord): void;
  delete(id: string): void;
  acquireLock(maxAgeMs?: number): boolean;
  releaseLock(): void;
}

export const TERMINAL_STATES: ReadonlySet<TransactionState> = new Set([
  "failed",
  "aborted",
]);

export function isTerminal(record: TransactionRecord): boolean {
  return TERMINAL_STATES.has(record.state);
}
