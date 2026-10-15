// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("pathflowPdf", {
  save: (fileName) => import_electron.ipcRenderer.invoke("pathflow:save-report-pdf", fileName)
});
