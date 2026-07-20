import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("abre com renderer isolado e navegação principal", async () => {
  const app = await electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: ["out/main/index.js"],
  });
  const window = await app.firstWindow();
  await expect(window.getByText("GEAR Content Studio").first()).toBeVisible();
  await expect(window.getByRole("button", { name: "Criar nova Aula" })).toBeVisible();
  expect(await window.evaluate(() => typeof (window as any).require)).toBe("undefined");
  await app.close();
});

test("atualiza slug ao digitar e preserva rascunho ao navegar", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "gear-e2e-draft-"));
  const app = await electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: ["out/main/index.js", `--user-data-dir=${userData}`],
  });
  const window = await app.firstWindow();
  await window.getByRole("button", { name: "Criar nova Aula" }).click();
  await window.getByLabel("Título").pressSequentially("MEU NOME E TIAGO");
  await expect(window.getByLabel("Slug")).toHaveValue("meu-nome-e-tiago");
  await window.getByRole("button", { name: "Rascunhos", exact: true }).click();
  await expect(window.getByText("MEU NOME E TIAGO")).toBeVisible();
  await window.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(window.getByLabel("Título")).toHaveValue("MEU NOME E TIAGO");
  await app.close();
});
