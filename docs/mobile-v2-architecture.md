# CashPilot Mobile 2.0 architecture — P0

Status: P0 foundation in progress. This document records the bounded architecture decision for the first Android-only Home and Activity screens.

## Decision

Keep the current vanilla JavaScript domain, storage adapter, Capacitor shell, and browser PWA. Add a separate mobile presentation entry at **mobile/index.html** and keep its screens, copy, navigation, and design tokens under **src/mobile/**. The Android staging command writes the mobile entry to **www/index.html**; it does not overwrite the repository-root PWA entry at **index.html**.

The mobile presentation imports the existing **src/services/finance.js** read APIs and existing currency/i18n helpers. It does not import the PWA page controllers or duplicate balance calculations. No new framework, database, runtime package, or network service is introduced.

## Screen map

| Tab | P0 behavior | Later work |
| --- | --- | --- |
| Home | Selected-month income, expenses, net, existing budget signal, and four recent transactions. Read-only. | Quick Add, richer budget actions. |
| Activity | Selected-month transaction list using the existing finance search, with text and type filters. Read-only. | Details, edit, delete, broader date/category filters. |
| Plan | Accessible placeholder. | Budgets, debts, subscriptions, upcoming obligations. |
| Insights | Accessible placeholder. | Existing verified income and spending summaries. |
| More | Existing language and theme preferences, plus a staged-tools notice. | Investments, privacy, backup/import, printing, app information. |

The global Add control is visible and reports that transaction entry is coming in a later phase. It does not write records. Plan and Insights are honest placeholders until their views are implemented. Navigation has five labeled tabs, supports RTL mirroring, and the native Back bridge returns to Home before allowing the Activity to exit.

## Data and compatibility contracts

| Contract | Existing value or behavior | P0 rule |
| --- | --- | --- |
| Android package | Application ID and namespace **com.cashpilot.app** | Keep unchanged. |
| WebView origin | **https://localhost**, from Android scheme **https** and host **localhost** | Keep unchanged so existing WebView localStorage remains on the same origin. |
| Financial collections | **mz_income**, **mz_expenses**, **mz_debts**, **mz_investments**, **mz_subscriptions**, **mz_budget**, **mz_settings** | Keep every key and stored shape unchanged. |
| Current backup | Flat JSON object with the seven official keys above | Keep export and validation code unchanged. |
| Legacy backup | Six-key JSON object without **mz_subscriptions** is accepted by the existing importer | Preserve the existing compatibility path. |
| Existing auxiliary local state | **cashpilot_lang**, **cashpilot_market_cache_v2**, **mz_notifications**, **mz_notif_last_check**, **mz_notif_permission_asked**, **mz_last_smart_analysis** | Keep names unchanged. These values are not part of the official financial backup payload except theme/currency stored inside **mz_settings**. |
| Finance reads | **getMonthSummary(month, year)** and **searchTransactions(query, month, year)** | Use existing results directly; no new totals or rounding rules. |
| Offline use | Finance records are local; mobile assets are packaged with the APK | P0 screens make no network requests. |

The Home and Activity view models are read-only. The More screen changes only the existing language preference and **mz_settings.theme** through the current i18n and finance APIs. No migration or import from browser PWA storage is performed.

## Android staging boundary

**scripts/build-web.mjs** keeps its existing explicit top-level staging allowlist. Only its **index.html** source changes for the Android bundle: it is copied from **mobile/index.html**. The root PWA HTML remains a separate browser entry. Shared code continues to be staged from the existing **src/** allowlist, including the new **src/mobile/** modules. The workflow checks the staged mobile entry and required mobile assets in addition to its existing exclusions and Android privacy assertions.

The mobile entry uses only local ES modules and styles. It does not start the PWA service worker, call market services, or load remote fonts. Safe-area insets, touch targets, semantic headings and buttons, visible keyboard focus, reduced motion, and logical CSS properties are part of the new design system.

For a runnable side-by-side preview from the local static server, open **docs/mobile-v2-comparison.html**. It embeds the browser PWA and Android mobile entry at the same 390-pixel viewport; the GitHub browser job captures this comparison as an artifact.

## Release gates

| Gate | Evidence required | Current P0 status |
| --- | --- | --- |
| Source isolation | Build test proves the Android entry is staged and root PWA source remains unchanged | Passed in the Node regression suite. |
| Data compatibility | Tests compare the mobile Home model to finance service results, assert no record writes, and pin the existing key and backup contract | Passed: summary parity, read-only behavior, XSS escaping and unchanged backup keys. |
| Regression and security | Existing Node regression/security suites plus the new mobile tests pass | Passed with Node 24.22.1: 76 regression tests, core/UI checks, and 18 security tests. |
| Web staging | Android staging succeeds and contains only allowlisted assets | The allowlist staging test passed to an isolated temporary directory. The direct local build to **www/** did not return within 30 seconds and created no output; it was stopped, so default-path staging remains unverified. |
| Debug APK | GitHub Actions debug workflow passes and uploads a non-empty APK with hash and logs | Workflow now checks the mobile entry/assets; no CI run or APK artifact yet. |
| Browser behavior | Mobile navigation, search/filter, Back bridge, RTL/LTR and theme flow run in a real browser with screenshots | Added to the existing Chrome CDP CI job, but not run locally because no browser binary is installed. |
| Device behavior | Android 14/API 34 checks for RTL/LTR, themes, offline cold start, Back, safe areas, persistence and backup | Not verified in this environment. |
| Mutation UX | Backup/restore, transaction edits, undo/confirmation, and data persistence tests | Not part of P0; no financial mutation UI is enabled. |
| Release | Explicit owner approval and a reviewed release/signing plan | Not authorized by this task. |

P0 is not complete based on a successful compilation alone. Report the exact command, exit status, source commit, CI run and artifact URL when those are available. Keep emulator and device checks explicitly separate from automated build evidence.

## Current environment notes

The requested **D:\Cashpilot-android** directory was absent. Work uses a new checkout at **D:\Cashpilot-mobile\cashpilot-android**, on local branch **feature/mobile-v2**, created from **mobile/android-capacitor** at **eae629bca63c830b03ce2996f4cb0381a1edc2c6**. The pre-existing **D:\Cashpilot-mobile\cashpilot-master** folder is a non-Git PWA snapshot and was not edited.

Node.js 24.22.1 is available from the bundled runtime. npm, npx, project node_modules, Android SDK tools, and Playwright's bundled Chromium executable are unavailable. Microsoft Edge 155 is installed, but a headless launch through the existing Playwright package exited before opening the page: Edge could not write temporary DualEngine site-list files in its sandbox profile (error -5). No browser screenshot or runtime claim is made from that attempt. The comparison page is available at **docs/mobile-v2-comparison.html** when served from the repository root.
