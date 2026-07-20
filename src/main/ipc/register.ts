import { ipcMain } from "electron";
import { z } from "zod";

import { lessonDraftSchema, remoteUrlSchema } from "../../shared/schema";
import type { CatalogFilter } from "../../shared/types";
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
    const remoteUrl = remoteUrlSchema.parse(
      z.object({ remoteUrl: z.string() }).parse(input).remoteUrl,
    );
    return service.configure({ remoteUrl });
  });
  ipcMain.handle("gear:synchronize", () => service.synchronize());
  ipcMain.handle("gear:list-catalog", (_event, filter: unknown) =>
    service.listCatalog(filterSchema.parse(filter) as CatalogFilter | undefined),
  );
  ipcMain.handle("gear:choose-images", () => service.chooseImages());
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
  ipcMain.handle("gear:open-external", (_event, url: unknown) =>
    service.openExternalHttps(z.string().url().parse(url)),
  );
  ipcMain.handle("gear:copy-diagnostic", (_event, detailsId: unknown) =>
    service.copyDiagnostic(idSchema.parse(detailsId)),
  );
}
