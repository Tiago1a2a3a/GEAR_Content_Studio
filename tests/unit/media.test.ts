import path from "node:path";

import { describe, expect, it } from "vitest";

import { inspectImages } from "../../src/main/filesystem/media";

describe("imagens", () => {
  const fixtures = path.resolve("tests/fixtures/imagens");

  it("aceita assinaturas reais", async () => {
    const images = await inspectImages([path.join(fixtures, "imagem-valida.png")]);
    expect(images[0]?.mime).toBe("image/png");
  });

  it("rejeita extensão falsa", async () => {
    await expect(
      inspectImages([path.join(fixtures, "arquivo-falso.png")]),
    ).rejects.toThrow(/assinatura/);
  });
});
