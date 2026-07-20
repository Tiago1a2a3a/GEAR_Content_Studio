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

import { beforeAll, describe, expect, it } from "vitest";

import {
  createDirectories,
  ensureDirectories,
} from "../../src/main/filesystem/storage";
import { inspectImages } from "../../src/main/filesystem/media";
import { requireGit } from "../../src/main/git/runner";
import { Publisher } from "../../src/main/repository/publisher";
import { ManagedRepository } from "../../src/main/repository/repository";
import type { ContentType, LessonDraft } from "../../src/shared/types";

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

    const deleted = await publisher.deletePublished(review.mdxRelativePath);
    expect(deleted.pushedTo).toBe("origin/main");
    const deletionObserver = path.join(root, "deletion-observer");
    await requireGit(root, ["clone", "--branch", "main", remote, deletionObserver]);
    await expect(
      access(path.join(deletionObserver, review.mdxRelativePath)),
    ).rejects.toThrow();
  });

  it("publica e remove casos GPT dos cinco tipos em um remoto temporário", async () => {
    const publishedPaths: string[] = [];
    const publishCase = async (
      type: ContentType,
      relations: Partial<LessonDraft> = {},
    ) => {
      const [cover] = await inspectImages([
        path.resolve("tests/fixtures/imagens/imagem-valida.png"),
      ]);
      const suffix = `${type}-gpt-teste-001`;
      const value: LessonDraft = {
        id: randomUUID(),
        schemaVersion: 1,
        baseCommit: await repository.currentCommit(),
        contentType: type,
        slug: suffix,
        titulo: `${type}_gpt_teste_001`,
        resumo: `Caso completo de ${type}.`,
        descricaoLonga: "Descrição longa do caso automatizado.",
        tags: ["gpt-teste", type],
        categoria: "Testes",
        dificuldade: "intermediário",
        dataPublicacao: "2026-07-20",
        autores: type === "aula" || type === "noticia" ? ["GPT Teste"] : [],
        preRequisitos: [],
        videos:
          type === "aula" || type === "projeto" ? ["https://example.com/video"] : [],
        linksExternos:
          type === "aula" ? [{ titulo: "Referência", url: "https://example.com" }] : [],
        repositorioGithub:
          type === "aula" || type === "projeto"
            ? "https://github.com/Tiago1a2a3a/Site_Gear"
            : undefined,
        tecnologias: type === "projeto" ? ["TypeScript", "MDX"] : undefined,
        documentacao: type === "projeto" ? "https://example.com/docs" : undefined,
        destaque: type === "curso" || type === "projeto" ? true : undefined,
        ordem: type === "trilha" ? 1 : undefined,
        status: "publicado",
        permiteComentarios: type === "aula",
        images: [cover!],
        bannerImageId: cover!.id,
        body: [
          { id: randomUUID(), kind: "heading", level: 2, text: "Teste GPT" },
          { id: randomUUID(), kind: "paragraph", markdown: "Conteúdo completo." },
          {
            id: randomUUID(),
            kind: "image",
            imageId: cover!.id,
            alt: "Imagem do caso GPT",
          },
        ],
        ...relations,
      };
      const review = await publisher.prepareReview(value);
      await publisher.confirmWrite(review.operationId);
      await publisher.confirmPublish(review.operationId);
      publishedPaths.push(review.mdxRelativePath);
      return review.mdxRelativePath;
    };

    const aulaPath = await publishCase("aula");
    const cursoPath = await publishCase("curso", {
      aulaSlugs: ["aula-gpt-teste-001"],
    });
    const trilhaPath = await publishCase("trilha", {
      trilhaItens: [
        { tipo: "aula", slug: "aula-gpt-teste-001" },
        { tipo: "curso", slug: "curso-gpt-teste-001" },
      ],
    });
    const noticiaPath = await publishCase("noticia");
    const projetoPath = await publishCase("projeto");

    const observer = path.join(root, "gpt-observer");
    await requireGit(root, ["clone", "--branch", "main", remote, observer]);
    for (const relativePath of publishedPaths) {
      await expect(access(path.join(observer, relativePath))).resolves.toBeUndefined();
    }

    for (const relativePath of [
      trilhaPath,
      cursoPath,
      aulaPath,
      noticiaPath,
      projetoPath,
    ]) {
      await publisher.deletePublished(relativePath);
    }
  });
});
