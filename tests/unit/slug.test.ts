import { describe, expect, it } from "vitest";

import { normalizeImageName, toSlug, uniqueImageName } from "../../src/shared/slug";
import { slugSchema } from "../../src/shared/schema";

describe("slug", () => {
  it("translitera e normaliza", () => {
    expect(toSlug("  Introdução à Robótica  ")).toBe("introducao-a-robotica");
    expect(toSlug("ESP32__Primeiros passos")).toBe("esp32-primeiros-passos");
  });

  it("rejeita formatos proibidos", () => {
    for (const value of ["Introducao", "introdução", "dois--hifens", "../escape", ""]) {
      expect(slugSchema.safeParse(value).success).toBe(false);
    }
  });

  it("normaliza nomes e evita colisão", () => {
    expect(normalizeImageName("Minha Imagem.JPG")).toBe("minha-imagem.jpg");
    expect(uniqueImageName("foto.png", new Set(["foto.png"]))).toBe("foto-2.png");
  });
});
