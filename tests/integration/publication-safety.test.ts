import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createDirectories,
  ensureDirectories,
  saveDraft,
} from "../../src/main/filesystem/storage";
import { requireGit } from "../../src/main/git/runner";
import { Publisher } from "../../src/main/repository/publisher";
import { ManagedRepository } from "../../src/main/repository/repository";
import type { LessonDraft } from "../../src/shared/types";

async function setup(validationExitCode = 0) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gear-safety-"));
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  await requireGit(root, ["init", "--bare", remote]);
  await mkdir(seed);
  await requireGit(seed, ["init", "-b", "main"]);
  await requireGit(seed, ["config", "user.name", "Teste GEAR"]);
  await requireGit(seed, ["config", "user.email", "teste@example.com"]);
  for (const fileName of [
    "content.schemas.ts",
    "content.validation.ts",
    "velite.config.mts",
  ]) {
    await copyFile(
      path.resolve("tests/fixtures/portal-minimo", fileName),
      path.join(seed, fileName),
    );
  }
  await writeFile(
    path.join(seed, "package.json"),
    JSON.stringify({
      scripts: {
        "content:validate": `node -e "process.exit(${validationExitCode})"`,
      },
    }),
  );
  await writeFile(path.join(seed, ".gitignore"), "node_modules/\n");
  await mkdir(path.join(seed, "src/content/aprendizado/aulas"), {
    recursive: true,
  });
  await requireGit(seed, ["add", "--", "."]);
  await requireGit(seed, ["commit", "-m", "fixture"]);
  await requireGit(seed, ["remote", "add", "origin", remote]);
  await requireGit(seed, ["push", "origin", "HEAD:main"]);
  await requireGit(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  const directories = createDirectories(path.join(root, "app-data"));
  await ensureDirectories(directories);
  const repository = new ManagedRepository(directories.repository);
  await repository.synchronize(remote);
  await requireGit(repository.repositoryPath, ["config", "user.name", "Teste GEAR"]);
  await requireGit(repository.repositoryPath, [
    "config",
    "user.email",
    "teste@example.com",
  ]);
  return {
    root,
    remote,
    seed,
    directories,
    repository,
    publisher: new Publisher(directories, repository),
  };
}

function draft(baseCommit: string, slug = "aula-segura"): LessonDraft {
  return {
    id: randomUUID(),
    schemaVersion: 1,
    baseCommit,
    slug,
    titulo: "Aula segura",
    resumo: "Fluxo protegido.",
    tags: ["teste"],
    dificuldade: "iniciante",
    dataPublicacao: "2026-07-20",
    autores: ["Equipe GEAR"],
    preRequisitos: [],
    videos: [],
    linksExternos: [],
    status: "rascunho",
    permiteComentarios: false,
    images: [],
    body: [{ id: randomUUID(), kind: "paragraph", markdown: "Conteúdo." }],
  };
}

async function advanceRemote(seed: string, fileName: string): Promise<void> {
  await writeFile(path.join(seed, fileName), `${Date.now()}\n`);
  await requireGit(seed, ["add", "--", fileName]);
  await requireGit(seed, ["commit", "-m", `concorrente ${fileName}`]);
  await requireGit(seed, ["push", "origin", "HEAD:main"]);
}

describe("falhas de publicação são seguras", () => {
  it("bloqueia alteração remota concorrente antes de escrever", async () => {
    const context = await setup();
    const value = draft(await context.repository.currentCommit());
    const review = await context.publisher.prepareReview(value);
    await advanceRemote(context.seed, "CONCURRENT.md");

    await expect(context.publisher.confirmWrite(review.operationId)).rejects.toThrow(
      /main remota mudou/,
    );
    await expect(
      access(path.join(context.repository.repositoryPath, review.mdxRelativePath)),
    ).rejects.toThrow();
    await context.publisher.cancel(review.operationId);
  });

  it("remove somente o arquivo criado quando o validador falha antes do stage", async () => {
    const context = await setup(1);
    await mkdir(path.join(context.repository.repositoryPath, "node_modules/velite"), {
      recursive: true,
    });
    await writeFile(
      path.join(context.repository.repositoryPath, "node_modules/velite/package.json"),
      "{}",
    );
    const value = draft(await context.repository.currentCommit());
    const review = await context.publisher.prepareReview(value);

    await expect(context.publisher.confirmWrite(review.operationId)).rejects.toThrow(
      /content:validate|Validação do Portal falhou/,
    );
    await expect(
      access(path.join(context.repository.repositoryPath, review.mdxRelativePath)),
    ).rejects.toThrow();
    await expect(context.repository.ensureClean()).resolves.toBeUndefined();
  });

  it("preserva commit e rascunho quando a main muda após o commit local", async () => {
    const context = await setup();
    const value = draft(await context.repository.currentCommit());
    await saveDraft(context.directories, value);
    const review = await context.publisher.prepareReview(value);
    await context.publisher.confirmWrite(review.operationId);
    await advanceRemote(context.seed, "AFTER-STAGE.md");

    await expect(context.publisher.confirmPublish(review.operationId)).rejects.toThrow(
      /commit local foi preservado/,
    );
    expect(await context.repository.currentCommit()).not.toBe(
      await context.repository.remoteCommit(),
    );
    expect(
      await readFile(path.join(context.directories.drafts, `${value.id}.json`), "utf8"),
    ).toContain(value.slug);
    expect(
      await readFile(
        path.join(context.repository.repositoryPath, review.mdxRelativePath),
        "utf8",
      ),
    ).toContain(value.slug);
  });
});
