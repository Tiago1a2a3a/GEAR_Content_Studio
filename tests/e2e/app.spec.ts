import { _electron as electron, expect, test } from "@playwright/test";
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
