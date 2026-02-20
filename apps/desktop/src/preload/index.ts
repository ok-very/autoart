import { contextBridge } from "electron";

// Minimal preload — expose nothing for now.
// The dashboard is served by FastAPI and doesn't need Node APIs.
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
