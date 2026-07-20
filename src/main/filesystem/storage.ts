import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LessonDraft } from "../../shared/types";
import { localDraftSchema, remoteUrlSchema } from "../../shared/schema";
import { resolveConfined } from "../../shared/paths";

export type AppDirectories = Readonly<{
  root: string;
  repository: string;
  drafts: string;
  staging: string;
  logs: string;
  settings: string;
  operationLock: string;
}>;

export function createDirectories(root: string): AppDirectories {
  return {
    root,
    repository: path.join(root, "repository"),
    drafts: path.join(root, "drafts"),
    staging: path.join(root, "staging"),
    logs: path.join(root, "logs"),
    settings: path.join(root, "settings.json"),
    operationLock: path.join(root, "operation.lock"),
  };
}

export async function ensureDirectories(directories: AppDirectories): Promise<void> {
  await Promise.all(
    [directories.root, directories.drafts, directories.staging, directories.logs].map(
      (directory) => mkdir(directory, { recursive: true }),
    ),
  );
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporary, filePath);
}

export type Settings = Readonly<{
  schemaVersion: 1;
  remoteUrl: string;
  defaultBranch: "main";
  theme: "system";
}>;

export async function loadSettings(
  directories: AppDirectories,
): Promise<Settings | undefined> {
  try {
    const raw = JSON.parse(await readFile(directories.settings, "utf8")) as Settings;
    remoteUrlSchema.parse(raw.remoteUrl);
    if (raw.defaultBranch !== "main" || raw.schemaVersion !== 1) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

export async function saveSettings(
  directories: AppDirectories,
  remoteUrl: string,
): Promise<void> {
  await writeJsonAtomic(directories.settings, {
    schemaVersion: 1,
    remoteUrl: remoteUrlSchema.parse(remoteUrl),
    defaultBranch: "main",
    theme: "system",
  } satisfies Settings);
}

export async function saveDraft(
  directories: AppDirectories,
  draft: LessonDraft,
): Promise<void> {
  const validated = localDraftSchema.parse(draft);
  await writeJsonAtomic(
    resolveConfined(directories.drafts, `${validated.id}.json`),
    validated,
  );
}

export async function loadDraft(
  directories: AppDirectories,
  id: string,
): Promise<LessonDraft> {
  if (!/^[a-f0-9-]{8,}$/i.test(id)) throw new Error("ID de rascunho inválido.");
  const raw = JSON.parse(
    await readFile(resolveConfined(directories.drafts, `${id}.json`), "utf8"),
  );
  return localDraftSchema.parse(raw) as LessonDraft;
}

export async function listDrafts(directories: AppDirectories): Promise<LessonDraft[]> {
  const names = await readdir(directories.drafts).catch(() => []);
  const drafts = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) => loadDraft(directories, name.slice(0, -5)).catch(() => undefined)),
  );
  return drafts.filter((draft): draft is LessonDraft => Boolean(draft));
}

export async function deleteDraft(
  directories: AppDirectories,
  id: string,
): Promise<void> {
  if (!/^[a-f0-9-]{8,}$/i.test(id)) throw new Error("ID de rascunho inválido.");
  await rm(resolveConfined(directories.drafts, `${id}.json`), { force: true });
}
