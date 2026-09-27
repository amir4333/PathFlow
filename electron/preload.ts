/**
 * PathFlow Electron Preload Script
 *
 * Security Invariants:
 * - Does NOT expose Node.js runtime primitives to the renderer window.
 * - Does NOT expose filesystem, shell, or child_process modules.
 * - Preserves standard browser sandbox isolation for IndexedDB, localStorage, and Web APIs.
 */

window.addEventListener('DOMContentLoaded', () => {
  // Empty secure preload; standard Web APIs operate untouched.
});
