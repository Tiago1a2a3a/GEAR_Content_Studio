import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { CatalogEntry, LessonDraft } from "../../src/shared/types";
import { hasPrerequisiteCycle, validateDraft } from "../../src/shared/validation";

const entry = (slug: string, outgoingRelations: string[] = []): CatalogEntry => ({
  type: "aula",
  slug,
  titulo: slug,
  status: "publicado",
  summary: "",
  tags: [],
  sourcePath: `${slug}.mdx`,
  outgoingRelations,
  incomingRelations: [],
});

const validDraft = (): LessonDraft => ({
  id: randomUUID(),
  schemaVersion: 1,
  baseCommit: "abc",
  slug: "nova-aula",
  titulo: "Nova Aula",
  resumo: "Resumo",
  tags: [],
  dificuldade: "iniciante",
  dataPublicacao: "2026-07-20",
  autores: ["Equipe GEAR"],
  preRequisitos: ["base"],
  videos: [],
  linksExternos: [],
  status: "rascunho",
  permiteComentarios: false,
  images: [],
  body: [{ id: randomUUID(), kind: "paragraph", markdown: "Conteúdo." }],
});

describe("validação", () => {
  it("detecta ciclos", () => {
    expect(hasPrerequisiteCycle([entry("a", ["b"]), entry("b", ["a"])])).toBe(true);
  });

  it("aceita rascunho válido", () => {
    expect(validateDraft(validDraft(), [entry("base")])).toEqual([]);
  });

  it("bloqueia slug duplicado e referência inexistente", () => {
    const draft = { ...validDraft(), slug: "base", preRequisitos: ["ausente"] };
    const codes = validateDraft(draft, [entry("base")]).map((item) => item.code);
    expect(codes).toContain("DUPLICATE_SLUG");
    expect(codes).toContain("MISSING_PREREQUISITE");
  });
});
