import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('release artifact cashpilot.zip is absent from the working tree', () => {
  const legacyArchive = join(root, 'files', 'cashpilot.zip');

  assert.equal(
    existsSync(legacyArchive),
    false,
    'Release guard failed: files/cashpilot.zip must remain absent from the working tree.',
  );
});
