import path from "node:path";

import { describe, expect, it } from "vitest";

import { inspectDownloads, inspectImages } from "../../src/main/filesystem/media";

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

describe("downloads", () => {
  it("normaliza arquivo permitido", async () => {
    const [download] = await inspectDownloads([
      path.resolve("tests/fixtures/portal-minimo/public/downloads/guia-exemplo.txt"),
    ]);
    expect(download?.normalizedName).toBe("guia-exemplo.txt");
  });
});
