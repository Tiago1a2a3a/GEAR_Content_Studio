import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import {
  createDirectories,
  ensureDirectories,
} from "../../src/main/filesystem/storage";
import { inspectImages } from "../../src/main/filesystem/media";
import { requireGit } from "../../src/main/git/runner";
import { Publisher } from "../../src/main/repository/publisher";
import { ManagedRepository } from "../../src/main/repository/repository";
import type { LessonDraft } from "../../src/shared/types";

describe("publicação protegida", () => {
  let root: string;
  let remote: string;
  let repository: ManagedRepository;
  let publisher: Publisher;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gear-publish-"));
    remote = path.join(root, "remote.git");
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
        scripts: { "content:validate": 'node -e "process.exit(0)"' },
      }),
      "utf8",
    );
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
    repository = new ManagedRepository(directories.repository);
    await repository.synchronize(remote);
    await requireGit(repository.repositoryPath, ["config", "user.name", "Teste GEAR"]);
    await requireGit(repository.repositoryPath, [
      "config",
      "user.email",
      "teste@example.com",
    ]);
    publisher = new Publisher(directories, repository);
  });

  it("escreve, valida, audita staged e confirma o push em main", async () => {
    const [image] = await inspectImages([
      path.resolve("tests/fixtures/imagens/imagem-valida.png"),
    ]);
    const draft: LessonDraft = {
      id: randomUUID(),
      schemaVersion: 1,
      baseCommit: await repository.currentCommit(),
      slug: "aula-publicada-pelo-app",
      titulo: "Aula publicada pelo app",
      resumo: "Fluxo de integração local.",
      tags: ["teste"],
      dificuldade: "iniciante",
      dataPublicacao: "2026-07-20",
      autores: ["Equipe GEAR"],
      preRequisitos: [],
      videos: [],
      linksExternos: [],
      status: "rascunho",
      permiteComentarios: false,
      images: [image!],
      body: [
        { id: randomUUID(), kind: "paragraph", markdown: "Conteúdo seguro." },
        {
          id: randomUUID(),
          kind: "image",
          imageId: image!.id,
          alt: "Imagem de teste",
        },
      ],
    };
    const review = await publisher.prepareReview(draft);
    expect(review.mdxRelativePath).toContain(draft.slug);
    const prepared = await publisher.confirmWrite(review.operationId);
    expect(new Set(prepared.stagedPaths)).toEqual(
      new Set([review.mdxRelativePath, ...review.imageRelativePaths]),
    );
    const published = await publisher.confirmPublish(review.operationId);
    expect(published.pushedTo).toBe("origin/main");

    const observer = path.join(root, "observer");
    await requireGit(root, ["clone", "--branch", "main", remote, observer]);
    const mdx = await readFile(path.join(observer, review.mdxRelativePath), "utf8");
    expect(mdx).toContain("slug: aula-publicada-pelo-app");
    expect(await readFile(path.join(observer, review.imageRelativePaths[0]!))).toEqual(
      await readFile(image!.sourcePath),
    );
  });
});
