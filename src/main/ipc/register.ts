import { ipcMain } from "electron";
import { z } from "zod";

import { lessonDraftSchema, remoteUrlSchema } from "../../shared/schema";
import { DEFAULT_SIDEBAR_ORDER, type CatalogFilter } from "../../shared/types";
import type { AppService } from "../service";

const idSchema = z.string().min(8).max(128);
const filterSchema = z
  .object({
    query: z.string().max(300).optional(),
    type: z.enum(["aula", "curso", "trilha", "projeto", "noticia"]).optional(),
    status: z.string().max(50).optional(),
    difficulty: z.string().max(50).optional(),
    category: z.string().max(200).optional(),
    tag: z.string().max(200).optional(),
  })
  .optional();

export function registerIpc(service: AppService): void {
  ipcMain.handle("gear:environment-check", () => service.environmentCheck());
  ipcMain.handle("gear:configure", (_event, input: unknown) => {
    const parsed = z
      .object({
        remoteUrl: z.string(),
        autoUpdateReferencesOnDelete: z.boolean(),
        advancedMode: z.boolean(),
        sidebarOrder: z
          .array(z.enum(DEFAULT_SIDEBAR_ORDER))
          .length(DEFAULT_SIDEBAR_ORDER.length)
          .refine((value) => new Set(value).size === DEFAULT_SIDEBAR_ORDER.length),
      })
      .parse(input);
    const remoteUrl = remoteUrlSchema.parse(parsed.remoteUrl);
    return service.configure({
      remoteUrl,
      autoUpdateReferencesOnDelete: parsed.autoUpdateReferencesOnDelete,
      advancedMode: parsed.advancedMode,
      sidebarOrder: parsed.sidebarOrder,
    });
  });
  ipcMain.handle("gear:set-advanced-mode", (_event, enabled: unknown) => {
    const value = z.boolean().parse(enabled);
    return service.setAdvancedMode(value);
  });
  ipcMain.handle("gear:synchronize", () => service.synchronize());
  ipcMain.handle("gear:list-catalog", (_event, filter: unknown) =>
    service.listCatalog(filterSchema.parse(filter) as CatalogFilter | undefined),
  );
  ipcMain.handle("gear:list-tags", () => service.listTags());
  ipcMain.handle("gear:list-categories", () => service.listCategories());
  ipcMain.handle("gear:list-areas", () => service.listAreas());
  ipcMain.handle("gear:list-technologies", () => service.listTechnologies());
  ipcMain.handle("gear:update-tag", (_event, input: unknown) =>
    service.updateTag(
      z
        .object({
          tag: z.string().trim().min(1).max(200),
          replacement: z.string().trim().min(1).max(200).optional(),
          sourcePath: z.string().max(300).optional(),
          enabled: z.boolean().optional(),
          scope: z.enum(["tag", "technology"]).optional(),
        })
        .refine(
          (value) => !value.sourcePath || typeof value.enabled === "boolean",
          "Informe se a tag deve ser adicionada ou removida.",
        )
        .parse(input),
    ),
  );
  ipcMain.handle("gear:update-category", (_event, input: unknown) =>
    service.updateCategory(
      z
        .object({
          category: z.string().trim().min(1).max(200),
          replacement: z.string().trim().min(1).max(200).optional(),
          scope: z.enum(["category", "area"]).optional(),
          sourcePath: z.string().max(300).optional(),
          enabled: z.boolean().optional(),
        })
        .refine(
          (value) => !value.sourcePath || typeof value.enabled === "boolean",
          "Informe se o item deve ser adicionado ou removido.",
        )
        .parse(input),
    ),
  );
  ipcMain.handle("gear:choose-images", () => service.chooseImages());
  ipcMain.handle("gear:choose-downloads", () => service.chooseDownloads());
  ipcMain.handle("gear:load-published", (_event, input: unknown) =>
    service.loadPublished(z.object({ sourcePath: z.string().max(300) }).parse(input)),
  );
  ipcMain.handle("gear:save-draft", (_event, draft: unknown) =>
    service.saveDraft(lessonDraftSchema.parse(draft)),
  );
  ipcMain.handle("gear:list-drafts", () => service.listDrafts());
  ipcMain.handle("gear:load-draft", (_event, id: unknown) =>
    service.loadDraft(idSchema.parse(id)),
  );
  ipcMain.handle("gear:delete-draft", (_event, id: unknown) =>
    service.deleteDraft(idSchema.parse(id)),
  );
  ipcMain.handle("gear:prepare-review", (_event, draft: unknown) =>
    service.prepareReview(lessonDraftSchema.parse(draft)),
  );
  ipcMain.handle("gear:confirm-write", (_event, operationId: unknown) =>
    service.confirmWrite(idSchema.parse(operationId)),
  );
  ipcMain.handle("gear:confirm-publish", (_event, operationId: unknown) =>
    service.confirmPublish(idSchema.parse(operationId)),
  );
  ipcMain.handle("gear:cancel-operation", (_event, operationId: unknown) =>
    service.cancelOperation(idSchema.parse(operationId)),
  );
  ipcMain.handle("gear:recover-local-operation", () => service.recoverLocalOperation());
  ipcMain.handle("gear:open-external", (_event, url: unknown) =>
    service.openExternalHttps(z.string().url().parse(url)),
  );
  ipcMain.handle("gear:copy-diagnostic", (_event, detailsId: unknown) =>
    service.copyDiagnostic(idSchema.parse(detailsId)),
  );
  ipcMain.handle("gear:delete-published", (_event, input: unknown) =>
    service.deletePublished(z.object({ sourcePath: z.string().max(300) }).parse(input)),
  );
}
