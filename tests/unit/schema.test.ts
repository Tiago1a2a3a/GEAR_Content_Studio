import { describe, expect, it } from "vitest";

import {
  dateSchema,
  EXPECTED_REMOTE_URL,
  localDraftSchema,
  remoteUrlSchema,
} from "../../src/shared/schema";
import type { LessonDraft } from "../../src/shared/types";

describe("schemas de entrada", () => {
  it("aceita somente datas reais em YYYY-MM-DD", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("20/07/2026").success).toBe(false);
  });

  it("restringe o remoto ao Portal aprovado em HTTPS", () => {
    expect(remoteUrlSchema.safeParse(EXPECTED_REMOTE_URL).success).toBe(true);
    expect(
      remoteUrlSchema.safeParse("http://github.com/Tiago1a2a3a/Site_Gear").success,
    ).toBe(false);
    expect(remoteUrlSchema.safeParse("https://github.com/outro/repo").success).toBe(
      false,
    );
  });

  it("aceita rascunho local ainda incompleto", () => {
    const draft: LessonDraft = {
      id: "draft-id",
      schemaVersion: 1,
      baseCommit: "",
      slug: "",
      titulo: "MEU NOME E TIAGO",
      resumo: "",
      tags: [],
      dificuldade: "iniciante",
      dataPublicacao: "2026-07-20",
      autores: [],
      preRequisitos: [],
      videos: [],
      linksExternos: [],
      status: "rascunho",
      permiteComentarios: false,
      images: [],
      body: [{ id: "block-id", kind: "paragraph", markdown: "" }],
    };
    const result = localDraftSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });
});
