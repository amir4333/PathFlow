
/**
 * PathFlow Electron Preload Script
 *
 * Security Invariants:
 * - Does NOT expose Node.js runtime primitives to the renderer window.
 * - Does NOT expose filesystem, shell, or child_process modules.
 * - Preserves standard browser sandbox isolation for IndexedDB, localStorage, and Web APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pathflowPdf', {
  save: (fileName: string) =>
    ipcRenderer.invoke('pathflow:save-report-pdf', fileName),
});
