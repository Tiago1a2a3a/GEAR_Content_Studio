import { describe, expect, it } from "vitest";

import { removeContentReference } from "../../src/shared/reference-rewriter";

describe("atualização automática de referências", () => {
  it("remove o slug de pré-requisitos, aulas e itens de trilha", () => {
    const input = `---
slug: dependente
preRequisitos:
  - alvo
  - preservar
aulaSlugs:
  - alvo
itens:
  - tipo: aula
    slug: alvo
  - tipo: curso
    slug: preservar
---

Corpo preservado.
`;

    const result = removeContentReference(input, "alvo");

    expect(result.changed).toBe(true);
    expect(result.mdx).not.toContain("slug: alvo");
    expect(result.mdx).toContain("preservar");
    expect(result.mdx).toContain("Corpo preservado.");
  });

  it("não altera um MDX que não referencia o slug", () => {
    const input = "---\nslug: outro\n---\n\nConteúdo.\n";
    expect(removeContentReference(input, "alvo")).toEqual({
      changed: false,
      mdx: input,
    });
  });
});
