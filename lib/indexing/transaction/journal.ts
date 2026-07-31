import fs from "node:fs";
import path from "node:path";
import type { TransactionJournal, TransactionRecord } from "./types";

export class FileTransactionJournal implements TransactionJournal {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private fileFor(id: string): string {
    return path.join(this.dir, `${id}.json`);
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
