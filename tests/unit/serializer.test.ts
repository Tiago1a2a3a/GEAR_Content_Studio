import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { serializeLesson } from "../../src/shared/serializer";
import type { LessonDraft } from "../../src/shared/types";

const draft = (): LessonDraft => ({
  id: randomUUID(),
  schemaVersion: 1,
  baseCommit: "abc",
  slug: "aula-segura",
  titulo: "Aula: segura",
  resumo: "Resumo válido",
  tags: ["git", "segurança"],
  dificuldade: "iniciante",
  dataPublicacao: "2026-07-20",
  autores: ["Equipe GEAR"],
  preRequisitos: [],
  videos: ["https://example.com/video"],
  linksExternos: [],
  status: "rascunho",
  permiteComentarios: false,
  images: [],
  body: [
    { id: randomUUID(), kind: "heading", level: 2, text: "Objetivos" },
    { id: randomUUID(), kind: "paragraph", markdown: "Texto **seguro**." },
    { id: randomUUID(), kind: "code", language: "ts", code: "const ok = true;" },
  ],
});

describe("serializer MDX", () => {
  it("é determinístico e respeita a ordem do frontmatter", () => {
    const value = draft();
    expect(serializeLesson(value)).toBe(serializeLesson(value));
    expect(serializeLesson(value)).toMatchSnapshot();
    expect(serializeLesson(value).endsWith("\n")).toBe(true);
  });

  it("bloqueia JSX e imports", () => {
    const value = draft();
    const unsafe: LessonDraft = {
      ...value,
      body: [{ id: randomUUID(), kind: "paragraph", markdown: "import x from 'y'" }],
    };
    expect(() => serializeLesson(unsafe)).toThrow(/import/);
  });

  it("serializa todos os blocos e escapa YAML", () => {
    const imageId = randomUUID();
    const value: LessonDraft = {
      ...draft(),
      titulo: 'Aula: "YAML"',
      images: [
        {
          id: imageId,
          sourcePath: "C:\\imagem.png",
          originalName: "Imagem.png",
          normalizedName: "imagem.png",
          mime: "image/png",
          bytes: 10,
          width: 1,
          height: 1,
        },
      ],
      body: [
        { id: randomUUID(), kind: "heading", level: 2, text: "Título" },
        { id: randomUUID(), kind: "paragraph", markdown: "Parágrafo." },
        { id: randomUUID(), kind: "unordered-list", items: ["Um", "Dois"] },
        { id: randomUUID(), kind: "ordered-list", items: ["Primeiro", "Segundo"] },
        { id: randomUUID(), kind: "image", imageId, alt: "Descrição" },
        {
          id: randomUUID(),
          kind: "code",
          language: "tsx",
          code: "import React from 'react';\nconst tag = <div />;",
        },
        { id: randomUUID(), kind: "quote", markdown: "Aviso\nimportante" },
        { id: randomUUID(), kind: "separator" },
      ],
    };
    const mdx = serializeLesson(value);
    expect(mdx).toContain("titulo: 'Aula: \"YAML\"'");
    expect(mdx).toContain("- Um\n- Dois");
    expect(mdx).toContain("1. Primeiro\n2. Segundo");
    expect(mdx).toContain("![Descrição](/images/content/aulas/aula-segura/imagem.png)");
    expect(mdx).toContain("```tsx\nimport React");
    expect(mdx).toContain("> Aviso\n> importante");
    expect(mdx).toContain("\n---\n");
  });

  it("bloqueia HTML cru, script e javascript fora de bloco de código", () => {
    for (const markdown of [
      "<div>inseguro</div>",
      "<script>alert(1)</script>",
      "[clique](javascript:alert(1))",
    ]) {
      expect(() =>
        serializeLesson({
          ...draft(),
          body: [{ id: randomUUID(), kind: "paragraph", markdown }],
        }),
      ).toThrow(/insegura/);
    }
  });
});
