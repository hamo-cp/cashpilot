# Android / Capacitor Migration Baseline

## Scope

This branch evaluates packaging the existing Cashpilot web application as an installable Android APK. The current implementation is a browser-based PWA; the Android wrapper is not yet implemented.

## Baseline reference

- Base branch: `master`
- Base commit: `5bf83ffc2f12ec5509cdbdb7f453a2dc1454f493`
- Baseline application version: `1.0.0`
- Proposed first option: Capacitor, pending a working Android proof of concept.

## Verification status

The repository's existing checks are defined in `package.json` and `.github/workflows/ci.yml`:

- `npm test`
- `npm run test:security`
- Browser regression suite: `npm run test:browser`

These checks have **not** been executed in a local working copy as part of this baseline note. A successful GitHub Actions run on this branch must be inspected before the baseline is recorded as passing. An empty or unavailable status response is not evidence of success.

## Android acceptance gates

1. Produce a reproducible, signed APK from a known commit.
2. Install and launch on Android 14.
3. Verify core financial calculations against known test cases.
4. Verify local-only features continue to work offline.
5. Verify backup export and restore from within the Android app.
6. Verify storage protections and document the limits of at-rest protection.
7. Verify an app update does not erase existing Android app data.
8. Test notification behavior, file handling, print/share flows, external links, and Arabic/English layouts on a real device or a documented emulator.
9. Publish build provenance and a SHA-256 checksum for each release artifact.

## Data policy for the Android first install

The Android installation starts with empty application data and default settings. Migrating browser-local data is out of scope. In-app backup and restore remain required. Normal application updates must preserve data created in the Android app.

## Next steps

1. Obtain and inspect passing baseline CI results.
2. Add the smallest Capacitor proof of concept on this branch.
3. Confirm local asset loading, navigation, persistence, and offline startup.
4. Add Android build and validation to CI only after the proof of concept works.
5. Do not call an APK release-ready until all acceptance gates are evidenced.
