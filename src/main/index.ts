import path from "node:path";

import { app, BrowserWindow, session } from "electron";

import { createDirectories } from "./filesystem/storage";
import { registerIpc } from "./ipc/register";
import { AppService } from "./service";

let mainWindow: BrowserWindow | undefined;

function configureLocalUserData(): void {
  if (app.commandLine.hasSwitch("user-data-dir")) return;
  const configuredLocalAppData = process.env.LOCALAPPDATA;
  const localAppData =
    configuredLocalAppData && path.isAbsolute(configuredLocalAppData)
      ? configuredLocalAppData
      : path.resolve(app.getPath("appData"), "..", "Local");
  app.setPath("userData", path.join(localAppData, "GEAR Content Studio"));
}

configureLocalUserData();

async function createWindow(): Promise<void> {
  const directories = createDirectories(app.getPath("userData"));
  const service = new AppService(directories);
  await service.initialize();
  registerIpc(service);

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  mainWindow = new BrowserWindow({
    title: "GEAR Content Studio",
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
