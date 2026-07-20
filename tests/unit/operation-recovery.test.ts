import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createOperationJournal,
  fileMatchesJournal,
  readOperationJournal,
  recordCreatedFile,
  setJournalState,
} from "../../src/main/filesystem/operation-journal";
import { OperationLock } from "../../src/main/filesystem/operation-lock";

describe("journal e lock de recuperação", () => {
  it("registra estado e hash de cada arquivo criado", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gear-journal-"));
    const repository = path.join(root, "repository");
    const staging = path.join(root, "staging", "operation");
    const relativePath = "src/content/aprendizado/aulas/aula.mdx";
    await mkdir(path.join(repository, path.dirname(relativePath)), {
      recursive: true,
    });
    await writeFile(path.join(repository, relativePath), "conteúdo\n");
    await createOperationJournal(staging, "operation", "base");
    await recordCreatedFile(staging, repository, relativePath);
    await setJournalState(staging, "validating");

    const journal = await readOperationJournal(staging);
    expect(journal?.state).toBe("validating");
    expect(journal?.createdFiles).toHaveLength(1);
    expect(await fileMatchesJournal(repository, journal!.createdFiles[0]!)).toBe(true);

    await writeFile(path.join(repository, relativePath), "alterado\n");
    expect(await fileMatchesJournal(repository, journal!.createdFiles[0]!)).toBe(false);
  });

  it("só libera lock órfão após confirmação explícita", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gear-lock-"));
    const lockPath = path.join(root, "operation.lock");
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 2_147_483_647,
        createdAt: new Date().toISOString(),
        operationId: "orphan",
      }),
    );
    const lock = new OperationLock(lockPath);
    expect((await lock.inspectOrphan())?.operationId).toBe("orphan");
    await lock.releaseConfirmedOrphan("orphan");
    await expect(access(lockPath)).rejects.toThrow();
  });
});
