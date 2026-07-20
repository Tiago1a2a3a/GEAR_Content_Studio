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
  await expect(
    window.getByRole("button", { name: "Criar novo conteúdo" }),
  ).toBeVisible();
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
  await window.getByRole("button", { name: "Criar novo conteúdo" }).click();
  await window.getByLabel("Título").pressSequentially("MEU NOME E TIAGO");
  await expect(window.getByLabel("Slug")).toHaveValue("meu-nome-e-tiago");
  await window.getByRole("button", { name: "Rascunhos", exact: true }).click();
  await expect(window.getByText("MEU NOME E TIAGO")).toBeVisible();
  await window.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(window.getByLabel("Título")).toHaveValue("MEU NOME E TIAGO");
  await app.close();
});

test("não cria rascunho sem título ao visitar Projeto", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "gear-e2e-empty-draft-"));
  const app = await electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: ["out/main/index.js", `--user-data-dir=${userData}`],
  });
  const window = await app.firstWindow();
  await window.getByRole("button", { name: "Criar novo conteúdo" }).click();
  await window.getByLabel("Tipo de conteúdo").selectOption("projeto");
  await window.getByRole("button", { name: "Rascunhos", exact: true }).click();
  await expect(window.getByText("Nenhum rascunho salvo.")).toBeVisible();
  await app.close();
});

test("preenche casos GPT numerados para os cinco tipos", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "gear-e2e-gpt-cases-"));
  const app = await electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: ["out/main/index.js", `--user-data-dir=${userData}`],
  });
  const window = await app.firstWindow();
  const expected = [
    ["aula", "aula_gpt_teste_001"],
    ["curso", "curso_gpt_teste_001"],
    ["trilha", "trilha_gpt_teste_001"],
    ["noticia", "noticia_gpt_teste_001"],
    ["projeto", "projeto_gpt_teste_001"],
  ] as const;

  for (const [type, title] of expected) {
    await window.getByRole("button", { name: "Novo conteúdo", exact: true }).click();
    await window.getByLabel("Tipo de conteúdo").selectOption(type);
    await window.getByRole("button", { name: "Preencher caso GPT" }).click();
    await expect(window.getByLabel("Título")).toHaveValue(title);
    await expect(window.getByLabel("Slug")).toHaveValue(title.replaceAll("_", "-"));
  }
  await app.close();
});
