import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { parseCatalog } from "../../shared/catalog";
import type { CatalogEntry } from "../../shared/types";
import { requireGit, runCommand, runGit } from "../git/runner";

export class ManagedRepository {
  #catalog: CatalogEntry[] = [];

  constructor(readonly repositoryPath: string) {}

  async exists(): Promise<boolean> {
    try {
      return (await stat(path.join(this.repositoryPath, ".git"))).isDirectory();
    } catch {
      return false;
    }
  }

  async clone(remoteUrl: string, parentDirectory: string): Promise<void> {
    await mkdir(parentDirectory, { recursive: true });
    const result = await runGit(parentDirectory, [
      "clone",
      "--origin",
      "origin",
      "--branch",
      "main",
      "--single-branch",
      remoteUrl,
      this.repositoryPath,
    ]);
    if (result.exitCode !== 0) throw new Error(result.stderr || "Falha ao clonar.");
  }

  async validateOrigin(expectedUrl: string): Promise<void> {
    const actual = await requireGit(this.repositoryPath, [
      "remote",
      "get-url",
      "origin",
    ]);
    const normalize = (value: string) =>
      value
        .replace(/\.git$/i, "")
        .replace(/\/+$/, "")
        .toLowerCase();
    if (normalize(actual) !== normalize(expectedUrl)) {
      throw new Error(
        "O origin do clone gerenciado não corresponde ao remoto configurado.",
      );
    }
  }

  async currentCommit(): Promise<string> {
    return requireGit(this.repositoryPath, ["rev-parse", "HEAD"]);
  }

  async remoteCommit(): Promise<string> {
    return requireGit(this.repositoryPath, ["rev-parse", "origin/main"]);
  }

  async ensureClean(): Promise<void> {
    const status = await requireGit(this.repositoryPath, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    if (status.length) throw new Error("O clone gerenciado possui alterações locais.");
  }

  async synchronize(remoteUrl: string): Promise<string> {
    if (!(await this.exists())) {
      await this.clone(remoteUrl, path.dirname(this.repositoryPath));
    }
    await this.validateOrigin(remoteUrl);
    await this.ensureClean();
    await requireGit(this.repositoryPath, ["fetch", "--prune", "origin", "main"]);
    await requireGit(this.repositoryPath, ["merge", "--ff-only", "origin/main"]);
    await this.ensureClean();
    this.#catalog = await parseCatalog(this.repositoryPath);
    return this.currentCommit();
  }

  async catalog(refresh = false): Promise<CatalogEntry[]> {
    if (refresh || !this.#catalog.length) {
      this.#catalog = await parseCatalog(this.repositoryPath);
    }
    return [...this.#catalog];
  }

  async validatePortalCommand(): Promise<void> {
    await access(path.join(this.repositoryPath, "package.json"));
    await this.catalog(true);
    try {
      await access(
        path.join(this.repositoryPath, "node_modules", "velite", "package.json"),
      );
    } catch {
      // O adaptador empacotado já validou draft, serialização, catálogo e contrato.
      // O Velite congelado é executado adicionalmente quando o clone possui deps.
      return;
    }
    let command = "npm";
    let args = ["run", "content:validate"];
    if (process.platform === "win32") {
      const nodeLookup = await runCommand("where.exe", ["node"], {
        cwd: this.repositoryPath,
      });
      const nodeExecutable = nodeLookup.stdout.split(/\r?\n/).find(Boolean);
      if (nodeLookup.exitCode !== 0 || !nodeExecutable) {
        return;
      }
      const npmCli = path.join(
        path.dirname(nodeExecutable),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      );
      await access(npmCli);
      command = nodeExecutable;
      args = [npmCli, "run", "content:validate"];
    }
    const result = await runCommand(command, args, {
      cwd: this.repositoryPath,
      timeoutMs: 120_000,
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || "Validação do Portal falhou.");
    }
  }
}
