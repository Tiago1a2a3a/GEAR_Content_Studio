import { dialog, shell } from "electron";

import portalLockJson from "../../resources/contracts/portal-contract-lock.json";
import { filterCatalog } from "../shared/catalog";
import { remoteUrlSchema } from "../shared/schema";
import type {
  CatalogFilter,
  EnvironmentStatus,
  GearContentStudioApi,
  LessonDraft,
  Result,
} from "../shared/types";
import { fail, ok } from "../shared/types";
import { inspectImages } from "./filesystem/media";
import { SafeLogger } from "./filesystem/logger";
import {
  deleteDraft,
  ensureDirectories,
  listDrafts,
  loadDraft,
  loadSettings,
  saveDraft,
  saveSettings,
  type AppDirectories,
} from "./filesystem/storage";
import { runGit } from "./git/runner";
import { ManagedRepository } from "./repository/repository";
import { Publisher } from "./repository/publisher";
import { verifyPortalContract, type PortalContractLock } from "./validation/contract";

export class AppService implements GearContentStudioApi {
  readonly #repository: ManagedRepository;
  readonly #publisher: Publisher;
  readonly #logger: SafeLogger;

  constructor(private readonly directories: AppDirectories) {
    this.#repository = new ManagedRepository(directories.repository);
    this.#publisher = new Publisher(directories, this.#repository);
    this.#logger = new SafeLogger(directories.logs);
  }

  async initialize(): Promise<void> {
    await ensureDirectories(this.directories);
    const interrupted = await this.#publisher.inspectInterruptedOperation();
    if (!interrupted) return;
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "Operação interrompida",
      message: "Foi encontrada uma operação de publicação interrompida.",
      detail: interrupted.canRollbackCreatedFiles
        ? "O processo anterior não existe mais. O app pode remover somente os arquivos registrados no journal e cujo conteúdo não mudou. O rascunho será preservado."
        : "O processo anterior não existe mais, mas a operação pode ter chegado ao stage ou commit. O app preservará os arquivos e apenas liberará o lock para diagnóstico manual.",
      buttons: ["Preservar por enquanto", "Confirmar recuperação"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return;
    const recovered = await this.#publisher.recoverInterruptedOperation(
      interrupted.operationId,
    );
    if (recovered.preservedPaths.length) {
      await dialog.showMessageBox({
        type: "info",
        title: "Arquivos preservados",
        message:
          "A recuperação liberou o lock, mas preservou arquivos que exigem inspeção manual.",
        detail: recovered.preservedPaths.join("\n"),
      });
    }
  }

  async environmentCheck(): Promise<Result<EnvironmentStatus>> {
    return this.wrap("ENVIRONMENT_CHECK", async () => {
      const version = await runGit(process.cwd(), ["--version"]);
      if (version.exitCode !== 0) throw new Error("Git não foi encontrado.");
      const userName = (await runGit(process.cwd(), ["config", "--get", "user.name"]))
        .stdout;
      const userEmail = (await runGit(process.cwd(), ["config", "--get", "user.email"]))
        .stdout;
      const settings = await loadSettings(this.directories);
      const repositoryReady = await this.#repository.exists();
      let contractCompatible = false;
      let currentCommit: string | undefined;
      if (repositoryReady) {
        currentCommit = await this.#repository.currentCommit();
        contractCompatible = (
          await verifyPortalContract(
            this.#repository.repositoryPath,
            portalLockJson as PortalContractLock,
          )
        ).compatible;
      }
      return {
        gitVersion: version.stdout.trim(),
        userName: userName.trim() || undefined,
        userEmail: userEmail.trim() || undefined,
        configured: Boolean(settings),
        repositoryReady,
        contractCompatible,
        currentCommit,
      };
    });
  }

  async configure(input: Readonly<{ remoteUrl: string }>): Promise<Result<void>> {
    return this.wrap("CONFIGURE", async () => {
      const remoteUrl = remoteUrlSchema.parse(input.remoteUrl);
      const current = await loadSettings(this.directories);
      if (
        current &&
        current.remoteUrl.toLowerCase() !== remoteUrl.toLowerCase() &&
        (await this.#repository.exists())
      ) {
        throw new Error(
          "Para trocar o remoto, recrie explicitamente o clone gerenciado primeiro.",
        );
      }
      await saveSettings(this.directories, remoteUrl);
    });
  }

  async synchronize(): Promise<
    Result<Readonly<{ commit: string; indexedEntries: number }>>
  > {
    return this.wrap("SYNCHRONIZE", async () => {
      const settings = await loadSettings(this.directories);
      if (!settings) throw new Error("Configure o remoto antes de sincronizar.");
      const commit = await this.#repository.synchronize(settings.remoteUrl);
      return { commit, indexedEntries: (await this.#repository.catalog()).length };
    });
  }

  async listCatalog(filter: CatalogFilter = {}) {
    return this.wrap("LIST_CATALOG", async () =>
      filterCatalog(await this.#repository.catalog(), filter),
    );
  }

  async chooseImages() {
    return this.wrap("CHOOSE_IMAGES", async () => {
      const selection = await dialog.showOpenDialog({
        title: "Selecionar imagens da Aula",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      return selection.canceled ? [] : inspectImages(selection.filePaths);
    });
  }

  async saveDraft(draft: LessonDraft) {
    return this.wrap("SAVE_DRAFT", () => saveDraft(this.directories, draft));
  }

  async listDrafts() {
    return this.wrap("LIST_DRAFTS", () => listDrafts(this.directories));
  }

  async loadDraft(id: string) {
    return this.wrap("LOAD_DRAFT", () => loadDraft(this.directories, id));
  }

  async deleteDraft(id: string) {
    return this.wrap("DELETE_DRAFT", () => deleteDraft(this.directories, id));
  }

  async prepareReview(draft: LessonDraft) {
    return this.wrap("PREPARE_REVIEW", () => this.#publisher.prepareReview(draft));
  }

  async confirmWrite(operationId: string) {
    return this.wrap("CONFIRM_WRITE", () => this.#publisher.confirmWrite(operationId));
  }

  async confirmPublish(operationId: string) {
    return this.wrap("CONFIRM_PUBLISH", () =>
      this.#publisher.confirmPublish(operationId),
    );
  }

  async cancelOperation(operationId: string) {
    return this.wrap("CANCEL_OPERATION", () => this.#publisher.cancel(operationId));
  }

  async openExternalHttps(url: string): Promise<Result<void>> {
    return this.wrap("OPEN_EXTERNAL", async () => {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("Somente links HTTPS.");
      await shell.openExternal(parsed.toString());
    });
  }

  async copyDiagnostic(detailsId: string) {
    return this.wrap("COPY_DIAGNOSTIC", () => this.#logger.diagnostic(detailsId));
  }

  private async wrap<T>(event: string, action: () => Promise<T>): Promise<Result<T>> {
    try {
      return ok(await action());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      const detailsId = await this.#logger.log("error", event, { message });
      return fail(event, "Não foi possível concluir", message, {
        detailsId,
        retryable: true,
      });
    }
  }
}
