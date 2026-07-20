import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { redact } from "../../shared/redaction";

export class SafeLogger {
  readonly #diagnostics = new Map<string, string>();

  constructor(private readonly directory: string) {}

  async log(
    level: "info" | "warn" | "error",
    event: string,
    details: Record<string, unknown> = {},
  ): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const detailsId = randomUUID();
    const safeDetails = redact(JSON.stringify(details));
    const line = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      detailsId,
      details: safeDetails,
    })}\n`;
    const file = path.join(this.directory, "app.log");
    try {
      if ((await stat(file)).size >= 2 * 1024 * 1024) {
        await rename(file, path.join(this.directory, `app-${Date.now()}.log`));
        await this.pruneRotatedLogs();
      }
    } catch {
      // First log file.
    }
    await appendFile(file, line, "utf8");
    this.#diagnostics.set(detailsId, line);
    return detailsId;
  }

  async diagnostic(detailsId: string): Promise<string> {
    const inMemory = this.#diagnostics.get(detailsId);
    if (inMemory) return inMemory;
    return redact(await readFile(path.join(this.directory, "app.log"), "utf8"));
  }

  private async pruneRotatedLogs(): Promise<void> {
    const rotated = (await readdir(this.directory))
      .filter((name) => /^app-\d+\.log$/.test(name))
      .sort()
      .reverse();
    await Promise.all(
      rotated
        .slice(4)
        .map((name) => rm(path.join(this.directory, name), { force: true })),
    );
  }
}
