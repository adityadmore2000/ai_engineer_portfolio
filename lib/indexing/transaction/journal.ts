import fs from "node:fs";
import path from "node:path";
import type { TransactionJournal, TransactionRecord } from "./types";

const LOCK_FILE = ".lock";
const DEFAULT_MAX_LOCK_AGE_MS = 30 * 60 * 1000;

interface LockInfo {
  pid: number;
  startedAt: string;
}

/**
 * Filesystem-backed transaction journal living in a dedicated runtime state
 * directory (default `.state/index-transactions/`). It also provides the
 * single-writer lock that guarantees only one transaction may modify the
 * production index at a time.
 */
export class FileTransactionJournal implements TransactionJournal {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private fileFor(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private lockPath(): string {
    return path.join(this.dir, LOCK_FILE);
  }

  /**
   * One-time migration from the legacy journal location (`.agents/index-txns/`)
   * into the runtime state directory. Idempotent: only copies files whose id
   * does not already exist in the destination.
   */
  migrateFrom(legacyDir: string): void {
    if (legacyDir === this.dir) return;
    if (!fs.existsSync(legacyDir)) return;
    for (const file of fs.readdirSync(legacyDir)) {
      if (!file.endsWith(".json")) continue;
      const target = path.join(this.dir, file);
      if (fs.existsSync(target)) continue;
      fs.mkdirSync(this.dir, { recursive: true });
      fs.copyFileSync(path.join(legacyDir, file), target);
    }
  }

  /**
   * Acquire the single-writer lock. Returns `true` when acquired. A stale lock
   * (dead owner pid, or older than `maxAgeMs`) is broken and re-acquired.
   */
  acquireLock(maxAgeMs: number = DEFAULT_MAX_LOCK_AGE_MS): boolean {
    fs.mkdirSync(this.dir, { recursive: true });
    const lockPath = this.lockPath();
    const info: LockInfo = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
    };

    if (this.tryCreateLock(lockPath, info)) return true;
    if (!this.isLockStale(lockPath, maxAgeMs)) return false;

    try {
      fs.unlinkSync(lockPath);
    } catch {
      return false;
    }
    return this.tryCreateLock(lockPath, info);
  }

  releaseLock(): void {
    try {
      fs.unlinkSync(this.lockPath());
    } catch {
      // Lock may already be gone; release is best-effort.
    }
  }

  private tryCreateLock(lockPath: string, info: LockInfo): boolean {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify(info, null, 2), "utf-8");
      fs.closeSync(fd);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return false;
    }
  }

  private isLockStale(lockPath: string, maxAgeMs: number): boolean {
    try {
      const raw = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as Partial<LockInfo>;
      const startedAt =
        typeof raw.startedAt === "string" ? Date.parse(raw.startedAt) : NaN;
      if (!Number.isNaN(startedAt) && Date.now() - startedAt > maxAgeMs) {
        return true;
      }
      if (typeof raw.pid === "number") {
        try {
          process.kill(raw.pid, 0);
          return false;
        } catch (error) {
          return (error as NodeJS.ErrnoException).code === "ESRCH";
        }
      }
      return false;
    } catch {
      // Unreadable lock file is treated as stale so a crash never blocks forever.
      return true;
    }
  }

  list(): TransactionRecord[] {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(this.dir, file))
      .map((file) => {
        try {
          return JSON.parse(fs.readFileSync(file, "utf-8")) as TransactionRecord;
        } catch {
          return null;
        }
      })
      .filter((record): record is TransactionRecord => record !== null);
  }

  load(id: string): TransactionRecord | null {
    const file = this.fileFor(id);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8")) as TransactionRecord;
    } catch {
      return null;
    }
  }

  save(record: TransactionRecord): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(
      this.fileFor(record.id),
      JSON.stringify(record, null, 2),
      "utf-8"
    );
  }

  delete(id: string): void {
    const file = this.fileFor(id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}
