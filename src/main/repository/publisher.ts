import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import portalLockJson from "../../../resources/contracts/portal-contract-lock.json";
import { assertAllowedPaths, resolveConfinedForWrite } from "../../shared/paths";
import { serializeLesson } from "../../shared/serializer";
import type {
  LessonDraft,
  PublishBundle,
  ReviewBundle,
  ValidationIssue,
} from "../../shared/types";
import { validateDraft } from "../../shared/validation";
import { OperationLock } from "../filesystem/operation-lock";
import {
  createOperationJournal,
  fileMatchesJournal,
  readOperationJournal,
  recordCreatedFile,
  setJournalState,
  type OperationJournalState,
} from "../filesystem/operation-journal";
import { deleteDraft, type AppDirectories } from "../filesystem/storage";
import { requireGit } from "../git/runner";
import { verifyPortalContract, type PortalContractLock } from "../validation/contract";
import { ManagedRepository } from "./repository";

type PendingOperation = {
  draft: LessonDraft;
  stagingRoot: string;
  relativePaths: string[];
  writtenPaths: string[];
  state: "review" | "written" | "committed" | "blocked";
};

export type InterruptedOperation = Readonly<{
  operationId: string;
  createdAt: string;
  state?: OperationJournalState;
  canRollbackCreatedFiles: boolean;
}>;

export class Publisher {
  readonly #operations = new Map<string, PendingOperation>();
  readonly #lock: OperationLock;

  constructor(
    private readonly directories: AppDirectories,
    private readonly repository: ManagedRepository,
  ) {
    this.#lock = new OperationLock(directories.operationLock);
  }

  async prepareReview(draft: LessonDraft): Promise<ReviewBundle> {
    await this.repository.ensureClean();
    const currentCommit = await this.repository.currentCommit();
    if (draft.baseCommit !== currentCommit) {
      throw new Error(
        "A main mudou desde o início do rascunho. Sincronize e revise novamente.",
      );
    }
    const contract = await verifyPortalContract(
      this.repository.repositoryPath,
      portalLockJson as PortalContractLock,
    );
    if (!contract.compatible) {
      throw new Error(`Contrato do Portal mudou: ${contract.mismatches.join(", ")}`);
    }
    const issues = validateDraft(draft, await this.repository.catalog(true));
    const errors = issues.filter((candidate) => candidate.severity === "error");
    if (errors.length)
      throw new Error(errors.map((candidate) => candidate.message).join("\n"));

    const operationId = randomUUID();
    await this.#lock.acquire(operationId);
    try {
      const stagingRoot = path.join(this.directories.staging, operationId);
      const mdxRelativePath = `src/content/aprendizado/aulas/${draft.slug}.mdx`;
      const imageRelativePaths = draft.images.map(
        (image) => `public/images/content/aulas/${draft.slug}/${image.normalizedName}`,
      );
      const relativePaths = [mdxRelativePath, ...imageRelativePaths];
      assertAllowedPaths(relativePaths);
      await Promise.all(
        relativePaths.map(async (relativePath) => {
          const destination = await resolveConfinedForWrite(
            this.repository.repositoryPath,
            relativePath,
          );
          try {
            await readFile(destination);
            throw new Error(`O destino já existe: ${relativePath}`);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }),
      );
      await mkdir(path.join(stagingRoot, "images"), { recursive: true });
      const generatedMdx = serializeLesson(draft);
      await writeFile(path.join(stagingRoot, "lesson.mdx"), generatedMdx, {
        encoding: "utf8",
        flag: "wx",
      });
      await Promise.all(
        draft.images.map((image) =>
          copyFile(
            image.sourcePath,
            path.join(stagingRoot, "images", image.normalizedName),
            constants.COPYFILE_EXCL,
          ),
        ),
      );
      await createOperationJournal(stagingRoot, operationId, draft.baseCommit);
      this.#operations.set(operationId, {
        draft,
        stagingRoot,
        relativePaths,
        writtenPaths: [],
        state: "review",
      });
      return {
        operationId,
        baseCommit: currentCommit,
        mdxRelativePath,
        imageRelativePaths,
        generatedMdx,
        issues: issues as ValidationIssue[],
      };
    } catch (error) {
      await this.#lock.release(operationId);
      throw error;
    }
  }

  async confirmWrite(operationId: string): Promise<PublishBundle> {
    const operation = this.requireOperation(operationId, "review");
    try {
      await this.repository.ensureClean();
      await requireGit(this.repository.repositoryPath, [
        "fetch",
        "--prune",
        "origin",
        "main",
      ]);
      const remoteCommit = await this.repository.remoteCommit();
      const currentCommit = await this.repository.currentCommit();
      if (
        operation.draft.baseCommit !== remoteCommit ||
        operation.draft.baseCommit !== currentCommit
      ) {
        throw new Error(
          "A main remota mudou. A revisão anterior não pode ser publicada.",
        );
      }
      await setJournalState(operation.stagingRoot, "writing");
      const mdxRelativePath = operation.relativePaths[0]!;
      let mdxDestination = await resolveConfinedForWrite(
        this.repository.repositoryPath,
        mdxRelativePath,
      );
      await mkdir(path.dirname(mdxDestination), { recursive: true });
      mdxDestination = await resolveConfinedForWrite(
        this.repository.repositoryPath,
        mdxRelativePath,
      );
      await copyFile(
        path.join(operation.stagingRoot, "lesson.mdx"),
        mdxDestination,
        constants.COPYFILE_EXCL,
      );
      operation.writtenPaths.push(mdxDestination);
      await recordCreatedFile(
        operation.stagingRoot,
        this.repository.repositoryPath,
        mdxRelativePath,
      );
      for (const image of operation.draft.images) {
        const relativePath = `public/images/content/aulas/${operation.draft.slug}/${image.normalizedName}`;
        let destination = await resolveConfinedForWrite(
          this.repository.repositoryPath,
          relativePath,
        );
        await mkdir(path.dirname(destination), { recursive: true });
        destination = await resolveConfinedForWrite(
          this.repository.repositoryPath,
          relativePath,
        );
        await copyFile(
          path.join(operation.stagingRoot, "images", image.normalizedName),
          destination,
          constants.COPYFILE_EXCL,
        );
        operation.writtenPaths.push(destination);
        await recordCreatedFile(
          operation.stagingRoot,
          this.repository.repositoryPath,
          relativePath,
        );
      }
      await setJournalState(operation.stagingRoot, "validating");
      await this.repository.validatePortalCommand();
      const rawWorking = await requireGit(this.repository.repositoryPath, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
      ]);
      const workingPaths = rawWorking
        .split("\0")
        .filter(Boolean)
        .map((entry) => entry.slice(3));
      assertExactPaths(workingPaths, operation.relativePaths, "working tree");
      await setJournalState(operation.stagingRoot, "staging");
      await requireGit(this.repository.repositoryPath, [
        "add",
        "--",
        ...operation.relativePaths,
      ]);
      const rawNames = await requireGit(this.repository.repositoryPath, [
        "diff",
        "--cached",
        "--name-only",
        "-z",
      ]);
      const stagedPaths = rawNames.split("\0").filter(Boolean);
      assertExactPaths(stagedPaths, operation.relativePaths, "staged");
      const stagedDiff = await requireGit(this.repository.repositoryPath, [
        "diff",
        "--cached",
        "--",
        ...operation.relativePaths,
      ]);
      await setJournalState(operation.stagingRoot, "staged");
      operation.state = "written";
      return {
        operationId,
        stagedDiff,
        stagedPaths,
        commitMessage: `content(aula): adiciona ${operation.draft.slug}`,
        branch: "main",
      };
    } catch (error) {
      const journal = await readOperationJournal(operation.stagingRoot);
      if (journal && ["staging", "staged", "committed"].includes(journal.state)) {
        operation.state = "blocked";
        throw new Error(
          `A operação falhou após iniciar o stage. Os arquivos e o índice foram preservados para diagnóstico. ${error instanceof Error ? error.message : ""}`,
          { cause: error },
        );
      }
      await this.rollbackCreated(operation);
      await rm(operation.stagingRoot, { recursive: true, force: true });
      await this.#lock.release(operationId);
      this.#operations.delete(operationId);
      throw error;
    }
  }

  async confirmPublish(
    operationId: string,
  ): Promise<Readonly<{ commit: string; pushedTo: "origin/main" }>> {
    const operation = this.requireOperation(operationId, "written");
    const commitMessage = `content(aula): adiciona ${operation.draft.slug}`;
    await requireGit(this.repository.repositoryPath, ["commit", "-m", commitMessage]);
    await setJournalState(operation.stagingRoot, "committed");
    operation.state = "committed";
    await requireGit(this.repository.repositoryPath, [
      "fetch",
      "--prune",
      "origin",
      "main",
    ]);
    if ((await this.repository.remoteCommit()) !== operation.draft.baseCommit) {
      await this.#lock.release(operationId);
      throw new Error(
        "A main remota mudou após o commit. O commit local foi preservado e não foi enviado.",
      );
    }
    await requireGit(this.repository.repositoryPath, ["push", "origin", "HEAD:main"]);
    const commit = await this.repository.currentCommit();
    await requireGit(this.repository.repositoryPath, [
      "fetch",
      "--prune",
      "origin",
      "main",
    ]);
    if ((await this.repository.remoteCommit()) !== commit) {
      throw new Error("O push retornou sem confirmar o commit em origin/main.");
    }
    this.#operations.delete(operationId);
    await Promise.allSettled([
      rm(operation.stagingRoot, { recursive: true, force: true }),
      deleteDraft(this.directories, operation.draft.id),
      this.#lock.release(operationId),
      this.repository.catalog(true),
    ]);
    return { commit, pushedTo: "origin/main" };
  }

  async cancel(operationId: string): Promise<void> {
    const operation = this.#operations.get(operationId);
    if (!operation) return;
    if (operation.state !== "review") {
      throw new Error(
        "Após escrever no clone, o cancelamento automático é bloqueado para preservar diagnóstico.",
      );
    }
    await rm(operation.stagingRoot, { recursive: true, force: true });
    await this.#lock.release(operationId);
    this.#operations.delete(operationId);
  }

  async inspectInterruptedOperation(): Promise<InterruptedOperation | undefined> {
    const lock = await this.#lock.inspectOrphan();
    if (!lock) return undefined;
    const journal = await readOperationJournal(
      path.join(this.directories.staging, lock.operationId),
    );
    return {
      operationId: lock.operationId,
      createdAt: lock.createdAt,
      state: journal?.state,
      canRollbackCreatedFiles: Boolean(
        journal && ["review", "writing", "validating"].includes(journal.state),
      ),
    };
  }

  async recoverInterruptedOperation(
    operationId: string,
  ): Promise<Readonly<{ preservedPaths: string[] }>> {
    const lock = await this.#lock.inspectOrphan();
    if (!lock || lock.operationId !== operationId) {
      throw new Error("A operação interrompida não está mais disponível.");
    }
    const stagingRoot = path.join(this.directories.staging, operationId);
    const journal = await readOperationJournal(stagingRoot);
    const preservedPaths: string[] = [];
    if (journal) {
      const canRollback = ["review", "writing", "validating"].includes(journal.state);
      for (const file of [...journal.createdFiles].reverse()) {
        if (
          canRollback &&
          (await fileMatchesJournal(this.repository.repositoryPath, file))
        ) {
          await rm(
            await resolveConfinedForWrite(
              this.repository.repositoryPath,
              file.relativePath,
            ),
            { force: true },
          );
        } else {
          preservedPaths.push(file.relativePath);
        }
      }
      if (!preservedPaths.length && canRollback) {
        await rm(stagingRoot, { recursive: true, force: true });
      }
    }
    await this.#lock.releaseConfirmedOrphan(operationId);
    return { preservedPaths };
  }

  private requireOperation(
    operationId: string,
    expected: PendingOperation["state"],
  ): PendingOperation {
    const operation = this.#operations.get(operationId);
    if (!operation || operation.state !== expected) {
      throw new Error("Operação ausente, expirada ou em estado incompatível.");
    }
    return operation;
  }

  private async rollbackCreated(operation: PendingOperation): Promise<void> {
    for (const createdPath of operation.writtenPaths.reverse()) {
      await rm(createdPath, { force: true });
    }
  }
}

function assertExactPaths(
  actualPaths: string[],
  expectedPaths: string[],
  label: string,
): void {
  assertAllowedPaths(actualPaths);
  if (
    actualPaths.length !== expectedPaths.length ||
    !expectedPaths.every((candidate) => actualPaths.includes(candidate))
  ) {
    throw new Error(`O ${label} não corresponde exatamente aos arquivos aprovados.`);
  }
}
