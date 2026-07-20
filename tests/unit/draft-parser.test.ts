import { describe, expect, it } from "vitest";

import { parsePublishedDraft } from "../../src/shared/draft-parser";
import { serializeLesson } from "../../src/shared/serializer";

describe("edição de conteúdo publicado", () => {
  it("carrega e preserva campos e corpo de uma Aula", () => {
    const raw = `---
slug: aula-existente
titulo: Aula existente
banner: /images/content/aulas/aula-existente/capa.png
resumo: Resumo existente
dificuldade: iniciante
dataPublicacao: 2026-07-20
autores:
  - Equipe GEAR
downloads:
  - titulo: Guia
    arquivo: /downloads/guia.pdf
status: publicado
permiteComentarios: false
---

## Conteúdo

Texto **preservado**.
`;
    const draft = parsePublishedDraft(
      raw,
      "aula",
      "src/content/aprendizado/aulas/aula-existente.mdx",
      "abc",
    );
    expect(draft.sourcePath).toContain("aula-existente.mdx");
    expect(draft.existingBannerPath).toContain("capa.png");
    expect(draft.existingDownloads?.[0]?.titulo).toBe("Guia");
    expect(serializeLesson(draft)).toContain("Texto **preservado**.");
  });
});
