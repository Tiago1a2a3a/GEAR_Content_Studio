import { open, readFile, rm } from "node:fs/promises";

export type OperationLockInfo = Readonly<{
  pid: number;
  createdAt: string;
  operationId: string;
}>;

export class OperationLock {
  #operationId?: string;

  constructor(private readonly filePath: string) {}

  async acquire(operationId: string): Promise<void> {
    try {
      const handle = await open(this.filePath, "wx");
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
          operationId,
        }),
        "utf8",
      );
      await handle.close();
      this.#operationId = operationId;
    } catch {
      const current = await readFile(this.filePath, "utf8").catch(() => "");
      throw new Error(`Outra operação mutável está ativa. ${current}`);
    }
  }

  async release(operationId: string): Promise<void> {
    if (this.#operationId !== operationId) return;
    await rm(this.filePath, { force: true });
    this.#operationId = undefined;
  }

  async inspectOrphan(): Promise<OperationLockInfo | undefined> {
    const current = await this.read();
    if (!current || isProcessRunning(current.pid)) return undefined;
    return current;
  }

  async releaseConfirmedOrphan(operationId: string): Promise<void> {
    const current = await this.inspectOrphan();
    if (!current || current.operationId !== operationId) {
      throw new Error("O lock mudou ou o processo original ainda está ativo.");
    }
    await rm(this.filePath, { force: true });
  }

  private async read(): Promise<OperationLockInfo | undefined> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as Partial<OperationLockInfo>;
      if (
        typeof parsed.pid !== "number" ||
        typeof parsed.createdAt !== "string" ||
        typeof parsed.operationId !== "string"
      ) {
        return undefined;
      }
      return parsed as OperationLockInfo;
    } catch {
      return undefined;
    }
  }
}

function isProcessRunning(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
