import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { filterCatalog, parseCatalog, plainBody } from "../../src/shared/catalog";

describe("catálogo", () => {
  it("remove marcação do corpo", () => {
    expect(plainBody("## Olá\n\nTexto **forte** [link](https://example.com)")).toBe(
      "Olá Texto forte link",
    );
  });

  it("indexa e busca sem acento", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gear-catalog-"));
    const directory = path.join(root, "src/content/aprendizado/aulas");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "robotica.mdx"),
      "---\nslug: robotica\ntitulo: Robótica básica\nresumo: Sensores\nstatus: publicado\ntags:\n  - eletrônica\n---\n\nConteúdo.",
      "utf8",
    );
    const entries = await parseCatalog(root);
    expect(entries).toHaveLength(1);
    expect(filterCatalog(entries, { query: "robotica" })).toHaveLength(1);
    expect(filterCatalog(entries, { query: "eletronica" })).toHaveLength(1);
  });

  it("interpreta os cinco tipos do snapshot mínimo do Portal", async () => {
    const entries = await parseCatalog(path.resolve("tests/fixtures/portal-minimo"));
    expect(new Set(entries.map((entry) => entry.type))).toEqual(
      new Set(["aula", "curso", "trilha", "projeto", "noticia"]),
    );
    expect(entries.every((entry) => entry.slug && entry.titulo)).toBe(true);
    expect(entries.find((entry) => entry.type === "projeto")).toMatchObject({
      tagField: "tecnologias",
      tags: ["ESP32", "C++"],
    });
  });
});
