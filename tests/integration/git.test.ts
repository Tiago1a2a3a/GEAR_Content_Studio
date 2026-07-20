import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { requireGit } from "../../src/main/git/runner";
import { ManagedRepository } from "../../src/main/repository/repository";

describe("clone gerenciado", () => {
  let root: string;
  let remote: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gear-git-"));
    remote = path.join(root, "remote.git");
    const seed = path.join(root, "seed");
    await requireGit(root, ["init", "--bare", remote]);
    await mkdir(seed);
    await requireGit(seed, ["init", "-b", "main"]);
    await requireGit(seed, ["config", "user.name", "Teste GEAR"]);
    await requireGit(seed, ["config", "user.email", "teste@example.com"]);
    await mkdir(path.join(seed, "src/content/aprendizado/aulas"), { recursive: true });
    await writeFile(path.join(seed, "README.md"), "fixture\n");
    await requireGit(seed, ["add", "--", "README.md"]);
    await requireGit(seed, ["commit", "-m", "fixture"]);
    await requireGit(seed, ["remote", "add", "origin", remote]);
    await requireGit(seed, ["push", "origin", "HEAD:main"]);
    await requireGit(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  });

  it("clona, sincroniza e não toca em outro clone", async () => {
    const managed = new ManagedRepository(path.join(root, "managed"));
    const commit = await managed.synchronize(remote);
    expect(commit).toMatch(/^[a-f0-9]{40}$/);
    expect(await managed.exists()).toBe(true);
    await expect(managed.ensureClean()).resolves.toBeUndefined();
  });
});
