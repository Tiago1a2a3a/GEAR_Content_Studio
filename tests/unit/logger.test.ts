import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SafeLogger } from "../../src/main/filesystem/logger";

describe("logs seguros", () => {
  it("mantém no máximo cinco arquivos de até 2 MiB por rotação", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gear-logs-"));
    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        writeFile(path.join(directory, `app-${index + 1}.log`), "antigo\n"),
      ),
    );
    await writeFile(path.join(directory, "app.log"), Buffer.alloc(2 * 1024 * 1024));

    await new SafeLogger(directory).log("info", "ROTATE_TEST");

    const logs = (await readdir(directory)).filter((name) => name.endsWith(".log"));
    expect(logs).toHaveLength(5);
    expect(logs).toContain("app.log");
  });
});
