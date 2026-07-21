import { describe, expect, it } from "vitest";

import { normalizeTag, rewriteTags } from "../../src/shared/tag-collection";

describe("coleção de tags", () => {
  it("normaliza acentos e espaços para localizar a mesma tag", () => {
    expect(normalizeTag("  Robótica  ")).toBe("robotica");
  });

  it("renomeia a tag e evita duplicatas no mesmo MDX", () => {
    expect(
      rewriteTags(["Python", "Robótica", "python"], "python", "Programação"),
    ).toEqual(["Programação", "Robótica"]);
  });

  it("remove somente a tag solicitada", () => {
    expect(rewriteTags(["Python", "Robótica"], "robótica")).toEqual(["Python"]);
  });
});
