import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Desktop Packaging: package.json metadata and electron-builder configuration', () => {
  const pkgPath = path.join(projectRoot, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Main entry
  assert.equal(pkg.main, 'dist-electron/main.cjs', 'main entry must point to dist-electron/main.cjs');

  // Desktop scripts
  assert.ok(pkg.scripts['desktop:compile'], 'desktop:compile script must be defined');
  assert.ok(pkg.scripts['desktop:build'], 'desktop:build script must be defined');
  assert.ok(pkg.scripts['desktop:dev'], 'desktop:dev script must be defined');
  assert.ok(pkg.scripts['desktop:package'], 'desktop:package script must be defined');

  // Electron builder configuration
  const build = pkg.build;
  assert.ok(build, 'electron-builder build configuration must exist');
  assert.equal(build.appId, 'com.amir4333.pathflow', 'appId must be com.amir4333.pathflow');
  assert.equal(build.productName, 'PathFlow', 'productName must be PathFlow');

  // Windows targets
  assert.ok(build.win, 'Windows build configuration must exist');
  const winTargets = build.win.target.map((t: any) => (typeof t === 'string' ? t : t.target));
  assert.ok(winTargets.includes('nsis'), 'Windows target must include nsis');
  assert.ok(winTargets.includes('portable'), 'Windows target must include portable');

  // NSIS installer properties
  const nsis = build.nsis;
  assert.ok(nsis, 'NSIS configuration must exist');
  assert.equal(nsis.oneClick, false, 'NSIS oneClick must be false');
  assert.equal(nsis.allowToChangeInstallationDirectory, true, 'allowToChangeInstallationDirectory must be true');
  assert.equal(nsis.createDesktopShortcut, true, 'createDesktopShortcut must be true');
  assert.equal(nsis.createStartMenuShortcut, true, 'createStartMenuShortcut must be true');
  assert.equal(nsis.perMachine, false, 'perMachine must be false (per-user install without admin privileges)');
});

test('Desktop Packaging: Electron source files and icon assets exist', () => {
  const mainTs = path.join(projectRoot, 'electron/main.ts');
  const preloadTs = path.join(projectRoot, 'electron/preload.ts');
  const iconPng = path.join(projectRoot, 'build/icon.png');

  assert.ok(fs.existsSync(mainTs), 'electron/main.ts must exist');
  assert.ok(fs.existsSync(preloadTs), 'electron/preload.ts must exist');
  assert.ok(fs.existsSync(iconPng), 'build/icon.png must exist');

  // Verify security settings in main.ts
  const mainContent = fs.readFileSync(mainTs, 'utf8');
  assert.match(mainContent, /contextIsolation:\s*true/, 'main.ts must enable contextIsolation');
  assert.match(mainContent, /nodeIntegration:\s*false/, 'main.ts must disable nodeIntegration');
  assert.match(mainContent, /sandbox:\s*true/, 'main.ts must enable sandbox');
  assert.match(mainContent, /title:\s*['"]PathFlow['"]/, 'window title must be PathFlow');

  // Verify preload does not leak Node primitives
  const preloadContent = fs.readFileSync(preloadTs, 'utf8');
  assert.doesNotMatch(preloadContent, /require\(['"]fs['"]\)/, 'preload must not expose fs');
  assert.doesNotMatch(preloadContent, /require\(['"]child_process['"]\)/, 'preload must not expose child_process');
});

test('Desktop Packaging: Vite config uses relative base for packaged asset resolution', () => {
  const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
  assert.ok(fs.existsSync(viteConfigPath), 'vite.config.ts must exist');

  const content = fs.readFileSync(viteConfigPath, 'utf8');
  assert.match(content, /base:\s*['"]\.\/['"]/, 'vite.config.ts must specify base: "./"');
});
