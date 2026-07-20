import { randomUUID } from "node:crypto";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { serializeLesson } from "../../src/shared/serializer";
import type { ContentType, LessonDraft } from "../../src/shared/types";

const image = {
  id: "cover",
  sourcePath: "C:/tmp/gpt-test.png",
  originalName: "gpt-test.png",
  normalizedName: "gpt-test.png",
  mime: "image/png" as const,
  bytes: 1024,
  width: 1200,
  height: 630,
};

function gptDraft(type: ContentType): LessonDraft {
  return {
    id: randomUUID(),
    schemaVersion: 1,
    baseCommit: "base",
    contentType: type,
    slug: `${type}-gpt-teste-001`,
    titulo: `${type}_gpt_teste_001`,
    resumo: `Resumo completo de ${type}`,
    descricaoLonga: "Descrição longa para validar o contrato.",
    tags: ["gpt-teste", type],
    categoria: "Testes",
    dificuldade: "intermediário",
    dataPublicacao: "2026-07-20",
    dataAtualizacao: "2026-07-20",
    autores: ["GPT Teste"],
    preRequisitos: [],
    aulaSlugs: ["aula-gpt-teste-001"],
    trilhaItens: [
      { tipo: "aula", slug: "aula-gpt-teste-001" },
      { tipo: "curso", slug: "curso-gpt-teste-001" },
    ],
    videos: ["https://example.com/video"],
    linksExternos: [{ titulo: "Referência", url: "https://example.com" }],
    repositorioGithub: "https://github.com/Tiago1a2a3a/Site_Gear",
    tecnologias: ["TypeScript", "MDX"],
    documentacao: "https://example.com/docs",
    destaque: true,
    ordem: 1,
    status: "publicado",
    permiteComentarios: true,
    images: [image],
    bannerImageId: image.id,
    body: [
      { id: randomUUID(), kind: "heading", level: 2, text: "Teste completo" },
      { id: randomUUID(), kind: "paragraph", markdown: "Conteúdo do teste." },
      {
        id: randomUUID(),
        kind: "image",
        imageId: image.id,
        alt: "Imagem do teste",
      },
    ],
  };
}

describe("contratos MDX por tipo", () => {
  it.each([
    ["aula", ["resumo", "autores", "permiteComentarios", "banner"]],
    ["curso", ["descricao", "imagemCapa", "aulaSlugs", "dificuldade"]],
    ["trilha", ["descricaoCurta", "imagemCapa", "itens", "ordem"]],
    ["noticia", ["resumo", "imagemCapa", "autor", "dataPublicacao"]],
    ["projeto", ["descricaoCurta", "imagens", "tecnologias", "documentacao"]],
  ] as const)("serializa %s com seus campos próprios", (type, fields) => {
    const parsed = matter(serializeLesson(gptDraft(type)));
    for (const field of fields) expect(parsed.data).toHaveProperty(field);

    if (type !== "aula") {
      expect(parsed.data).not.toHaveProperty("permiteComentarios");
    }
    if (type === "projeto") {
      expect(parsed.data.status).toBe("concluído");
    } else {
      expect(parsed.data.status).toBe("publicado");
    }
    expect(parsed.content).toContain("## Teste completo");
  });
});
