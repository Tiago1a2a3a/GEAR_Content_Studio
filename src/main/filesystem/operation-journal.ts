import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertAllowedPaths, resolveConfinedForWrite } from "../../shared/paths";

export type OperationJournalState =
  "review" | "writing" | "validating" | "staging" | "staged" | "committed";

export type OperationJournal = Readonly<{
  schemaVersion: 1;
  operationId: string;
  baseCommit: string;
  createdAt: string;
  state: OperationJournalState;
  createdFiles: ReadonlyArray<
    Readonly<{
      relativePath: string;
      sha256: string;
    }>
  >;
  modifiedFiles: ReadonlyArray<
    Readonly<{
      relativePath: string;
      backupName: string;
    }>
  >;
}>;

export function journalPath(stagingRoot: string): string {
  return path.join(stagingRoot, "journal.json");
}

export async function createOperationJournal(
  stagingRoot: string,
  operationId: string,
  baseCommit: string,
): Promise<OperationJournal> {
  const journal: OperationJournal = {
    schemaVersion: 1,
    operationId,
    baseCommit,
    createdAt: new Date().toISOString(),
    state: "review",
    createdFiles: [],
    modifiedFiles: [],
  };
  await writeJournal(journalPath(stagingRoot), journal);
  return journal;
}

export async function readOperationJournal(
  stagingRoot: string,
): Promise<OperationJournal | undefined> {
  try {
    const parsed = JSON.parse(
      await readFile(journalPath(stagingRoot), "utf8"),
    ) as OperationJournal;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.operationId !== "string" ||
      typeof parsed.baseCommit !== "string" ||
      !Array.isArray(parsed.createdFiles)
    ) {
      return undefined;
    }
    assertAllowedPaths(parsed.createdFiles.map((file) => file.relativePath));
    if (Array.isArray(parsed.modifiedFiles)) {
      assertAllowedPaths(parsed.modifiedFiles.map((file) => file.relativePath));
    }
    return {
      ...parsed,
      modifiedFiles: Array.isArray(parsed.modifiedFiles) ? parsed.modifiedFiles : [],
    };
  } catch {
    return undefined;
  }
}

export async function setJournalState(
  stagingRoot: string,
  state: OperationJournalState,
): Promise<void> {
  const current = await requiredJournal(stagingRoot);
  await writeJournal(journalPath(stagingRoot), { ...current, state });
}

export async function recordCreatedFile(
  stagingRoot: string,
  repositoryRoot: string,
  relativePath: string,
): Promise<void> {
  assertAllowedPaths([relativePath]);
  const absolutePath = await resolveConfinedForWrite(repositoryRoot, relativePath);
  const sha256 = createHash("sha256")
    .update(await readFile(absolutePath))
    .digest("hex");
  const current = await requiredJournal(stagingRoot);
  await writeJournal(journalPath(stagingRoot), {
    ...current,
    createdFiles: [...current.createdFiles, { relativePath, sha256 }],
  });
}

export async function recordModifiedFile(
  stagingRoot: string,
  relativePath: string,
  backupName: string,
): Promise<void> {
  assertAllowedPaths([relativePath]);
  if (!/^[a-z0-9.-]+$/i.test(backupName)) {
    throw new Error("Nome de backup inválido.");
  }
  const current = await requiredJournal(stagingRoot);
  await writeJournal(journalPath(stagingRoot), {
    ...current,
    modifiedFiles: [...current.modifiedFiles, { relativePath, backupName }],
  });
}

export async function fileMatchesJournal(
  repositoryRoot: string,
  file: OperationJournal["createdFiles"][number],
): Promise<boolean> {
  try {
    const digest = createHash("sha256")
      .update(
        await readFile(
          await resolveConfinedForWrite(repositoryRoot, file.relativePath),
        ),
      )
      .digest("hex");
    return digest === file.sha256;
  } catch {
    return false;
  }
}

async function requiredJournal(stagingRoot: string): Promise<OperationJournal> {
  const journal = await readOperationJournal(stagingRoot);
  if (!journal) throw new Error("Journal da operação ausente ou inválido.");
  return journal;
}

async function writeJournal(
  filePath: string,
  journal: OperationJournal,
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, filePath);
}
