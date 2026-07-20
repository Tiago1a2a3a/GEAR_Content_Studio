import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertAllowedPaths,
  isAllowedWritePath,
  resolveConfined,
  resolveConfinedForWrite,
} from "../../src/shared/paths";

describe("paths e allowlist", () => {
  it("aceita somente Aula nova e imagens do slug", () => {
    expect(isAllowedWritePath("src/content/aprendizado/aulas/aula-1.mdx")).toBe(true);
    expect(isAllowedWritePath("public/images/content/aulas/aula-1/banner.webp")).toBe(
      true,
    );
    expect(isAllowedWritePath("package.json")).toBe(false);
    expect(() => assertAllowedPaths(["package.json"])).toThrow(/allowlist/);
  });

  it("bloqueia path traversal", () => {
    expect(() => resolveConfined("C:\\safe\\root", "..\\escape")).toThrow(/raiz/);
  });

  it("bloqueia junction ou symlink que escapa da raiz", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "gear-paths-"));
    const root = path.join(temporary, "root");
    const outside = path.join(temporary, "outside");
    await Promise.all([mkdir(root), mkdir(outside)]);
    await symlink(
      outside,
      path.join(root, "link"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(resolveConfinedForWrite(root, "link/arquivo.mdx")).rejects.toThrow(
      /link fora/,
    );
  });
});
