export type TransactionState =
  | "building"
  | "validating"
  | "promoting"
  | "committed"
  | "failed"
  | "aborted";

export interface TransactionRecord {
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
  error?: string;
}

export interface TransactionJournal {
  list(): TransactionRecord[];
  load(id: string): TransactionRecord | null;
  save(record: TransactionRecord): void;
  delete(id: string): void;
}

export const TERMINAL_STATES: ReadonlySet<TransactionState> = new Set([
  "failed",
  "aborted",
]);

export function isTerminal(record: TransactionRecord): boolean {
  return TERMINAL_STATES.has(record.state);
}
