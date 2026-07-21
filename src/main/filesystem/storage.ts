import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_SIDEBAR_ORDER,
  type LessonDraft,
  type SidebarItemId,
} from "../../shared/types";
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
  publications: string;
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
    publications: path.join(root, "published-content.json"),
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
  autoUpdateReferencesOnDelete: boolean;
  advancedMode: boolean;
  sidebarOrder: SidebarItemId[];
}>;

const normalizeSidebarOrder = (value: unknown): SidebarItemId[] => {
  if (
    !Array.isArray(value) ||
    value.length !== DEFAULT_SIDEBAR_ORDER.length ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !DEFAULT_SIDEBAR_ORDER.includes(item as SidebarItemId),
    ) ||
    new Set(value).size !== DEFAULT_SIDEBAR_ORDER.length
  ) {
    return [...DEFAULT_SIDEBAR_ORDER];
  }
  return value as SidebarItemId[];
};

export async function loadSettings(
  directories: AppDirectories,
): Promise<Settings | undefined> {
  try {
    const raw = JSON.parse(await readFile(directories.settings, "utf8")) as Settings;
    remoteUrlSchema.parse(raw.remoteUrl);
    if (raw.defaultBranch !== "main" || raw.schemaVersion !== 1) return undefined;
    return {
      ...raw,
      autoUpdateReferencesOnDelete: raw.autoUpdateReferencesOnDelete === true,
      advancedMode: raw.advancedMode === true,
      sidebarOrder: normalizeSidebarOrder(raw.sidebarOrder),
    };
  } catch {
    return undefined;
  }
}

export async function saveSettings(
  directories: AppDirectories,
  remoteUrl: string,
  autoUpdateReferencesOnDelete = false,
  advancedMode = false,
  sidebarOrder: SidebarItemId[] = [...DEFAULT_SIDEBAR_ORDER],
): Promise<void> {
  await writeJsonAtomic(directories.settings, {
    schemaVersion: 1,
    remoteUrl: remoteUrlSchema.parse(remoteUrl),
    defaultBranch: "main",
    theme: "system",
    autoUpdateReferencesOnDelete,
    advancedMode,
    sidebarOrder: normalizeSidebarOrder(sidebarOrder),
  } satisfies Settings);
}

export async function saveDraft(
  directories: AppDirectories,
  draft: LessonDraft,
): Promise<void> {
  const validated = localDraftSchema.parse(draft);
  if (!validated.titulo.trim()) {
    await deleteDraft(directories, validated.id);
    return;
  }
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
  return drafts.filter((draft): draft is LessonDraft => Boolean(draft?.titulo.trim()));
}

export async function deleteDraft(
  directories: AppDirectories,
  id: string,
): Promise<void> {
  if (!/^[a-f0-9-]{8,}$/i.test(id)) throw new Error("ID de rascunho inválido.");
  await rm(resolveConfined(directories.drafts, `${id}.json`), { force: true });
}

export type PublicationRecord = Readonly<{
  sourcePath: string;
  imagePaths: string[];
  lastCommit: string;
  updatedAt: string;
}>;

async function loadPublicationRecords(
  directories: AppDirectories,
): Promise<PublicationRecord[]> {
  try {
    const parsed = JSON.parse(
      await readFile(directories.publications, "utf8"),
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is PublicationRecord =>
          Boolean(
            item &&
            typeof item === "object" &&
            typeof (item as PublicationRecord).sourcePath === "string" &&
            Array.isArray((item as PublicationRecord).imagePaths),
          ),
        )
      : [];
  } catch {
    return [];
  }
}

export async function recordPublication(
  directories: AppDirectories,
  record: PublicationRecord,
): Promise<void> {
  const current = await loadPublicationRecords(directories);
  const previous = current.find((item) => item.sourcePath === record.sourcePath);
  await writeJsonAtomic(directories.publications, [
    ...current.filter((item) => item.sourcePath !== record.sourcePath),
    {
      ...record,
      imagePaths: [...new Set([...(previous?.imagePaths ?? []), ...record.imagePaths])],
    },
  ]);
}

export async function getPublication(
  directories: AppDirectories,
  sourcePath: string,
): Promise<PublicationRecord | undefined> {
  return (await loadPublicationRecords(directories)).find(
    (item) => item.sourcePath === sourcePath,
  );
}

export async function removePublication(
  directories: AppDirectories,
  sourcePath: string,
): Promise<void> {
  const current = await loadPublicationRecords(directories);
  await writeJsonAtomic(
    directories.publications,
    current.filter((item) => item.sourcePath !== sourcePath),
  );
}
