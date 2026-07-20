import { contextBridge, ipcRenderer } from "electron";

import type { GearContentStudioApi } from "../shared/types";

const api: GearContentStudioApi = {
  environmentCheck: () => ipcRenderer.invoke("gear:environment-check"),
  configure: (input) => ipcRenderer.invoke("gear:configure", input),
  synchronize: () => ipcRenderer.invoke("gear:synchronize"),
  listCatalog: (filter) => ipcRenderer.invoke("gear:list-catalog", filter),
  chooseImages: () => ipcRenderer.invoke("gear:choose-images"),
  saveDraft: (draft) => ipcRenderer.invoke("gear:save-draft", draft),
  listDrafts: () => ipcRenderer.invoke("gear:list-drafts"),
  loadDraft: (id) => ipcRenderer.invoke("gear:load-draft", id),
  deleteDraft: (id) => ipcRenderer.invoke("gear:delete-draft", id),
  prepareReview: (draft) => ipcRenderer.invoke("gear:prepare-review", draft),
  confirmWrite: (operationId) => ipcRenderer.invoke("gear:confirm-write", operationId),
  confirmPublish: (operationId) =>
    ipcRenderer.invoke("gear:confirm-publish", operationId),
  cancelOperation: (operationId) =>
    ipcRenderer.invoke("gear:cancel-operation", operationId),
  openExternalHttps: (url) => ipcRenderer.invoke("gear:open-external", url),
  copyDiagnostic: (detailsId) => ipcRenderer.invoke("gear:copy-diagnostic", detailsId),
};

contextBridge.exposeInMainWorld("gearContentStudio", Object.freeze(api));
