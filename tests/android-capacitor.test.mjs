import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STAGE_ALLOWLIST,
  FORBIDDEN_STAGE_ENTRIES,
  buildWeb,
} from '../scripts/build-web.mjs';
import {
  isNativeCapacitor,
  registerAppServiceWorker,
} from '../src/core/utils.js';
import { bindPWAInstall } from '../src/ui/install.js';
import {
  exportData,
  selectBackupExportStrategy,
} from '../src/services/backup.js';
import { handleAndroidBack } from '../src/ui/nav.js';
import { printSummary } from '../src/services/print.js';
import * as DB from '../src/storage/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

test('buildWeb stages only allowlisted runtime assets, removes stale files, and is deterministic', () => {
  const tempOut = fs.mkdtempSync(path.join(os.tmpdir(), 'cashpilot-stage-'));
  try {
    // Seed unexpected/forbidden files and stale nested files before staging
    fs.writeFileSync(path.join(tempOut, 'README.md'), 'forbidden doc', 'utf8');
    fs.writeFileSync(path.join(tempOut, '.env'), 'SECRET=1', 'utf8');
    fs.mkdirSync(path.join(tempOut, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempOut, 'src', 'stale-module.js'), 'stale', 'utf8');

    const firstRun = buildWeb({ rootDir: repoRoot, outDir: tempOut, allowExternalOutDir: true });
    assert.deepEqual(firstRun.stagedEntries, STAGE_ALLOWLIST);

    for (const forbidden of FORBIDDEN_STAGE_ENTRIES) {
      assert.equal(
        fs.existsSync(path.join(tempOut, forbidden)),
        false,
        `Forbidden entry must not exist in staged output: ${forbidden}`,
      );
    }
    assert.equal(fs.existsSync(path.join(tempOut, 'src', 'stale-module.js')), false);

    const stagedIndexBytes1 = fs.readFileSync(path.join(tempOut, 'index.html'));
    const sourceIndexBytes = fs.readFileSync(path.join(repoRoot, 'index.html'));
    assert.equal(stagedIndexBytes1.equals(sourceIndexBytes), true);

    const secondRun = buildWeb({ rootDir: repoRoot, outDir: tempOut, allowExternalOutDir: true });
    assert.deepEqual(secondRun.stagedEntries, STAGE_ALLOWLIST);
    const stagedIndexBytes2 = fs.readFileSync(path.join(tempOut, 'index.html'));
    assert.equal(stagedIndexBytes2.equals(stagedIndexBytes1), true);
  } finally {
    fs.rmSync(tempOut, { recursive: true, force: true });
  }
});

test('buildWeb rejects staging outside repo root by default and fails when required runtime assets are missing', () => {
  const externalDir = path.join(os.tmpdir(), 'cashpilot-disallowed-out');
  assert.throws(
    () => buildWeb({ rootDir: repoRoot, outDir: externalDir }),
    /Refusing to stage outside repository root/,
  );

  const incompleteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cashpilot-incomplete-root-'));
  try {
    fs.writeFileSync(path.join(incompleteRoot, 'index.html'), '<!doctype html>', 'utf8');
    assert.throws(
      () => buildWeb({ rootDir: incompleteRoot, outDir: path.join(incompleteRoot, 'www') }),
      /Missing required runtime file: manifest.json/,
    );
  } finally {
    fs.rmSync(incompleteRoot, { recursive: true, force: true });
  }
});

test('Capacitor configuration, pinned dependencies, and Android SDK policy invariants hold', () => {
  const capConfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'capacitor.config.json'), 'utf8'),
  );
  assert.equal(capConfig.appId, 'com.cashpilot.app');
  assert.equal(capConfig.appName, 'CashPilot');
  assert.equal(capConfig.webDir, 'www');
  assert.equal(capConfig.server?.androidScheme, 'https');
  assert.equal(capConfig.server?.url, undefined, 'Production/debug config must not point to external live-reload server');
  assert.equal(capConfig.server?.cleartext, undefined, 'HTTPS scheme must not enable cleartext traffic');

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));

  for (const [dep, section] of [
    ['@capacitor/core', 'dependencies'],
    ['@capacitor/android', 'dependencies'],
    ['@capacitor/cli', 'devDependencies'],
  ]) {
    const version = pkg[section]?.[dep];
    assert.equal(version, '7.6.9', `${dep} must be pinned to 7.6.9 in ${section}`);
    assert.match(version, /^\d+\.\d+\.\d+$/, `${dep} must use an exact pinned semver`);
    assert.equal(lock.packages?.[`node_modules/${dep}`]?.version, '7.6.9');
  }

  const appGradle = fs.readFileSync(
    path.join(repoRoot, 'android', 'app', 'build.gradle'),
    'utf8',
  );
  assert.match(appGradle, /namespace\s+"com\.cashpilot\.app"/);
  assert.match(appGradle, /applicationId\s+"com\.cashpilot\.app"/);

  const variablesGradle = fs.readFileSync(
    path.join(repoRoot, 'android', 'variables.gradle'),
    'utf8',
  );
  const minSdk = Number(variablesGradle.match(/minSdkVersion\s*=\s*(\d+)/)?.[1]);
  const compileSdk = Number(variablesGradle.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1]);
  const targetSdk = Number(variablesGradle.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);

  assert.equal(minSdk, 23);
  assert.equal(compileSdk, 35);
  assert.equal(targetSdk, 35);
  assert.ok(minSdk <= 34 && compileSdk >= 34 && targetSdk >= 34, 'Android 14 (API 34) runtime target must be supported by SDK bounds');
});

test('Android privacy, backup rules, and Android 12+ data extraction rules exclude all storage domains', () => {
  const manifest = fs.readFileSync(
    path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupOnly="false"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(manifest, /tools:replace="android:allowBackup"/);
  assert.match(manifest, /android:supportsRtl="true"/);

  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(permissions, ['android.permission.INTERNET']);

  const backupRules = fs.readFileSync(
    path.join(repoRoot, 'android', 'app', 'src', 'main', 'res', 'xml', 'backup_rules.xml'),
    'utf8',
  );
  const extractionRules = fs.readFileSync(
    path.join(repoRoot, 'android', 'app', 'src', 'main', 'res', 'xml', 'data_extraction_rules.xml'),
    'utf8',
  );

  const requiredDomains = ['root', 'file', 'database', 'sharedpref', 'external'];
  for (const domain of requiredDomains) {
    assert.match(
      backupRules,
      new RegExp(`<exclude\\s+domain="${domain}"\\s+path="\\."\\s*/>`),
      `backup_rules.xml must exclude domain ${domain}`,
    );
  }

  const cloudBackupSection = extractionRules.match(/<cloud-backup>([\s\S]*?)<\/cloud-backup>/)?.[1] || '';
  const deviceTransferSection = extractionRules.match(/<device-transfer>([\s\S]*?)<\/device-transfer>/)?.[1] || '';
  for (const domain of requiredDomains) {
    const pattern = new RegExp(`<exclude\\s+domain="${domain}"\\s+path="\\."\\s*/>`);
    assert.match(cloudBackupSection, pattern, `data_extraction_rules.xml cloud-backup must exclude ${domain}`);
    assert.match(deviceTransferSection, pattern, `data_extraction_rules.xml device-transfer must exclude ${domain}`);
  }
});

test('Service Worker registers on web browsers and skips/unregisters on native Capacitor', async () => {
  assert.equal(isNativeCapacitor({}), false);
  assert.equal(isNativeCapacitor({ Capacitor: { isNativePlatform: () => false } }), false);
  assert.equal(isNativeCapacitor({ Capacitor: { isNativePlatform: () => true } }), true);
  assert.equal(isNativeCapacitor({ Capacitor: { getPlatform: () => 'android' } }), true);

  let registeredUrl = null;
  const webResult = registerAppServiceWorker({
    view: {},
    nav: {
      serviceWorker: {
        register(url) {
          registeredUrl = url;
          return Promise.resolve();
        },
      },
    },
  });
  assert.deepEqual(webResult, { registered: true, reason: 'web-service-worker' });
  assert.equal(registeredUrl, './service-worker.js');

  let unregisterCalls = 0;
  let nativeRegisterCalled = false;
  const nativeResult = registerAppServiceWorker({
    view: { Capacitor: { isNativePlatform: () => true } },
    nav: {
      serviceWorker: {
        register() {
          nativeRegisterCalled = true;
          return Promise.resolve();
        },
        getRegistrations() {
          return Promise.resolve([
            { unregister() { unregisterCalls += 1; } },
          ]);
        },
      },
    },
  });
  await Promise.resolve();
  assert.deepEqual(nativeResult, { registered: false, reason: 'native-capacitor' });
  assert.equal(nativeRegisterCalled, false);
  assert.equal(unregisterCalls, 1);
});

test('PWA install button remains hidden on native Capacitor', () => {
  const viewListeners = new Map();
  const button = {
    hidden: false,
    disabled: false,
    addEventListener() {},
  };
  const view = {
    Capacitor: { isNativePlatform: () => true },
    matchMedia: () => ({ matches: false }),
    addEventListener(type, fn) { viewListeners.set(type, fn); },
  };
  const root = { getElementById: id => (id === 'installBtn' ? button : null) };
  bindPWAInstall({ root, view, nav: { standalone: false } });

  let prevented = 0;
  viewListeners.get('beforeinstallprompt')({
    preventDefault() { prevented += 1; },
  });
  assert.equal(prevented, 1);
  assert.equal(button.hidden, true);
});

test('Backup export selects Android SAF, Web Share, or Anchor Download appropriately and importFile accepts JSON MIME types', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const importInput = html.match(/<input[^>]*id="importFile"[^>]*>/)?.[0] || '';
  assert.ok(importInput.includes('accept=".json,application/json,text/plain"'));

  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: key => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, val) => { storageMap.set(key, String(val)); },
    removeItem: key => { storageMap.delete(key); },
  };
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, remove() {} }),
    body: { appendChild() {}, removeChild() {} },
  };

  DB.set(DB.KEYS.INCOME, [{ id: 'inc1', name: 'Salary', amount: 5000, type: 'salary', date: '2026-10-01' }]);

  // 1. Native Android SAF bridge
  let safFilename = null;
  let safPayload = null;
  const safView = {
    Capacitor: { isNativePlatform: () => true },
    CashPilotAndroid: {
      saveJsonBackup(filename, json) {
        safFilename = filename;
        safPayload = JSON.parse(json);
        return true;
      },
    },
  };
  assert.equal(selectBackupExportStrategy({ view: safView, nav: {} }), 'android-saf');
  const safRes = exportData({ view: safView, nav: {} });
  assert.equal(safRes.strategy, 'android-saf');
  assert.match(safFilename, /^cashpilot-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(safPayload.mz_income[0].name, 'Salary');

  // 2. Native Web Share fallback when CashPilotAndroid is absent
  let sharedBundle = null;
  class FakeFile {
    constructor(parts, name, options) {
      this.parts = parts;
      this.name = name;
      this.type = options?.type;
    }
  }
  const shareView = { Capacitor: { isNativePlatform: () => true } };
  const shareNav = {
    canShare: () => true,
    share(bundle) {
      sharedBundle = bundle;
      return Promise.resolve();
    },
  };
  assert.equal(
    selectBackupExportStrategy({ view: shareView, nav: shareNav, FileCtor: FakeFile }),
    'web-share',
  );
  const shareRes = exportData({ view: shareView, nav: shareNav, FileCtor: FakeFile });
  assert.equal(shareRes.strategy, 'web-share');
  assert.equal(sharedBundle.files.length, 1);
  assert.equal(sharedBundle.files[0].type, 'application/json');

  // 3. Standard browser anchor download
  let clickedAnchor = null;
  let revokedUrl = null;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:https://localhost/test-backup';
  URL.revokeObjectURL = url => { revokedUrl = url; };

  try {
    const anchorDoc = {
      createElement(tag) {
        assert.equal(tag, 'a');
        return {
          href: '',
          download: '',
          click() { clickedAnchor = { href: this.href, download: this.download }; },
        };
      },
      body: {
        appendChild() {},
        removeChild() {},
      },
    };
    const webRes = exportData({ view: {}, nav: {}, doc: anchorDoc });
    assert.equal(webRes.strategy, 'anchor-download');
    assert.equal(clickedAnchor?.href, 'blob:https://localhost/test-backup');
    assert.match(clickedAnchor?.download || '', /^cashpilot-backup-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(revokedUrl, 'blob:https://localhost/test-backup');
  } finally {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  }
});

test('Android hardware back handler prioritizes confirm dialog, then modal, then sub-page navigation, then exit', () => {
  let confirmCancelled = 0;
  let modalClosed = 0;
  let navigatedDashboard = 0;

  // 1. Active confirm dialog takes highest priority
  const confirmDoc = {
    getElementById: id => (id === 'confirmDialog' ? { classList: { contains: c => c === 'active' } } : null),
    querySelector: () => ({}),
  };
  assert.equal(
    handleAndroidBack({
      doc: confirmDoc,
      currentState: { currentPage: 'expenses' },
      onCancelConfirm: () => { confirmCancelled += 1; },
      onCloseModal: () => { modalClosed += 1; },
      onNavigateDashboard: () => { navigatedDashboard += 1; },
    }),
    true,
  );
  assert.equal(confirmCancelled, 1);
  assert.equal(modalClosed, 0);
  assert.equal(navigatedDashboard, 0);

  // 2. Active modal overlay takes second priority
  const modalDoc = {
    getElementById: () => null,
    querySelector: sel => (sel === '.modal-overlay.active' ? {} : null),
  };
  assert.equal(
    handleAndroidBack({
      doc: modalDoc,
      currentState: { currentPage: 'expenses' },
      onCancelConfirm: () => { confirmCancelled += 1; },
      onCloseModal: () => { modalClosed += 1; },
      onNavigateDashboard: () => { navigatedDashboard += 1; },
    }),
    true,
  );
  assert.equal(modalClosed, 1);
  assert.equal(navigatedDashboard, 0);

  // 3. Non-dashboard page navigates back to dashboard
  const pageDoc = {
    getElementById: () => null,
    querySelector: () => null,
  };
  assert.equal(
    handleAndroidBack({
      doc: pageDoc,
      currentState: { currentPage: 'analytics' },
      onCancelConfirm: () => { confirmCancelled += 1; },
      onCloseModal: () => { modalClosed += 1; },
      onNavigateDashboard: () => { navigatedDashboard += 1; },
    }),
    true,
  );
  assert.equal(navigatedDashboard, 1);

  // 4. Dashboard with no open dialogs returns false to allow native exit
  assert.equal(
    handleAndroidBack({
      doc: pageDoc,
      currentState: { currentPage: 'dashboard' },
      onCancelConfirm: () => { confirmCancelled += 1; },
      onCloseModal: () => { modalClosed += 1; },
      onNavigateDashboard: () => { navigatedDashboard += 1; },
    }),
    false,
  );
});

test('printSummary delegates to Android PrintManager bridge on native Capacitor and window.open on web', () => {
  let androidJobTitle = null;
  let androidHtml = null;
  const nativeView = {
    Capacitor: { isNativePlatform: () => true },
    CashPilotAndroid: {
      printHtml(title, html) {
        androidJobTitle = title;
        androidHtml = html;
        return true;
      },
    },
  };
  const nativeRes = printSummary({ view: nativeView });
  assert.deepEqual(nativeRes, { strategy: 'android-print-manager', printed: true });
  assert.ok(androidJobTitle && androidJobTitle.length > 0);
  assert.match(androidHtml, /<!DOCTYPE html>/);

  let writtenHtml = '';
  let closed = false;
  const webView = {
    open() {
      return {
        document: {
          write(str) { writtenHtml += str; },
          close() { closed = true; },
        },
      };
    },
  };
  const webRes = printSummary({ view: webView });
  assert.deepEqual(webRes, { strategy: 'window-open', printed: true });
  assert.equal(closed, true);
  assert.match(writtenHtml, /window.print()/);
});
